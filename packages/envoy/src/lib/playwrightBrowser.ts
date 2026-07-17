/**
 * Lazy-started, shared Playwright browser instance.
 *
 * - Browser is launched on first `getPage()` call.
 * - The browser is kept alive across calls to amortise startup cost.
 * - If no pages are open and no new request arrives within IDLE_TIMEOUT_MS,
 *   the browser is shut down automatically.
 * - Callers must call `releasePage(page)` when done so the idle timer can
 *   start. Calling `releasePage` also closes the page to free resources.
 * - Storage state (cookies, localStorage) is persisted to disk by default so
 *   sessions survive across runs. Configure with `configureBrowser()`.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";

const IDLE_TIMEOUT_MS = 60_000; // 1 minute

/** Default path for persisting browser storage state between runs. */
const DEFAULT_STORAGE_STATE_PATH = join(
  homedir(),
  ".cache",
  "liase",
  "playwright-storage-state.json",
);

interface BrowserConfig {
  /**
   * Path to persist Playwright storage state (cookies, localStorage) between
   * runs. Defaults to `~/.cache/liase/playwright-storage-state.json`.
   * Pass `null` to disable persistence.
   */
  storageStatePath: string | null;
}

let config: BrowserConfig = {
  storageStatePath: DEFAULT_STORAGE_STATE_PATH,
};

/**
 * Configure global browser options.
 *
 * @example
 * // Use a custom path
 * configureBrowser({ storageStatePath: '/tmp/my-browser-state.json' });
 *
 * @example
 * // Disable persistence entirely
 * configureBrowser({ storageStatePath: null });
 */
export function configureBrowser(options: Partial<BrowserConfig>): void {
  config = { ...config, ...options };
}

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
    const { storageStatePath } = config;
    const storageState =
      storageStatePath && existsSync(storageStatePath)
        ? storageStatePath
        : undefined;
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      storageState,
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
 * Saves the current browser context's storage state (cookies, localStorage)
 * to disk at the configured path. No-op if persistence is disabled or no
 * context is open.
 */
async function saveStorageState(): Promise<void> {
  const { storageStatePath } = config;
  if (!storageStatePath || !context) return;
  try {
    const state = await context.storageState();
    mkdirSync(dirname(storageStatePath), { recursive: true });
    writeFileSync(storageStatePath, JSON.stringify(state), "utf-8");
  } catch {
    // Non-fatal — a failure to persist state should not break the caller.
  }
}

/**
 * Closes the page and decrements the active-page counter.
 * Persists storage state to disk then starts the idle shutdown timer if no
 * pages remain open.
 */
export async function releasePage(page: Page): Promise<void> {
  try {
    if (!page.isClosed()) {
      await page.close();
    }
    await saveStorageState();
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

/**
 * Captures screenshots of all active pages in the browser context.
 * Useful for debugging test failures. Screenshots are saved with a timestamp
 * and page title in the specified directory.
 *
 * @param outputDir - Directory to save screenshots (will be created if needed)
 * @returns Array of paths to the saved screenshot files
 */
export async function captureDebugScreenshots(
  outputDir: string,
): Promise<string[]> {
  if (!browser || !context || !browser.isConnected()) {
    return [];
  }

  const { mkdirSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const pages = context.pages();
  const screenshots: string[] = [];

  for (const page of pages) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const title = await page.title().catch(() => "untitled");
      const safeTitle = title.replace(/[^a-z0-9]/gi, "-").slice(0, 50);
      const filename = `screenshot-${timestamp}-${safeTitle}.png`;
      const filepath = join(outputDir, filename);

      await page.screenshot({ path: filepath, fullPage: true });
      screenshots.push(filepath);
    } catch {
      // Ignore errors for individual pages — continue with others
    }
  }

  return screenshots;
}
