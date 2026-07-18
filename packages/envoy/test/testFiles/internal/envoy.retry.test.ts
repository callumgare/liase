import { type Server, createServer } from "node:http";
import { envoy } from "@/src/envoy.js";
import { shutdownBrowser } from "@/src/lib/playwrightBrowser.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("envoy retry functionality", () => {
  describe("fetch with retry", () => {
    let server: Server;
    let serverUrl: string;
    let requestCount = 0;
    let responseStatus = 200;
    let shouldFailUntilAttempt = 0;

    beforeEach(async () => {
      requestCount = 0;
      responseStatus = 200;
      shouldFailUntilAttempt = 0;

      return new Promise<void>((resolve) => {
        server = createServer((req, res) => {
          requestCount++;

          // Fail for configured attempts, then succeed
          if (requestCount <= shouldFailUntilAttempt) {
            res.writeHead(responseStatus, { "Content-Type": "text/html" });
            res.end(
              `<!doctype html><html><head><title>Failed</title></head><body>Error ${requestCount}</body></html>`,
            );
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              `<!doctype html><html><head><title>Success</title></head><body>Success after ${requestCount} attempts</body></html>`,
            );
          }
        }).listen(0, "127.0.0.1", () => {
          const addr = server.address() as { port: number };
          serverUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterEach(async () => {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    });

    it("retries on 5xx status and succeeds after retry", async () => {
      requestCount = 0;
      shouldFailUntilAttempt = 1;
      responseStatus = 500;

      const result = await envoy(serverUrl, {
        responseType: "dom",
        retry: {
          maxAttempts: 3,
          backoff: { delay: 10, multiplier: 1 }, // Short delays for testing
          resToRetry: { statusCode: "5xx" },
        },
      });

      expect(result.type).toBe("dom");
      expect(requestCount).toBe(2); // 1 failed + 1 success
      expect(result.root.text).toContain("Success after 2 attempts");
    });

    it("returns normally when no retry config is provided", async () => {
      requestCount = 0;
      shouldFailUntilAttempt = 0;
      responseStatus = 200;

      const result = await envoy(serverUrl, { responseType: "dom" });

      expect(result.type).toBe("dom");
      expect(requestCount).toBe(1);
    });
  });

  describe("Playwright with retry", () => {
    let server: Server;
    let serverUrl: string;
    let requestCount = 0;
    let responseStatus = 200;
    let shouldFailUntilAttempt = 0;

    beforeEach(async () => {
      // Clean up browser before test
      await shutdownBrowser();
      requestCount = 0;
      responseStatus = 200;
      shouldFailUntilAttempt = 0;

      return new Promise<void>((resolve) => {
        server = createServer((req, res) => {
          requestCount++;

          // Fail for configured attempts, then succeed
          if (requestCount <= shouldFailUntilAttempt) {
            res.writeHead(responseStatus, { "Content-Type": "text/html" });
            res.end(
              `<!doctype html><html><head><title>Failed</title></head><body>Error ${requestCount}</body></html>`,
            );
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              `<!doctype html><html><head><title>Success</title></head><body>Success after ${requestCount} attempts</body></html>`,
            );
          }
        }).listen(0, "127.0.0.1", () => {
          const addr = server.address() as { port: number };
          serverUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await shutdownBrowser();
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    });

    it("retries on 5xx status and succeeds after retry", async () => {
      requestCount = 0;
      shouldFailUntilAttempt = 1;
      responseStatus = 500;

      const result = await envoy(serverUrl, {
        agent: "playwright",
        responseType: "rendered dom",
        retry: {
          maxAttempts: 3,
          resToRetry: { statusCode: "5xx" },
        },
      });

      expect(result.type).toBe("rendered dom");
      // Playwright may make additional requests (favicon, etc.), but we should see at least 2 page.goto calls
      expect(requestCount).toBeGreaterThanOrEqual(2);
      const text = await result.root.then((r) => r.text);
      expect(text).toContain("Success after");
      await result.close();
    });

    it("respects maxAttempts", async () => {
      requestCount = 0;
      shouldFailUntilAttempt = 10; // Will always fail
      responseStatus = 503;

      try {
        const result = await envoy(serverUrl, {
          agent: "playwright",
          responseType: "rendered dom",
          retry: {
            maxAttempts: 2,
            resToRetry: { statusCode: "5xx" },
          },
        });
        await result.close();
        // If we get here, the test should fail
        expect.fail("Should have thrown RetriesExhausted");
      } catch (error) {
        // Expected - retries should be exhausted
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Retries exhausted");
      }

      // Should have retried 2 times
      expect(requestCount).toBeGreaterThanOrEqual(2);
    });

    it("returns normally without retry config", async () => {
      requestCount = 0;
      shouldFailUntilAttempt = 0;
      responseStatus = 200;

      const result = await envoy(serverUrl, {
        agent: "playwright",
        responseType: "rendered dom",
      });

      expect(result.type).toBe("rendered dom");
      expect(requestCount).toBeGreaterThanOrEqual(1);
      await result.close();
    });
  });
});
