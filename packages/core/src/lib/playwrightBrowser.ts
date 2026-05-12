/**
 * Lazy-started, shared Playwright browser instance.
 *
 * - Browser is launched on first `getPage()` call.
 * - The browser is kept alive across calls to amortise startup cost.
 * - If no pages are open and no new request arrives within IDLE_TIMEOUT_MS,
 *   the browser is shut down automatically.
 * - Callers must call `releasePage(page)` when done so the idle timer can
 *   start. Calling `releasePage` also closes the page to free resources.
 */

import type { Browser, BrowserContext, Page } from "playwright";

const IDLE_TIMEOUT_MS = 60_000; // 1 minute

// Lazy-imported so playwright is only required when actually needed.
let chromium: typeof import("playwright")["chromium"] | undefined;

let browser: Browser | undefined;
let context: BrowserContext | undefined;
let activePageCount = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

async function ensureBrowser(): Promise<BrowserContext> {
  if (!chromium) {
    // Dynamic import so playwright isn't required in environments that don't need it
    ({ chromium } = await import("playwright"));
  }
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      // headless:false + --headless=new uses full Chrome binary which passes
      // Kasada/bot detection checks that headless_shell fails.
      headless: false,
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    await context.addInitScript(() => {
      // Remove the webdriver flag that bot-detection scripts look for
      // biome-ignore lint/suspicious/noExplicitAny: init script runs in browser context, globalThis.navigator requires any cast
      Object.defineProperty((globalThis as any).navigator, "webdriver", {
        get: () => undefined,
      });
    });
  }
  // biome-ignore lint/style/noNonNullAssertion: context is always set after ensureBrowser
  return context!;
}

function cancelIdleTimer() {
  if (idleTimer !== undefined) {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }
}

function scheduleIdleShutdown() {
  cancelIdleTimer();
  if (activePageCount === 0) {
    idleTimer = setTimeout(async () => {
      await shutdownBrowser();
    }, IDLE_TIMEOUT_MS);
  }
}

/**
 * Opens a new page in the shared browser context.
 * Callers MUST call `releasePage(page)` when finished.
 */
export async function getPage(): Promise<Page> {
  cancelIdleTimer();
  const ctx = await ensureBrowser();
  const page = await ctx.newPage();
  activePageCount++;
  return page;
}

/**
 * Closes the page and decrements the active-page counter.
 * Starts the idle shutdown timer if no pages remain open.
 */
export async function releasePage(page: Page): Promise<void> {
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } finally {
    activePageCount = Math.max(0, activePageCount - 1);
    scheduleIdleShutdown();
  }
}

/**
 * Immediately shuts down the browser.
 * Exported for use in tests and process cleanup.
 */
export async function shutdownBrowser(): Promise<void> {
  cancelIdleTimer();
  activePageCount = 0;
  if (browser) {
    const b = browser;
    browser = undefined;
    context = undefined;
    await b.close();
  }
}

/** Returns true if the browser is currently running. Useful in tests. */
export function isBrowserRunning(): boolean {
  return Boolean(browser?.isConnected());
}
