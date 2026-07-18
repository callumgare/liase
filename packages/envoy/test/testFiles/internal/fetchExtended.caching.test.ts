import { type Server, createServer } from "node:http";
import { createFetchExtendedSession } from "@/src/fetchExtended/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let server: Server;
let baseUrl: string;
let requestLog: Array<{ url: string; headers: Record<string, string> }> = [];
const etagsByPath: Record<string, string> = {
  "/mdn-fresh": '"mdn-fresh-etag"',
  "/mdn-stale": '"mdn-stale-etag"',
};

beforeEach(async () => {
  requestLog = [];
  server = await new Promise((resolve) => {
    const s = createServer((req, res) => {
      const url = req.url || "";
      requestLog.push({
        url,
        headers: req.headers as Record<string, string>,
      });

      if (url === "/mdn-fresh") {
        const etag = etagsByPath[url];
        if (req.headers["if-none-match"] === etag) {
          res.writeHead(304, {
            "Content-Type": "text/plain",
            ETag: etag,
            "Cache-Control": "max-age=60",
          });
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/plain",
          ETag: etag,
          "Cache-Control": "max-age=60",
        });
        res.end("mdn-fresh-body");
        return;
      }

      if (url === "/mdn-stale") {
        const etag = etagsByPath[url];
        if (req.headers["if-none-match"] === etag) {
          res.writeHead(304, {
            "Content-Type": "text/plain",
            ETag: etag,
            "Cache-Control": "max-age=0, must-revalidate",
          });
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/plain",
          ETag: etag,
          "Cache-Control": "max-age=0, must-revalidate",
        });
        res.end("mdn-stale-body");
        return;
      }

      // Handle conditional requests for testing "default" cache behavior
      if (req.headers["if-none-match"] === '"test-etag"') {
        res.writeHead(304, { "Content-Type": "text/plain" });
        res.end();
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/plain",
        ETag: '"test-etag"',
        "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT",
      });
      res.end("test-data");
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

describe("wrapFetchWithCachingLogic - RequestCache option behaviors", () => {
  describe("no-store - never cache, never use cache", () => {
    it("should not store responses in cache", async () => {
      const session = await createFetchExtendedSession();

      // First request - should fetch from server
      const res1 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "no-store",
      });
      const data1 = await res1.text();
      expect(data1).toBeDefined();

      // Second request - should fetch from server again (not from cache)
      const res2 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "no-store",
      });
      const data2 = await res2.text();

      // Both should be fresh responses (not cached)
      // Check statusText doesn't indicate cached
      expect(res2.statusText).not.toContain("Cached");

      await session.close();
    });

    it("should make fresh request every time with no-store", async () => {
      const session = await createFetchExtendedSession();

      // Make multiple requests with no-store
      const responses = await Promise.all([
        session.fetch(`${baseUrl}/test-data`, { cache: "no-store" }),
        session.fetch(`${baseUrl}/test-data`, { cache: "no-store" }),
        session.fetch(`${baseUrl}/test-data`, { cache: "no-store" }),
      ]);

      // None should be cached
      for (const res of responses) {
        expect(res.statusText).not.toContain("Cached");
      }

      await session.close();
    });
  });

  describe("reload - bypass cache but update cache", () => {
    it("should not use cache on first request but store it", async () => {
      const session = await createFetchExtendedSession();

      const res = await session.fetch(`${baseUrl}/test-data`, {
        cache: "reload",
      });

      // First request with reload should not be cached
      expect(res.statusText).not.toContain("Cached");

      await session.close();
    });

    it("should update cache after reload fetch", async () => {
      const session = await createFetchExtendedSession();

      // First request with reload - fetches from server
      const res1 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "reload",
      });
      const data1 = await res1.text();
      expect(res1.statusText).not.toContain("Cached");

      // Second request with force-cache should get the stored response
      const res2 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "force-cache",
      });
      const data2 = await res2.text();

      // Should be the same data (from cache)
      expect(data1).toEqual(data2);
      expect(res2.statusText).toContain("Cached");

      await session.close();
    });
  });

  describe("force-cache - always use cache if available", () => {
    it("should return cached response if available", async () => {
      const session = await createFetchExtendedSession();

      // Prime cache with initial request
      const res1 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "reload",
      });
      const data1 = await res1.text();

      // Second request with force-cache should return cached response
      const res2 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "force-cache",
      });
      const data2 = await res2.text();

      expect(data1).toEqual(data2);
      expect(res2.statusText).toContain("Cached");
    });

    it("should fetch from server if not in cache", async () => {
      const session = await createFetchExtendedSession();

      // Request with force-cache to a URL not yet cached
      const res = await session.fetch(`${baseUrl}/new-endpoint`, {
        cache: "force-cache",
      });

      // Should make a network request since not cached
      expect(res.statusText).not.toContain("Cached");

      await session.close();
    });

    it("should prefer cache over fresh responses", async () => {
      const session = await createFetchExtendedSession();

      // Prime cache
      const res1 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "reload",
      });
      const data1 = await res1.text();
      const timestamp1 = Date.now();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // force-cache should return the old cached response
      const res2 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "force-cache",
      });
      const data2 = await res2.text();

      expect(data1).toEqual(data2);
      expect(res2.statusText).toContain("Cached");

      await session.close();
    });
  });

  describe("only-if-cached - only use cache", () => {
    it("should return cached response if available", async () => {
      const session = await createFetchExtendedSession();

      // Prime cache
      const res1 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "reload",
      });
      const data1 = await res1.text();

      // only-if-cached should return cached response
      const res2 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "only-if-cached",
      });
      const data2 = await res2.text();

      expect(data1).toEqual(data2);
      expect(res2.statusText).toContain("Cached");

      await session.close();
    });

    it("should return 504 and not hit network if not in cache", async () => {
      const session = await createFetchExtendedSession();

      requestLog = [];
      const res = await session.fetch(`${baseUrl}/uncached-endpoint`, {
        cache: "only-if-cached",
      });

      expect(res.status).toBe(504);
      expect(requestLog).toHaveLength(0);

      const body = await res.text();
      expect(body).toContain("No cached response available");

      await session.close();
    });
  });

  describe("default - follow freshness then revalidate when stale", () => {
    it("should serve fresh cached response without revalidation request", async () => {
      const session = await createFetchExtendedSession();

      // Prime cache with a fresh cacheable response.
      requestLog = [];
      const res1 = await session.fetch(`${baseUrl}/mdn-fresh`, {
        cache: "reload",
      });
      const data1 = await res1.text();
      expect(data1).toBe("mdn-fresh-body");
      expect(requestLog).toHaveLength(1);

      requestLog = [];
      const res2 = await session.fetch(`${baseUrl}/mdn-fresh`, {
        cache: "default",
      });
      const data2 = await res2.text();

      expect(data2).toBe("mdn-fresh-body");
      expect(res2.statusText).toContain("Cached");
      expect(requestLog).toHaveLength(0);

      await session.close();
    });

    it("should revalidate stale cached response with conditional request", async () => {
      const session = await createFetchExtendedSession();

      // Prime cache with a stale-immediately entry.
      requestLog = [];
      const res1 = await session.fetch(`${baseUrl}/mdn-stale`, {
        cache: "reload",
      });
      const data1 = await res1.text();
      expect(res1.statusText).not.toContain("Cached");
      expect(requestLog).toHaveLength(1);
      expect(data1).toBe("mdn-stale-body");

      // default should revalidate stale entries.
      requestLog = [];
      const res2 = await session.fetch(`${baseUrl}/mdn-stale`, {
        cache: "default",
      });
      const data2 = await res2.text();

      expect(data1).toEqual(data2);
      expect(res2.statusText).toContain("Cached");
      expect(requestLog).toHaveLength(1);
      expect(requestLog[0].headers["if-none-match"]).toBe('"mdn-stale-etag"');

      await session.close();
    });

    it("should fetch fresh response if not in cache", async () => {
      const session = await createFetchExtendedSession();

      const res = await session.fetch(`${baseUrl}/new-data`, {
        cache: "default",
      });

      expect(res.ok).toBe(true);
      expect(res.statusText).not.toContain("Cached");

      await session.close();
    });

    it("should cache response after fetching and use conditional on next request", async () => {
      const session = await createFetchExtendedSession();

      // First request with default - should fetch and cache
      requestLog = [];
      const res1 = await session.fetch(`${baseUrl}/test-default-cache`, {
        cache: "default",
      });
      const data1 = await res1.text();
      expect(res1.statusText).not.toContain("Cached");
      expect(requestLog).toHaveLength(1);

      // Second request with default - should use conditional request
      requestLog = [];
      const res2 = await session.fetch(`${baseUrl}/test-default-cache`, {
        cache: "default",
      });
      const data2 = await res2.text();
      expect(res2.statusText).toContain("Cached");
      expect(data1).toEqual(data2);
      // Should have sent conditional request header
      expect(requestLog).toHaveLength(1);
      expect(requestLog[0].headers["if-none-match"]).toBe('"test-etag"');

      await session.close();
    });

    it("should differ from force-cache on stale entries", async () => {
      const session = await createFetchExtendedSession();

      // Prime with stale-immediately response.
      requestLog = [];
      const res1 = await session.fetch(`${baseUrl}/mdn-stale`, {
        cache: "reload",
      });
      await res1.text();
      expect(requestLog).toHaveLength(1);

      // force-cache should not revalidate.
      requestLog = [];
      const resForceCache = await session.fetch(`${baseUrl}/mdn-stale`, {
        cache: "force-cache",
      });
      await resForceCache.text();
      expect(requestLog).toHaveLength(0);

      // default should revalidate stale entries.
      requestLog = [];
      const resDefault = await session.fetch(`${baseUrl}/mdn-stale`, {
        cache: "default",
      });
      await resDefault.text();
      expect(requestLog).toHaveLength(1);
      expect(requestLog[0].headers["if-none-match"]).toBe('"mdn-stale-etag"');

      await session.close();
    });
  });

  describe("no-cache - always validate with server", () => {
    it("should revalidate with validators when cached response exists", async () => {
      const session = await createFetchExtendedSession();

      // Prime cache first.
      requestLog = [];
      const res1 = await session.fetch(`${baseUrl}/mdn-fresh`, {
        cache: "reload",
      });
      await res1.text();
      expect(requestLog).toHaveLength(1);

      requestLog = [];
      const res2 = await session.fetch(`${baseUrl}/mdn-fresh`, {
        cache: "no-cache",
      });
      await res2.text();

      expect(requestLog).toHaveLength(1);
      expect(requestLog[0].headers["if-none-match"]).toBe('"mdn-fresh-etag"');

      await session.close();
    });

    it("should fetch if not in cache", async () => {
      const session = await createFetchExtendedSession();

      const res = await session.fetch(`${baseUrl}/new-endpoint-2`, {
        cache: "no-cache",
      });

      expect(res.ok).toBe(true);

      await session.close();
    });
  });

  describe("cache behavior across multiple requests", () => {
    it("should maintain separate caches for different URLs", async () => {
      const session = await createFetchExtendedSession();

      // Prime two different URLs
      const res1a = await session.fetch(`${baseUrl}/url-1`, {
        cache: "reload",
      });
      const data1a = await res1a.text();

      const res2a = await session.fetch(`${baseUrl}/url-2`, {
        cache: "reload",
      });
      const data2a = await res2a.text();

      // Retrieve from cache
      const res1b = await session.fetch(`${baseUrl}/url-1`, {
        cache: "force-cache",
      });
      const data1b = await res1b.text();

      const res2b = await session.fetch(`${baseUrl}/url-2`, {
        cache: "force-cache",
      });
      const data2b = await res2b.text();

      expect(data1a).toEqual(data1b);
      expect(data2a).toEqual(data2b);
      expect(res1b.statusText).toContain("Cached");
      expect(res2b.statusText).toContain("Cached");

      await session.close();
    });

    it("should maintain separate caches for different HTTP methods", async () => {
      const session = await createFetchExtendedSession();

      // Prime with GET
      const resGet = await session.fetch(`${baseUrl}/test-data`, {
        method: "GET",
        cache: "reload",
      });
      const dataGet = await resGet.text();

      // Retrieve GET from cache - should be cached
      const resCachedGet = await session.fetch(`${baseUrl}/test-data`, {
        method: "GET",
        cache: "force-cache",
      });
      expect(resCachedGet.statusText).toContain("Cached");
      expect(dataGet).toEqual(await resCachedGet.text());

      // Prime with POST - different cache key
      const resPost = await session.fetch(`${baseUrl}/test-data`, {
        method: "POST",
        cache: "reload",
        body: JSON.stringify({ test: true }),
        headers: { "Content-Type": "application/json" },
      });
      const dataPost = await resPost.text();

      // GET and POST should be cached separately
      const resCachedPost = await session.fetch(`${baseUrl}/test-data`, {
        method: "POST",
        cache: "force-cache",
        body: JSON.stringify({ test: true }),
        headers: { "Content-Type": "application/json" },
      });
      expect(resCachedPost.statusText).toContain("Cached");
      expect(dataPost).toEqual(await resCachedPost.text());

      await session.close();
    });
  });

  describe("integration with retry logic", () => {
    it("should cache responses from successful retries", async () => {
      const session = await createFetchExtendedSession();

      // Make request that succeeds
      const res1 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "reload",
        retry: { maxAttempts: 2 },
      });
      const data1 = await res1.text();

      // Subsequent request should use cache
      const res2 = await session.fetch(`${baseUrl}/test-data`, {
        cache: "force-cache",
      });
      const data2 = await res2.text();

      expect(data1).toEqual(data2);
      expect(res2.statusText).toContain("Cached");

      await session.close();
    });
  });
});
