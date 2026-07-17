/**
 * Vitest setup file for @liase/envoy tests.
 */

import {
  captureDebugScreenshots,
  isBrowserRunning,
  shutdownBrowser,
} from "@/src/lib/playwrightBrowser.js";
import { afterEach } from "vitest";

afterEach(async (ctx) => {
  // Take a screenshot if the test failed and there is a browser still running
  if (ctx.task?.result?.state === "fail" && isBrowserRunning()) {
    const { mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    // Create screenshots directory
    const screenshotDir = join(process.cwd(), "test-results", "screenshots");
    mkdirSync(screenshotDir, { recursive: true });

    // Capture screenshots of all active browser pages
    const screenshots = await captureDebugScreenshots(screenshotDir);

    if (screenshots.length > 0) {
      const testName = ctx.task.name || "unknown-test";
      console.log(
        `\n📸 Captured ${screenshots.length} screenshot(s) for failed test "${testName}":`,
      );
      for (const screenshot of screenshots) {
        console.log(`  - ${screenshot}`);
      }
    }
  }

  await shutdownBrowser(); // Ensure browser is shut down after each test
});
