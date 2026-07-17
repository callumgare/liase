import { type Server, createServer } from "node:http";
import { envoy } from "@/src/envoy.js";
import { CheerioDomSelection } from "@/src/lib/dom/CheerioDomSelection.js";
import { PlaywrightDomSelection } from "@/src/lib/dom/PlaywrightDomSelection.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const callCtxAlways = { cacheNetworkRequests: "always" as const };
const callCtxNever = { cacheNetworkRequests: "never" as const };
const boundAlwaysEnvoy = envoy.bind(callCtxAlways) as typeof envoy;
const boundNeverEnvoy = envoy.bind(callCtxNever) as typeof envoy;

let server: Server;
let serverUrl: string;

function startServer() {
  return new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      if (req.url === "/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, kind: "json" }));
        return;
      }

      if (req.url === "/text") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("plain-text-response");
        return;
      }

      if (req.url === "/next") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<!doctype html><html><head><title>Next</title></head><body><h1 id="next">Next Page</h1></body></html>`,
        );
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html>
<html>
  <head><title>Root</title></head>
  <body>
    <h1 id="heading">Root Page</h1>
    <a id="go" href="/next">go</a>
  </body>
</html>`);
    }).listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function assertNode<T>(value: T | null): T {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error("Expected node to exist");
  }

  return value;
}

describe("envoy response handles", () => {
  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  it("returns a DOM response handle for got dom", async () => {
    const response = await boundAlwaysEnvoy(serverUrl, {
      agent: "got",
      responseType: "dom",
    });

    expect(response.type).toBe("dom");

    if (response.type !== "dom") {
      throw new Error("Expected DOM response");
    }

    expect(response.dom).toBeInstanceOf(CheerioDomSelection);
    expect(response.requestedUrl).toBe(serverUrl);
    expect(response.finalUrl).toBe(serverUrl);
    expect(response.root.matches("html")).toBe(true);
    expect(response.jsonLD).toEqual([]);
    expect(response.firstJsonLD).toEqual({});
    expect(response.canonicalUrl).toBeUndefined();
    expect(assertNode(response.root.getFirst("#heading")).text).toBe(
      "Root Page",
    );
    expect(response.statusCode).toBe(200);
  });

  it("returns a text response for got text", async () => {
    const response = await boundAlwaysEnvoy(`${serverUrl}/text`, {
      agent: "got",
      responseType: "text",
    });

    expect(response.type).toBe("text");
    expect("data" in response && typeof response.data === "string").toBe(true);

    if (!("data" in response) || typeof response.data !== "string") {
      throw new Error("Expected text response");
    }

    expect(response.data).toBe("plain-text-response");
  });

  it("returns a json response for got json", async () => {
    const response = await boundAlwaysEnvoy(`${serverUrl}/json`, {
      agent: "got",
      responseType: "json",
    });

    expect(response.type).toBe("json");
    expect("data" in response).toBe(true);

    if (!("data" in response) || typeof response.data !== "object") {
      throw new Error("Expected json response");
    }

    expect(response.data).toEqual({ ok: true, kind: "json" });
  });

  it("returns an interactive page handle for playwright page", async () => {
    const response = await boundNeverEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    expect(response.type).toBe("rendered dom");
    expect(response.cached).toBe(false);
    expect(response.cachedOn).toBe(null);
    expect(response.requestedUrl).toBe(serverUrl);

    const dom = await response.dom;
    expect(dom).toBeInstanceOf(PlaywrightDomSelection);
    expect(assertNode(dom.getFirst("#heading")).text).toBe("Root Page");
    expect((await response.root).matches("html")).toBe(true);
    expect(await response.jsonLD).toEqual([]);
    expect(await response.firstJsonLD).toEqual({});
    expect(await response.canonicalUrl).toBeUndefined();

    expect(await response.title).toBe("Root");
    expect(await response.html).toContain("Root Page");

    const screenshot = await response.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(0);

    await response.refetch();
    expect(assertNode((await response.dom).getFirst("#heading")).text).toBe(
      "Root Page",
    );

    const navPromise = response.waitForUrl();
    await assertNode((await response.dom).getFirst("#go")).click();
    await navPromise;

    expect(await response.html).toContain("Next Page");
    expect(await response.title).toBe("Next");

    await response.close();
  });

  it("defaults to got+dom when options are omitted", async () => {
    const response = await boundNeverEnvoy(serverUrl);

    expect(response.type).toBe("dom");
    if (response.type !== "dom") {
      throw new Error("Expected default DOM response");
    }
    expect(response.root.matches("html")).toBe(true);
    expect(assertNode(response.root.getFirst("#heading")).text).toBe(
      "Root Page",
    );
  });

  it("returns empty objects for invalid or empty JSON-LD blocks", async () => {
    const invalidJsonLdServer = await new Promise<Server>((resolve) => {
      const s = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!doctype html>
<html>
  <head>
    <script type="application/ld+json">{not-valid-json</script>
    <script type="application/ld+json"></script>
  </head>
  <body><h1>invalid ld+json</h1></body>
</html>`);
      }).listen(0, "127.0.0.1", () => resolve(s));
    });

    const address = invalidJsonLdServer.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    const response = await boundNeverEnvoy(url, {
      agent: "got",
      responseType: "dom",
    });

    if (response.type !== "dom") {
      throw new Error("Expected DOM response");
    }

    expect(response.jsonLD).toEqual([{}, {}]);
    expect(response.firstJsonLD).toEqual({});

    await new Promise<void>((resolve, reject) => {
      invalidJsonLdServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("throws when cacheNetworkRequests is auto", async () => {
    const autoEnvoy = envoy.bind({ cacheNetworkRequests: "auto" as const });
    await expect(autoEnvoy(serverUrl, { agent: "got" })).rejects.toThrow(
      'The "auto" value for the cacheNetworkRequests option is not yet supported',
    );
  });

  it("throws on non-ok got response", async () => {
    const badServer = await new Promise<Server>((resolve) => {
      const s = createServer((_req, res) => {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("server exploded");
      }).listen(0, "127.0.0.1", () => resolve(s));
    });

    const address = badServer.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;

    await expect(
      boundNeverEnvoy(url, { agent: "got", responseType: "text" }),
    ).rejects.toThrow("Got response status 500");

    await new Promise<void>((resolve, reject) => {
      badServer.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
