import { type Server, createServer } from "node:http";
import { createEnvoySession } from "@/src/envoy.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let server: Server;
let baseUrl: string;
let requestCount = 0;

beforeEach(async () => {
  requestCount = 0;
  server = await new Promise((resolve) => {
    const s = createServer((req, res) => {
      requestCount++;
      // Handle conditional requests for testing "default" cache behavior
      if (req.headers["if-none-match"] === '"test-etag"') {
        res.writeHead(304, { "Content-Type": "text/html" });
        res.end();
        return;
      }

      if (req.url === "/test-dom") {
        res.writeHead(200, {
          "Content-Type": "text/html",
          ETag: '"test-etag"',
        });
        res.end(
          "<!doctype html><html><head><title>Test</title></head><body><h1>Test DOM</h1></body></html>",
        );
        return;
      }
      if (req.url === "/test-json") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          ETag: '"test-etag"',
        });
        res.end(JSON.stringify({ test: "data" }));
        return;
      }
      if (req.url === "/test-text") {
        res.writeHead(200, {
          "Content-Type": "text/plain",
          ETag: '"test-etag"',
        });
        res.end("test-text-data");
        return;
      }
      if (req.url?.startsWith("/url-")) {
        res.writeHead(200, {
          "Content-Type": "text/plain",
          ETag: '"test-etag"',
        });
        res.end(`data-${req.url}`);
        return;
      }
      if (req.url === "/error-endpoint") {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Server error");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/plain",
        ETag: '"test-etag"',
      });
      res.end("default-response");
    }).listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      baseUrl = `http://127.0.0.1:${port}`;
      resolve(s);
    });
  });
});

