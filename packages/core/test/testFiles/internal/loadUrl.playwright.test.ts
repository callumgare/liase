/**
 * Tests for the Playwright `responseType: "page"` support in loadUrl.
 *
 * These tests verify:
 * 1. loadUrl returns a Page object for responseType:"page"
 * 2. The page can be used interactively (fill, click, navigate)
 * 3. close() releases the page
 * 4. The browser is lazily started (not running before first call)
 * 5. shutdownBrowser() immediately closes the browser
 */

import { type Server, createServer } from "node:http";
import { PlaywrightDomSelection } from "@/src/DomSelection.js";
import {
  isBrowserRunning,
  shutdownBrowser,
} from "@/src/lib/playwrightBrowser.js";
import { loadUrl } from "@/src/loadUrl.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// loadUrl uses `this.cacheNetworkRequests`; bind a minimal context and cast to
// preserve the overload signatures (loadUrl.call() drops overload dispatch).
const callCtx = { cacheNetworkRequests: "never" as const };
const boundLoadUrl = loadUrl.bind(callCtx) as typeof loadUrl;

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

describe("loadUrl with responseType: page (Playwright)", () => {
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
    const result = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });

    expect(result.page).toBeDefined();
    expect(result.finalUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(result.statusCode).toBe(200);
    expect(result.cached).toBe(false);
    expect(result.cachedOn).toBe(null);
    expect(typeof result.close).toBe("function");

    await result.close();
  });

  it("page object is interactive — can read DOM content", async () => {
    const { page, close } = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });

    const heading = await page.locator("#heading").textContent();
    expect(heading).toBe("Hello from test server");

    await close();
  });

  it("page supports interactive fill and click", async () => {
    const { page, close } = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });

    await page.fill("#text-input", "hello playwright");
    await page.click("#submit-btn");

    const resultText = await page.locator("#result").textContent();
    expect(resultText).toBe("hello playwright");

    await close();
  });

  it("browser is lazily started — not running before first call", async () => {
    expect(isBrowserRunning()).toBe(false);

    const { close } = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });

    expect(isBrowserRunning()).toBe(true);
    await close();
  });

  it("browser stays alive between consecutive page requests", async () => {
    const r1 = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });
    await r1.close();

    expect(isBrowserRunning()).toBe(true);

    const r2 = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });
    await r2.close();

    expect(isBrowserRunning()).toBe(true);
  });

  it("shutdownBrowser() immediately stops the browser", async () => {
    const { close } = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
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

    const { close } = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
      headers: { "x-test-header": "test-value" },
    });
    await close();

    expect(receivedHeader).toBe("test-value");
  });

  it("root getter returns a PlaywrightDomSelection with correct DOM content", async () => {
    const result = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });

    const root = await result.root;

    expect(root).toBeInstanceOf(PlaywrightDomSelection);
    expect(root.select("#heading").text).toBe("Hello from test server");

    await result.close();
  });

  it("root getter caches the result — returns the same instance on repeated access", async () => {
    const result = await boundLoadUrl(serverUrl, {
      agent: "playwright",
      responseType: "page",
    });

    const root1 = await result.root;
    const root2 = await result.root;

    expect(root1).toBe(root2);

    await result.close();
  });
});
