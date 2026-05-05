import type { GlobalSetupContext } from "vitest/node";
import { vitestSetupCachingProxy } from "media-finder/dist/test/setup.js";

export default async function (context: GlobalSetupContext) {
  const cleanup = await vitestSetupCachingProxy(context);

  return async () => {
    await cleanup();
  };
}
