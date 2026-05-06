import os from "node:os";
import path from "node:path";
import { HttpCachingProxy } from "@loopback/http-caching-proxy";

export async function vitestSetupCachingProxy(context: {
  provide: (key: string, value: unknown) => void;
}) {
  const cachePath = path.join(os.tmpdir(), "liase/http-proxy-cache");
  const proxy = new HttpCachingProxy({ cachePath });
  await proxy.start();
  context.provide("httpProxyUrl", proxy.url);
  return async () => {
    await proxy.stop();
  };
}