afterEach(async () => {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("envoy - CachedResponseStrategy behaviors", () => {
  describe("never - no caching", () => {
    it("should not cache responses with 'never' strategy", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "never",
      });

      // First request
      const res1 = await session.envoy(`${baseUrl}/test-dom`);
      expect(res1.cached).toBe(false);

      // Second request - should not be cached
      const res2 = await session.envoy(`${baseUrl}/test-dom`);
      expect(res2.cached).toBe(false);

      // Verify history shows both were fresh
      const history = session.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].response.cached).toBe(false);
      expect(history[1].response.cached).toBe(false);

      await session.close();
    });

    it("should always make fresh network requests", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "never",
      });

      const responses = await Promise.all([
        session.envoy(`${baseUrl}/test-json`, { responseType: "json" }),
        session.envoy(`${baseUrl}/test-json`, { responseType: "json" }),
        session.envoy(`${baseUrl}/test-json`, { responseType: "json" }),
      ]);

      // All should be fresh (not cached)
      for (const res of responses) {
        expect(res.cached).toBe(false);
      }

      await session.close();
    });
  });

  describe("if-cached - use cache if available, fetch fresh otherwise", () => {
    it("should cache responses and return cached copies", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      // First request - should cache
      const res1 = await session.envoy(`${baseUrl}/test-dom`);
      expect(res1.type).toBe("dom");
      expect(res1.cached).toBe(false); // First response is fresh

      // Second request - should be cached
      const res2 = await session.envoy(`${baseUrl}/test-dom`);
      expect(res2.type).toBe("dom");
      expect(res2.cached).toBe(true); // Second should be from cache

      await session.close();
    });

    it("should work with JSON responses", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      // First request - cache
      const res1 = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(res1.type).toBe("json");
      expect(res1.cached).toBe(false);

      // Second request - from cache
      const res2 = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(res2.type).toBe("json");
      expect(res2.cached).toBe(true);

      // Data should be identical
      expect(res1.data).toEqual(res2.data);

      await session.close();
    });

    it("should work with text responses", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      // First request - cache
      const res1 = await session.envoy(`${baseUrl}/test-text`, {
        responseType: "text",
      });
      expect(res1.type).toBe("text");
      expect(res1.cached).toBe(false);

      // Second request - from cache
      const res2 = await session.envoy(`${baseUrl}/test-text`, {
        responseType: "text",
      });
      expect(res2.type).toBe("text");
      expect(res2.cached).toBe(true);

      // Data should be identical
      expect(res1.data).toEqual(res2.data);

      await session.close();
    });

    it("should maintain separate caches for different URLs", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      // Prime two URLs
      const res1a = await session.envoy(`${baseUrl}/url-1`, {
        responseType: "text",
      });
      const res2a = await session.envoy(`${baseUrl}/url-2`, {
        responseType: "text",
      });

      expect(res1a.cached).toBe(false);
      expect(res2a.cached).toBe(false);

      // Fetch again - both should be cached
      const res1b = await session.envoy(`${baseUrl}/url-1`, {
        responseType: "text",
      });
      const res2b = await session.envoy(`${baseUrl}/url-2`, {
        responseType: "text",
      });

      expect(res1b.cached).toBe(true);
      expect(res2b.cached).toBe(true);

      // Data should match
      expect(res1a.data).toEqual(res1b.data);
      expect(res2a.data).toEqual(res2b.data);

      await session.close();
    });

    it("should maintain history of all requests", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      await session.envoy(`${baseUrl}/test-dom`);
      await session.envoy(`${baseUrl}/test-dom`);
      await session.envoy(`${baseUrl}/test-text`, { responseType: "text" });

      const history = session.getHistory();
      expect(history).toHaveLength(3);

      // First request
      expect(history[0].response.cached).toBe(false);

      // Second request (same URL)
      expect(history[1].response.cached).toBe(true);

      // Third request (different URL)
      expect(history[2].response.cached).toBe(false);

      await session.close();
    });
  });

  describe("if-fresh - use cache if available, validate with server for staleness", () => {
    it("should use cache and assume fresh", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-fresh",
      });

      // First request - should fetch fresh
      const res1 = await session.envoy(`${baseUrl}/test-dom`);
      expect(res1.cached).toBe(false);

      // Second request - should use cache (if-fresh uses default behavior)
      const res2 = await session.envoy(`${baseUrl}/test-dom`);
      expect(res2.cached).toBe(true);

      await session.close();
    });

    it("should fetch fresh if not in cache", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-fresh",
      });

      const res = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(res.cached).toBe(false);
      expect(res.statusCode).toBe(200);

      await session.close();
    });

    it("should work with different response types", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-fresh",
      });

      // Test DOM
      const dom1 = await session.envoy(`${baseUrl}/test-dom`, {
        responseType: "dom",
      });
      expect(dom1.cached).toBe(false);

      const dom2 = await session.envoy(`${baseUrl}/test-dom`, {
        responseType: "dom",
      });
      expect(dom2.cached).toBe(true);

      // Test JSON
      const json1 = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(json1.cached).toBe(false);

      const json2 = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(json2.cached).toBe(true);

      await session.close();
    });
  });

  describe("exclusively - cache only (maps to only-if-cached)", () => {
    it("should return cached responses if available", async () => {
      const primeSession = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      const primed = await primeSession.envoy(`${baseUrl}/test-text`, {
        responseType: "text",
      });
      expect(primed.cached).toBe(false);
      await primeSession.close();

      const exclusiveSession = await createEnvoySession({
        cachedResponseStrategy: "exclusively",
      });

      const cached = await exclusiveSession.envoy(`${baseUrl}/test-text`, {
        responseType: "text",
      });
      expect(cached.cached).toBe(true);
      expect(cached.data).toBe("test-text-data");

      await exclusiveSession.close();
    });

    it("should throw 504 error when no cached response exists", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "exclusively",
      });

      await expect(
        session.envoy(`${baseUrl}/uncached-endpoint`, {
          responseType: "text",
        }),
      ).rejects.toThrow(/Got response status 504/);

      await session.close();
    });

    it("should not hit network when cache miss occurs", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "exclusively",
      });

      const countBefore = requestCount;

      await expect(
        session.envoy(`${baseUrl}/uncached-network-miss`, {
          responseType: "text",
        }),
      ).rejects.toThrow(/No cached response available/);

      expect(requestCount).toBe(countBefore);

      await session.close();
    });
  });

  describe("strategy with different response types", () => {
    it("should cache DOM responses", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      const res1 = await session.envoy(`${baseUrl}/test-dom`, {
        responseType: "dom",
      });
      expect(res1.cached).toBe(false);

      const res2 = await session.envoy(`${baseUrl}/test-dom`, {
        responseType: "dom",
      });
      expect(res2.cached).toBe(true);
      expect(res2.root).toBeDefined();

      await session.close();
    });

    it("should cache JSON responses", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      const res1 = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(res1.cached).toBe(false);

      const res2 = await session.envoy(`${baseUrl}/test-json`, {
        responseType: "json",
      });
      expect(res2.cached).toBe(true);
      expect(res2.data).toEqual(res1.data);

      await session.close();
    });

    it("should cache text responses", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      const res1 = await session.envoy(`${baseUrl}/test-text`, {
        responseType: "text",
      });
      expect(res1.cached).toBe(false);

      const res2 = await session.envoy(`${baseUrl}/test-text`, {
        responseType: "text",
      });
      expect(res2.cached).toBe(true);
      expect(res2.data).toEqual(res1.data);

      await session.close();
    });
  });

  describe("session cloning with cache", () => {
    it("should share cache between cloned sessions", async () => {
      const session1 = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      // Prime cache in first session
      await session1.envoy(`${baseUrl}/test-dom`);

      // Clone session
      const session2 = session1.clone();

      // Second session should have access to cache
      const res2 = await session2.envoy(`${baseUrl}/test-dom`);
      expect(res2.cached).toBe(true);

      await session1.close();
      await session2.close();
    });

    it("should share history between cloned sessions", async () => {
      const session1 = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      await session1.envoy(`${baseUrl}/test-dom`);

      const session2 = session1.clone();
      await session2.envoy(`${baseUrl}/test-text`, { responseType: "text" });

      const history = session2.getHistory();
      expect(history).toHaveLength(2);

      await session1.close();
      await session2.close();
    });
  });

  describe("error handling with caching", () => {
    it("should handle server errors with never strategy", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "never",
      });

      try {
        await session.envoy(`${baseUrl}/error-endpoint`);
      } catch (err) {
        expect(err).toBeDefined();
      }

      await session.close();
    });

    it("should handle server errors with if-cached strategy", async () => {
      const session = await createEnvoySession({
        cachedResponseStrategy: "if-cached",
      });

      try {
        await session.envoy(`${baseUrl}/error-endpoint`);
      } catch (err) {
        expect(err).toBeDefined();
      }

      await session.close();
    });
  });
});
