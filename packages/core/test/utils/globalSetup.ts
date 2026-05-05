import os from "node:os";
import path from "node:path";
import { HttpCachingProxy } from "@loopback/http-caching-proxy";
import type { GlobalSetupContext } from "vitest/node";

export async function vitestSetupCachingProxy(context: GlobalSetupContext) {
  const cachePath = path.join(os.tmpdir(), "liason/http-proxy-cache");
  const proxy = new HttpCachingProxy({ cachePath });
  await proxy.start();
  (context.provide as (key: string, value: unknown) => void)(
    "httpProxyUrl",
    proxy.url,
  );
  return async () => {
    await proxy.stop();
  };
}
