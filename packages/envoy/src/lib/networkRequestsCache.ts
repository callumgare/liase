import cacache from "cacache";
import stringify from "json-stable-stringify";
import { headersToNormalisedBasicObject, parseFetchArgs } from "./fetch.js";

export type CacheNetworkRequests = "never" | "auto" | "always" | undefined;

const cacheDir = "/tmp/liase/network-requests-cache/custom";

type CacheableRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

type CachedResponse = {
  body: string;
  statusCode: number;
  headers: Record<string, string>;
  cachedOn: Date;
  request: {
    headers: Record<string, string>;
  };
};

export async function getCachedResponse(
  req: CacheableRequest,
): Promise<CachedResponse | undefined> {
  const key = getCacheKeyFromReq(req);
  try {
    const { data } = await cacache.get(cacheDir, key);
    const cachedValue = JSON.parse(data.toString());
    return {
      ...cachedValue,
      cachedOn: new Date(cachedValue.cachedOn),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

export async function cacheResponse(
  req: CacheableRequest,
  res: Omit<CachedResponse, "cachedOn">,
) {
  const key = getCacheKeyFromReq(req);
  const value: Omit<CachedResponse, "cachedOn"> & { cachedOn: number } = {
    ...res,
    cachedOn: Date.now(),
  };
  await cacache.put(cacheDir, key, JSON.stringify(value));
}

function getCacheKeyFromReq(req: CacheableRequest): string {
  return (
    stringify([req.url, req.method, Object.entries(req.headers), req.body]) ||
    ""
  );
}

export function addCachingFetchWrapper(
  originalFetch: typeof fetch,
  cacheNetworkRequests: CacheNetworkRequests,
): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    if (cacheNetworkRequests === "auto") {
      throw Error(
        `The "auto" value for the cacheNetworkRequests option is not yet supported. Sorry!`,
      );
    }

    const { url, body, headers, method } = parseFetchArgs(input, init);

    const cacheableRequest = {
      url: url.href,
      body: await body,
      headers,
      method,
    };

    let res: Response | CachedResponse | undefined;
    if (cacheNetworkRequests === "always") {
      res = await getCachedResponse(cacheableRequest);
      if (res) {
        return new Response(res.body, {
          headers: res.headers,
          status: res.statusCode,
          statusText: `Cached on: ${res.cachedOn.getTime()}`,
        });
      }
    } else {
      cacheNetworkRequests satisfies "never" | undefined;
    }
    res = await originalFetch(input, init);
    if (cacheNetworkRequests === "always") {
      const clonedRes = res.clone();
      await cacheResponse(cacheableRequest, {
        statusCode: clonedRes.status,
        body: await clonedRes.text(),
        headers: headersToNormalisedBasicObject(clonedRes.headers),
        request: {
          headers,
        },
      });
    } else {
      cacheNetworkRequests satisfies "never" | undefined;
    }
    return res;
  };
}
