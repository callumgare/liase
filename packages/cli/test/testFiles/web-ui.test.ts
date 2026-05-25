import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const cliPath = fileURLToPath(new URL("../../src/index.ts", import.meta.url));
const allTypesPluginPath = fileURLToPath(
  new URL("../fixtures/allTypesPlugin.ts", import.meta.url),
);

function resolveTsx(): string {
  const candidates = [
    new URL("../../node_modules/.bin/tsx", import.meta.url),
    new URL("../../../../node_modules/.bin/tsx", import.meta.url),
  ];
  for (const url of candidates) {
    const p = fileURLToPath(url);
    if (existsSync(p)) return p;
  }
  return "tsx";
}

const TSX = resolveTsx();

// ---------------------------------------------------------------------------
// Server lifecycle helpers
// ---------------------------------------------------------------------------

type ServerHandle = { url: string; kill: () => void };

function startWebUiServer(extraArgs: string[] = []): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const proc = spawn(TSX, [cliPath, "web-ui", "--port", "0", ...extraArgs], {
      env: process.env,
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      reject(new Error("Web-UI server failed to start within 15 s"));
    }, 15_000);

    let stdoutBuf = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += String(chunk);
      const match = stdoutBuf.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeoutId);
        resolve({
          url: `http://localhost:${match[1]}`,
          kill: () => proc.kill(),
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeoutId);
        reject(new Error(`Server process exited with code ${code}`));
      }
    });
  });
}

