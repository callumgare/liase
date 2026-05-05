import cacache from "cacache";
import { QueryOptions } from "../schemas/queryOptions.js";
import stringify from "json-stable-stringify";
import { OptionsInit as GotOptionsInit } from "got-scraping";
import { headersToNormalisedBasicObject, parseFetchArgs } from "./fetch.js";

const cacheDir = "/tmp/media-finder/network-requests-cache/custom";

type CacheableRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  // Since the cache uses request headers before got has made any modifications changes to
  // headerGeneratorOptions which impact got's generated headers won't break the cache.
  // To get around this we include headerGeneratorOptions in the cache key.
  headerGeneratorOptions: GotOptionsInit["headerGeneratorOptions"];
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
  cacheNetworkRequests: QueryOptions["cacheNetworkRequests"],
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
      headerGeneratorOptions: undefined,
    };

    let res;
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
