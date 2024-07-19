import { HttpCachingProxy } from "@loopback/http-caching-proxy";
import path from "path";
import http from "http";
import { ProxyServer } from "@refactorjs/http-proxy"; // The most popular node http proxy library, and the
// one this is a refactor of, has essentially been unmaintained for the past 4 years and has some
// serious bugs.
import type { GlobalSetupContext } from "vitest/node";

// You can also extend `ProvidedContext` type
// to have type safe access to `provide/inject` methods:
declare module "vitest" {
  export interface ProvidedContext {
    cachingProxyPort: number;
  }
}

export default async function ({ provide }: GlobalSetupContext) {
  const cacheProxy = await startCacheProxy();
  const cachingProxyServerAddress = cacheProxy.url;

  const clientToCacheProxy = startClientToCacheProxy(cachingProxyServerAddress);
  const initialProxyServerAddress = clientToCacheProxy.address();
  if (
    typeof initialProxyServerAddress === "string" ||
    initialProxyServerAddress === null
  ) {
    throw Error("Could not get proxy address");
  }

  if (provide) provide("cachingProxyPort", initialProxyServerAddress.port);

  return async () => {
    await cacheProxy.stop();
    await new Promise<void>((resolve, reject) =>
      clientToCacheProxy.close((error) => (error ? reject(error) : resolve())),
    );
  };
}

function startClientToCacheProxy(
  cachingProxyServerAddress: string,
): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> {
  const proxyToCachingProxy = new ProxyServer();

  return http
    .createServer(async function (req, res) {
      // await new Promise(res => setTimeout(res, 5 * 1000))
      const realOriginHeaderName = "x-real-origin";
      const realOrigin = [req.headers[realOriginHeaderName]].flat()[0]; // Header value could be a string or an
      // array of strings so unwrap if array
      if (!realOrigin) {
        throw Error(`Received request without ${realOriginHeaderName} header`);
      }
      req.headers.host = new URL(realOrigin).hostname;
      if (!req.url) {
        throw Error("Invalid request url");
      }
      const url = new URL(req.url, realOrigin);
      // no search query since for some reason @refactorjs/http-proxy seems to add it twice if
      // set in the request url. So instead we add it to the target
      req.url = url.origin + url.pathname;
      proxyToCachingProxy.web(req, res, {
        target: {
          host: new URL(cachingProxyServerAddress).hostname,
          port: new URL(cachingProxyServerAddress).port,
          searchParams: url.searchParams,
        },
        toProxy: true,
      });
    })
    .listen(0);
}

async function startCacheProxy(): Promise<HttpCachingProxy> {
  const cachingProxyServer = new HttpCachingProxy({
    cachePath: path.resolve(__dirname, ".proxy-cache"),
    ttl: 24 * 60 * 60 * 1000, // 1 day
  });
  await cachingProxyServer.start();
  return cachingProxyServer;
}
