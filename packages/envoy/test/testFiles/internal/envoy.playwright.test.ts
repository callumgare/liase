/**
 * Tests for the Playwright `responseType: "page"` support in envoy.
 *
 * These tests verify:
 * 1. envoy returns a Page object for responseType:"page"
 * 2. The page can be used interactively (fill, click, navigate)
 * 3. close() releases the page
 * 4. The browser is lazily started (not running before first call)
 * 5. shutdownBrowser() immediately closes the browser
 */

import { type Server, createServer } from "node:http";
import { envoy } from "@/src/envoy.js";
import { PlaywrightDomSelection } from "@/src/lib/dom/PlaywrightDomSelection.js";
import {
  isBrowserRunning,
  shutdownBrowser,
} from "@/src/lib/playwrightBrowser.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// envoy uses `this.cacheNetworkRequests`; bind a minimal context and cast to
// preserve the overload signatures (envoy.call() drops overload dispatch).
const callCtx = { cacheNetworkRequests: "never" as const };
const boundEnvoy = envoy.bind(callCtx) as typeof envoy;

// Simple HTML server for testing page interaction
let server: Server;
let serverUrl: string;

function startTestServer() {
  return new Promise<void>((resolve) => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html>
<head><title>Playwright Test Page</title></head>
<body>
  <h1 id="heading">Hello from test server</h1>
  <input id="text-input" type="text" />
  <button id="submit-btn" onclick="document.getElementById('result').textContent = document.getElementById('text-input').value">
    Submit
  </button>
  <p id="result"></p>
</body>
</html>`);
    }).listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function stopTestServer() {
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

describe("envoy with responseType: page (Playwright)", () => {
  beforeEach(async () => {
    await startTestServer();
    // Ensure browser is not running before each test
    await shutdownBrowser();
  });

  afterEach(async () => {
    await shutdownBrowser();
    await stopTestServer();
  });

  it("returns a page response with correct shape", async () => {
    const result = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    expect(result.finalUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(result.statusCode).toBe(200);
    expect(result.cached).toBe(false);
    expect(result.cachedOn).toBe(null);
    expect(typeof result.close).toBe("function");
    expect(typeof result.html).toBe("function");
    expect(typeof result.title).toBe("function");
    expect(typeof result.refetch).toBe("function");
    expect(typeof result.refresh).toBe("function");
    expect(typeof result.screenshot).toBe("function");
    expect(typeof result.waitForUrl).toBe("function");

    expect(result.requestedUrl).toBe(serverUrl);
    await result.close();
  });

  it("dom selection can read DOM content", async () => {
    const { dom, close } = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const selection = await dom;
    expect(assertNode(selection.getFirst("#heading")).text).toBe(
      "Hello from test server",
    );

    await close();
  });

  it("dom selection supports interactive fill and click", async () => {
    const { dom, html, close } = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const selection = await dom;
    await assertNode(selection.getFirst("#text-input")).fill(
      "hello playwright",
    );
    await assertNode(selection.getFirst("#submit-btn")).click();

    const renderedHtml = await html();
    expect(renderedHtml).toContain('<p id="result">hello playwright</p>');

    await close();
  });

  it("browser is lazily started — not running before first call", async () => {
    expect(isBrowserRunning()).toBe(false);

    const { close } = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    expect(isBrowserRunning()).toBe(true);
    await close();
  });

  it("browser stays alive between consecutive page requests", async () => {
    const r1 = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });
    await r1.close();

    expect(isBrowserRunning()).toBe(true);

    const r2 = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });
    await r2.close();

    expect(isBrowserRunning()).toBe(true);
  });

  it("shutdownBrowser() immediately stops the browser", async () => {
    const { close } = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });
    await close();

    expect(isBrowserRunning()).toBe(true);
    await shutdownBrowser();
    expect(isBrowserRunning()).toBe(false);
  });

  it("passing extra HTTP headers forwards them in the request", async () => {
    let receivedHeader: string | undefined;
    server.on("request", (req) => {
      receivedHeader = req.headers["x-test-header"] as string | undefined;
    });

    const { close } = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
      headers: { "x-test-header": "test-value" },
    });
    await close();

    expect(receivedHeader).toBe("test-value");
  });

  it("dom getter returns a PlaywrightDomSelection with correct DOM content", async () => {
    const result = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const dom = await result.dom;

    expect(dom).toBeInstanceOf(PlaywrightDomSelection);
    expect(assertNode(dom.getFirst("#heading")).text).toBe(
      "Hello from test server",
    );
    expect((await result.root).matches("html")).toBe(true);

    await result.close();
  });

  it("dom getter caches the result — returns the same instance on repeated access", async () => {
    const result = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const dom1 = await result.dom;
    const dom2 = await result.dom;

    expect(dom1).toBe(dom2);

    await result.close();
  });
});
