import { Plugin } from "@/src/schemas/plugin.js";
import { HttpCachingProxy } from "@loopback/http-caching-proxy";
import NodeFetchCache, { FileSystemCache } from "node-fetch-cache";
import path from "path";
import http from "http";
import { ProxyServer } from "@refactorjs/http-proxy"; // The most popular node http proxy library, and the
// one this is a refactor of, has essentially been unmaintained for the past 4 years and has some
// serious bugs.
import { Request as NodeFetchRequest } from "node-fetch";

let cachingProxyPort: number;

const cacheDir = path.resolve(import.meta.dirname, ".proxy-cache");

const cachingFetch = NodeFetchCache.create({
  cache: new FileSystemCache({
    cacheDirectory: cacheDir,
    ttl: 60 * 60 * 1000, // Cache for 1 hour
  }),
});

// NodeFetchCache is meant to be a superset of node-fetch but it seems there are a few request formats
// it can't handle. So if we attempt to convert any unsupported requests before passing to NodeFetchCache.
const cachingFetchWrapper = (
  resource: Parameters<typeof fetch>[0] | NodeFetchRequest,
  options: Parameters<typeof cachingFetch>[1],
  ...otherArgs: any[]
) => {
  // Convert resource if no compatible
  if (resource instanceof URL) {
    resource = resource.href;
  } else if (resource instanceof Request) {
    const { url, headers, body, ...options } = resource;
    if (body) {
      throw Error();
    }
    resource = new NodeFetchRequest(url, {
      body,
      headers: Object.fromEntries(headers.entries()),
      ...options,
    });
  }
  // Convert options if no compatible
  if (
    options?.body instanceof Uint8Array &&
    !(options?.body instanceof Buffer)
  ) {
    options = {
      ...options,
      body: Buffer.from(options.body),
    };
  }
  return cachingFetch(resource, options, ...otherArgs);
};

export default {
  hooks: {
    loadUrl: (options, next) => {
      if (cachingProxyPort) {
        const targetUrl = new URL(options.url);
        options.url = `http://localhost:${cachingProxyPort}${targetUrl.pathname}${targetUrl.search}`;
        options.headers = options.headers ?? {};
        options.headers["x-real-origin"] = targetUrl.origin;
      } else {
        console.warn("Caching proxy not setup yet");
      }
      return next(options);
    },
    getFetchClient: (fetchClient, next) =>
      next(fetchClient ?? cachingFetchWrapper),
  },
} satisfies Plugin;

export async function setupCachingProxy() {
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
  cachingProxyPort = initialProxyServerAddress.port;

  return {
    cachingProxyPort,
    cleanup: async () => {
      await cacheProxy.stop();
      await new Promise<void>((resolve, reject) =>
        clientToCacheProxy.close((error) =>
          error ? reject(error) : resolve(),
        ),
      );
    },
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
    cachePath: cacheDir,
    ttl: 24 * 60 * 60 * 1000, // 1 day
  });
  await cachingProxyServer.start();
  return cachingProxyServer;
}

// Used in situations when setupCachingProxy is run in a different process to the one the hook is running in.
export function setCachingProxyPort(port: number) {
  cachingProxyPort = port;
}

export function cachingProxyDetected() {
  return typeof cachingProxyPort === "number";
}
