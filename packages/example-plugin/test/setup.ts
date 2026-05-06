import { vitestSetupCachingProxy } from "@liase/core/dist/test/utils/globalSetup.js";
import type { GlobalSetupContext } from "vitest/node";

export default async function (context: GlobalSetupContext) {
  const cleanup = await vitestSetupCachingProxy(context);

  return async () => {
    await cleanup();
  };
}
