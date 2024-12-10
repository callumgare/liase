import type { GlobalSetupContext } from "vitest/node";
import "vitest";
import { setupCachingProxy } from "@/src/plugins/cache-network.js";

export default async function (context: GlobalSetupContext) {
  const cleanup = await vitestSetupCachingProxy(context);

  return async () => {
    await cleanup();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    cachingProxyPort: number;
  }
}

export async function vitestSetupCachingProxy({ provide }: GlobalSetupContext) {
  const { cleanup, cachingProxyPort } = await setupCachingProxy();

  provide("cachingProxyPort", cachingProxyPort);

  return async () => {
    await cleanup();
  };
}
