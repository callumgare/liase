import type { Page } from "playwright";
import { CacheRoute } from "playwright-network-cache";
import type { CachedResponseStrategy } from "../envoy.js";

const playwrightCacheDir = "/tmp/liase/network-requests-cache/playwright";

export function assertPlaywrightCacheStrategySupported(
  strategy?: CachedResponseStrategy,
) {
  if (strategy === "exclusively") {
    throw Error(
      'cachedResponseStrategy "exclusively" is not supported for Playwright requests.',
    );
  }
}

export async function applyPlaywrightNetworkCache(
  page: Page,
  url: string,
  strategy?: CachedResponseStrategy,
) {
  assertPlaywrightCacheStrategySupported(strategy);

  // Preserve existing Playwright behavior unless a strategy is explicitly set.
  if (strategy === undefined) {
    return;
  }

  const cacheRoute = new CacheRoute(page, {
    baseDir: playwrightCacheDir,
  });

  const urlPattern = `${new URL(url).origin}/**`;

  switch (strategy) {
    case "never":
      await cacheRoute.ALL(urlPattern, {
        noCache: true,
      });
      return;
    case "if-fresh":
      // This package does not read Cache-Control headers, so we force
      // per-request revalidation-like behavior by expiring entries immediately.
      await cacheRoute.ALL(urlPattern, {
        ttlMinutes: 0,
      });
      return;
    case "if-cached":
      await cacheRoute.ALL(urlPattern);
      return;
    case "exclusively":
      throw Error(
        'cachedResponseStrategy "exclusively" is not supported for Playwright requests.',
      );
    default:
      throw Error(`Unknown cached response strategy: ${strategy}`);
  }
}
