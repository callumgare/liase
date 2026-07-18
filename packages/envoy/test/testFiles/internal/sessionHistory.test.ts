import { type Server, createServer } from "node:http";
import { createEnvoySession } from "@/src/envoy.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html>
<html>
  <head><title>Root</title></head>
  <body>
    <h1 id="heading">Root Page</h1>
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

describe("EnvoySession history tracking", () => {
  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  it("tracks envoy requests in history", async () => {
    const session = await createEnvoySession();

    try {
      await session.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
      });

      const history = session.getHistory();
      expect(history).toHaveLength(1);

      const item = history[0];
      // URL constructor normalizes to include trailing slash
      expect(item.request.url.pathname).toBe("/");
      expect(item.request.method).toBe("GET");
      expect(item.response.statusCode).toBe(200);
      expect(item.response.cached).toBe(false);
      expect(item.response.cachedOn).toBeNull();
    } finally {
      await session.close();
    }
  });

  it("tracks fetch requests in history", async () => {
    const session = await createEnvoySession();

    try {
      const response = await session.fetch(`${serverUrl}/text`);
      expect(response.status).toBe(200);

      const history = session.getHistory();
      expect(history).toHaveLength(1);

      const item = history[0];
      expect(item.request.url.href).toBe(`${serverUrl}/text`);
      expect(item.request.method).toBe("GET");
      expect(item.response.statusCode).toBe(200);
      expect(item.response.body).toBe("plain-text-response");
      expect(item.response.cached).toBe(false);
      expect(item.response.cachedOn).toBeNull();
    } finally {
      await session.close();
    }
  });

  it("tracks multiple requests in history", async () => {
    const session = await createEnvoySession();

    try {
      await session.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
      });

      await session.fetch(`${serverUrl}/json`);

      await session.envoy(`${serverUrl}/text`, {
        agent: "fetch",
        responseType: "text",
      });

      const history = session.getHistory();
      expect(history).toHaveLength(3);

      // First request is envoy with root path
      expect(history[0].request.url.pathname).toBe("/");
      // Second is fetch to /json
      expect(history[1].request.url.href).toBe(`${serverUrl}/json`);
      // Third is envoy to /text
      expect(history[2].request.url.href).toBe(`${serverUrl}/text`);
    } finally {
      await session.close();
    }
  });

  it("includes meta field in history items", async () => {
    const session = await createEnvoySession();

    try {
      await session.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
      });

      const history = session.getHistory();
      expect(history).toHaveLength(1);

      // Default meta should be empty object
      expect(history[0].meta).toEqual({});
    } finally {
      await session.close();
    }
  });

  it("cloned session gets snapshot of parent history and maintains separate history", async () => {
    const session1 = await createEnvoySession();
    let session2: Awaited<ReturnType<typeof createEnvoySession>> | null = null;

    try {
      await session1.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
      });

      expect(session1.getHistory()).toHaveLength(1);

      // Create a cloned session - gets a snapshot of session1's history
      session2 = session1.clone();

      // session2 initially has the same requests as session1 (snapshot)
      expect(session2.getHistory()).toHaveLength(1);

      // But they are different array references
      expect(session1.getHistory()).not.toBe(session2.getHistory());

      // session2 makes a new request
      await session2.fetch(`${serverUrl}/json`);

      // session2 now has 2 requests
      expect(session2.getHistory()).toHaveLength(2);

      // session1 still only has 1 request (independent histories)
      expect(session1.getHistory()).toHaveLength(1);
    } finally {
      await session1.close();
      if (session2) {
        await session2.close();
      }
    }
  });

  it("cloned session uses meta for new requests in its own history", async () => {
    const session1 = await createEnvoySession();
    let session2: Awaited<ReturnType<typeof createEnvoySession>> | null = null;

    try {
      await session1.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
      });

      // Clone with custom meta
      session2 = session1.clone({ meta: { constructorPath: ["root"] } });

      await session2.fetch(`${serverUrl}/json`);

      // session1 still has 1 request
      expect(session1.getHistory()).toHaveLength(1);

      // session2 has 2 requests (snapshot + its new request)
      const session2History = session2.getHistory();
      expect(session2History).toHaveLength(2);

      // First item in session2 is the initial request from session1 (no meta)
      expect(session2History[0].meta).toEqual({});

      // Second item in session2 is its own request with the custom meta
      expect(session2History[1].meta).toEqual({ constructorPath: ["root"] });
    } finally {
      await session1.close();
      if (session2) {
        await session2.close();
      }
    }
  });

  it("tracks fetch request with custom headers", async () => {
    const session = await createEnvoySession();

    try {
      await session.fetch(`${serverUrl}/text`, {
        method: "POST",
        headers: { "X-Custom": "value", "X-Another": "header" },
        body: "test-body",
      });

      const history = session.getHistory();
      expect(history).toHaveLength(1);

      const item = history[0];
      expect(item.request.method).toBe("POST");
      // Check that custom headers are present (may have additional implicit headers)
      expect(item.request.headers["X-Custom"]).toBe("value");
      expect(item.request.headers["X-Another"]).toBe("header");
      expect(item.request.body).toBe("test-body");
    } finally {
      await session.close();
    }
  });

  it("tracks envoy request with custom headers", async () => {
    const session = await createEnvoySession();

    try {
      await session.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
        method: "POST",
        headers: { "X-Custom": "value" },
        body: "test-body",
      });

      const history = session.getHistory();
      expect(history).toHaveLength(1);

      const item = history[0];
      expect(item.request.method).toBe("POST");
      expect(item.request.headers).toEqual({ "X-Custom": "value" });
      expect(item.request.body).toBe("test-body");
    } finally {
      await session.close();
    }
  });

  it("fetch response includes full response details in history", async () => {
    const session = await createEnvoySession();

    try {
      const response = await session.fetch(`${serverUrl}/json`);
      const responseBody = await response.text();

      const history = session.getHistory();
      const item = history[0];

      expect(item.response.statusCode).toBe(200);
      expect(item.response.body).toBe(responseBody);
      expect(item.response.headers).toHaveProperty("content-type");
    } finally {
      await session.close();
    }
  });

  it("envoy response includes full response details in history", async () => {
    const session = await createEnvoySession();

    try {
      await session.envoy(`${serverUrl}/json`, {
        agent: "fetch",
        responseType: "json",
      });

      const history = session.getHistory();
      const item = history[0];

      expect(item.response.statusCode).toBe(200);
      expect(item.response.body).toContain('"ok"');
      expect(item.response.body).toContain('"kind"');
    } finally {
      await session.close();
    }
  });

  it("handles Request object as fetch input", async () => {
    const session = await createEnvoySession();

    try {
      const request = new Request(`${serverUrl}/text`, {
        method: "POST",
        headers: { "X-Test": "1" },
        body: "request-body",
      });

      await session.fetch(request);

      const history = session.getHistory();
      expect(history).toHaveLength(1);

      const item = history[0];
      expect(item.request.url.href).toBe(`${serverUrl}/text`);
      expect(item.request.method).toBe("POST");
      // Request headers are normalized to lowercase
      expect(item.request.headers["x-test"]).toBe("1");
      // Note: Request body is a ReadableStream and gets consumed during fetch,
      // so we don't capture it from Request objects
    } finally {
      await session.close();
    }
  });

  it("sibling clones from same parent have separate histories", async () => {
    const parentSession = await createEnvoySession();
    let clone1: Awaited<ReturnType<typeof createEnvoySession>> | null = null;
    let clone2: Awaited<ReturnType<typeof createEnvoySession>> | null = null;

    try {
      // Parent makes request A
      await parentSession.envoy(serverUrl, {
        agent: "fetch",
        responseType: "text",
      });

      expect(parentSession.getHistory()).toHaveLength(1);

      // Create two clones from parent (they are siblings, not descendants of each other)
      clone1 = parentSession.clone({
        meta: { constructorPath: ["node1"] },
      });
      clone2 = parentSession.clone({
        meta: { constructorPath: ["node2"] },
      });

      // Both clones see parent's request A at the time of cloning
      expect(clone1.getHistory()).toHaveLength(1);
      expect(clone2.getHistory()).toHaveLength(1);

      // Clone 1 makes request B
      await clone1.fetch(`${serverUrl}/json`);

      // Only clone1 sees A + B
      expect(clone1.getHistory()).toHaveLength(2);

      // Parent still only sees A (doesn't descend from clone1)
      expect(parentSession.getHistory()).toHaveLength(1);

      // clone2 still only sees A (doesn't descend from clone1)
      expect(clone2.getHistory()).toHaveLength(1);

      // Clone 2 makes request C
      await clone2.envoy(`${serverUrl}/text`, {
        agent: "fetch",
        responseType: "text",
      });

      // Now clone2 has A + C
      expect(clone2.getHistory()).toHaveLength(2);

      // Verify parent only sees its own requests (doesn't see children)
      const parentHistory = parentSession.getHistory();
      expect(parentHistory).toHaveLength(1);
      expect(parentHistory[0].request.url.pathname).toBe("/");
      expect(parentHistory[0].meta).toEqual({});

      // Verify clone1 has A + B
      const history1 = clone1.getHistory();
      expect(history1).toHaveLength(2);
      expect(history1[0].request.url.pathname).toBe("/");
      expect(history1[0].meta).toEqual({});
      expect(history1[1].request.url.href).toBe(`${serverUrl}/json`);
      expect(history1[1].meta).toEqual({ constructorPath: ["node1"] });

      // Verify clone2 has A + C (different from clone1's history)
      const history2 = clone2.getHistory();
      expect(history2).toHaveLength(2);
      expect(history2[0].request.url.pathname).toBe("/");
      expect(history2[0].meta).toEqual({});
      expect(history2[1].request.url.href).toBe(`${serverUrl}/text`);
      expect(history2[1].meta).toEqual({ constructorPath: ["node2"] });

      // Verify clone1 and clone2 have different history arrays
      expect(clone1.getHistory()).not.toBe(clone2.getHistory());
    } finally {
      await parentSession.close();
      if (clone1) await clone1.close();
      if (clone2) await clone2.close();
    }
  });
});