async function post(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("web-ui server", () => {
  let server: ServerHandle;

  beforeAll(async () => {
    server = await startWebUiServer(["--plugins", allTypesPluginPath]);
  }, 20_000);

  afterAll(() => server?.kill());

  // -------------------------------------------------------------------------
  // Utility endpoints
  // -------------------------------------------------------------------------

  test("GET /build-id returns a numeric build id", async () => {
    const res = await fetch(`${server.url}/build-id`);
    expect(res.ok).toBe(true);
    const id = await res.json();
    expect(typeof id).toBe("number");
  });

  test("GET /secrets-sets returns an array", async () => {
    const res = await fetch(`${server.url}/secrets-sets`);
    expect(res.ok).toBe(true);
    const sets = await res.json();
    expect(Array.isArray(sets)).toBe(true);
  });

  test("GET / serves index.html", async () => {
    const res = await fetch(`${server.url}/`);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain("<html");
  });

  // -------------------------------------------------------------------------
  // GET /sources – schema field types
  // -------------------------------------------------------------------------

  describe("GET /sources", () => {
    let schemaFields: Record<string, unknown>;

    beforeAll(async () => {
      const res = await fetch(`${server.url}/sources`);
      expect(res.ok).toBe(true);
      const sources = (await res.json()) as {
        id: string;
        requestHandlers: {
          id: string;
          schemaFields: Record<string, unknown>;
        }[];
      }[];
      const handler = sources
        .find((s) => s.id === "all-types-source")
        ?.requestHandlers.find((h) => h.id === "all-types");
      expect(handler).toBeDefined();
      schemaFields = handler?.schemaFields ?? {};
    });

    test("string field has type 'string'", () => {
      expect(schemaFields.stringField).toMatchObject({ type: "string" });
    });

    test("number field has type 'number' and min/max checks", () => {
      const field = schemaFields.numberField as {
        type: string;
        checks: { kind: string; value: number }[];
      };
      expect(field.type).toBe("number");
      expect(field.checks).toContainEqual(
        expect.objectContaining({ kind: "min", value: 0 }),
      );
      expect(field.checks).toContainEqual(
        expect.objectContaining({ kind: "max", value: 100 }),
      );
    });

    test("boolean field has type 'boolean'", () => {
      expect(schemaFields.booleanField).toMatchObject({ type: "boolean" });
    });

    test("enum field is serialised as a union of string literals", () => {
      const field = schemaFields.enumField as {
        type: { type: string; value: string; valueType: string }[];
      };
      expect(Array.isArray(field.type)).toBe(true);
      expect(
        (field.type as { type: string }[]).every((t) => t.type === "literal"),
      ).toBe(true);
      const values = (field.type as { value: string }[]).map((t) => t.value);
      expect(values).toEqual(["alpha", "beta", "gamma"]);
    });

    test("array field has type 'array'", () => {
      expect(schemaFields.arrayField).toMatchObject({ type: "array" });
    });

    test("optional field carries optional: true", () => {
      expect(schemaFields.optionalField).toMatchObject({ optional: true });
    });

    test("default field carries the default value", () => {
      expect(schemaFields.defaultField).toMatchObject({ default: "fallback" });
    });

    test("source and queryType are excluded from schemaFields", () => {
      expect(schemaFields).not.toHaveProperty("source");
      expect(schemaFields).not.toHaveProperty("queryType");
    });
  });

  // -------------------------------------------------------------------------
  // POST / – each input type round-trips correctly
  // -------------------------------------------------------------------------

  const baseRequest = {
    source: "all-types-source",
    queryType: "all-types",
    stringField: "hello",
    numberField: 42,
    booleanField: true,
    enumField: "beta",
    arrayField: ["x", "y", "z"],
  };

  function postRequest(overrides: Record<string, unknown> = {}) {
    return post(`${server.url}/`, {
      liaseRequest: { ...baseRequest, ...overrides },
      cacheNetworkRequests: "never",
    });
  }

  test("string field is echoed back correctly", async () => {
    const { ok, body } = await postRequest({ stringField: "world" });
    expect(ok).toBe(true);
    expect(
      (body as { request: { stringField: string } }).request.stringField,
    ).toBe("world");
  });

  test("number field is echoed back as a number", async () => {
    const { ok, body } = await postRequest({ numberField: 7 });
    expect(ok).toBe(true);
    expect(
      (body as { request: { numberField: number } }).request.numberField,
    ).toBe(7);
  });

  test("boolean field true is echoed back", async () => {
    const { ok, body } = await postRequest({ booleanField: true });
    expect(ok).toBe(true);
    expect(
      (body as { request: { booleanField: boolean } }).request.booleanField,
    ).toBe(true);
  });

  test("boolean field false is echoed back", async () => {
    const { ok, body } = await postRequest({ booleanField: false });
    expect(ok).toBe(true);
    expect(
      (body as { request: { booleanField: boolean } }).request.booleanField,
    ).toBe(false);
  });

  test("enum field is echoed back correctly", async () => {
    const { ok, body } = await postRequest({ enumField: "gamma" });
    expect(ok).toBe(true);
    expect((body as { request: { enumField: string } }).request.enumField).toBe(
      "gamma",
    );
  });

  test("array field is echoed back as an array", async () => {
    const { ok, body } = await postRequest({ arrayField: ["a", "b", "c"] });
    expect(ok).toBe(true);
    expect(
      (body as { request: { arrayField: string[] } }).request.arrayField,
    ).toEqual(["a", "b", "c"]);
  });

  test("optional field can be omitted without error", async () => {
    const { optionalField: _, ...withoutOptional } = baseRequest as Record<
      string,
      unknown
    >;
    const { ok } = await post(`${server.url}/`, {
      liaseRequest: withoutOptional,
      cacheNetworkRequests: "never",
    });
    expect(ok).toBe(true);
  });

  test("optional field is echoed back when provided", async () => {
    const { ok, body } = await postRequest({ optionalField: "present" });
    expect(ok).toBe(true);
    expect(
      (body as { request: { optionalField?: string } }).request.optionalField,
    ).toBe("present");
  });

  test("default field uses its default when omitted", async () => {
    const { ok, body } = await postRequest();
    expect(ok).toBe(true);
    // Zod fills in the default during schema.parse() inside requestWithDefaults()
    expect(
      (body as { request: { defaultField: string } }).request.defaultField,
    ).toBe("fallback");
  });

  test("default field value is overridden when provided", async () => {
    const { ok, body } = await postRequest({ defaultField: "custom" });
    expect(ok).toBe(true);
    expect(
      (body as { request: { defaultField: string } }).request.defaultField,
    ).toBe("custom");
  });

  test("invalid enum value is rejected with a 400", async () => {
    const { ok, status } = await postRequest({ enumField: "not-valid" });
    expect(ok).toBe(false);
    expect(status).toBe(400);
  });
}, 60_000);
