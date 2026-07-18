import cacache from "cacache";
import stringify from "json-stable-stringify";
import { parseFetchArgs } from "../lib/fetch.js";
import type { GenericFetch } from "./types.js";

const cacheDir = "/tmp/liase/network-requests-cache/fetch";

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
  etag?: string;
  lastModified?: string;
};

function getCachedResponseAsFetchResponse<TResponse extends Response>(
  cachedRes: CachedResponse,
): TResponse {
  return new Response(cachedRes.body, {
    headers: cachedRes.headers,
    status: cachedRes.statusCode,
    statusText: `Cached on: ${cachedRes.cachedOn.getTime()}`,
  }) as TResponse;
}

function getCacheControlDirectives(value?: string): Record<string, string> {
  if (!value) {
    return {};
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, directive) => {
      const [rawKey, rawValue] = directive.split("=", 2);
      const key = rawKey?.trim().toLowerCase();
      if (!key) {
        return acc;
      }
      acc[key] = rawValue?.trim() ?? "";
      return acc;
    }, {});
}

function isCachedResponseFresh(cachedRes: CachedResponse): boolean {
  const headers = cachedRes.headers;
  const cacheControl = getCacheControlDirectives(headers["cache-control"]);

  if ("no-store" in cacheControl || "no-cache" in cacheControl) {
    return false;
  }

  const maxAgeRaw = cacheControl["max-age"];
  if (maxAgeRaw) {
    const maxAge = Number.parseInt(maxAgeRaw, 10);
    if (!Number.isNaN(maxAge) && maxAge >= 0) {
      const ageMs = Date.now() - cachedRes.cachedOn.getTime();
      return ageMs <= maxAge * 1000;
    }
  }

  const expires = headers.expires;
  if (expires) {
    const expiresAt = Date.parse(expires);
    if (!Number.isNaN(expiresAt)) {
      return expiresAt > Date.now();
    }
  }

  return false;
}

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

/**
 * Revalidate a cached response using conditional requests (If-None-Match, If-Modified-Since).
 * Returns the cached response if server confirms it's fresh (304), or the new response if stale.
 */
async function revalidateCachedResponse<
  TInit extends RequestInit,
  TResponse extends Response,
>(
  baseFetch: GenericFetch<TInit, TResponse>,
  input: RequestInfo | URL,
  init: TInit | undefined,
  cachedRes: CachedResponse,
  headers: Record<string, string>,
): Promise<{ response: TResponse; servedFromCache: boolean }> {
  const conditionalHeaders = { ...headers };

  // Add conditional request headers based on cached response
  if (cachedRes.etag) {
    conditionalHeaders["If-None-Match"] = cachedRes.etag;
  }
  if (cachedRes.lastModified) {
    conditionalHeaders["If-Modified-Since"] = cachedRes.lastModified;
  }

  const hasValidators = Boolean(cachedRes.etag || cachedRes.lastModified);
  const revalidationInit = hasValidators
    ? ({ ...init, headers: conditionalHeaders } as TInit)
    : init;
  const revalidationRes = await baseFetch(input, revalidationInit);

  // 304 means cached response is still fresh
  if (revalidationRes.status === 304) {
    return {
      response: getCachedResponseAsFetchResponse<TResponse>(cachedRes),
      servedFromCache: true,
    };
  }

  // Otherwise return the fresh response
  return {
    response: revalidationRes,
    servedFromCache: false,
  };
}

async function cacheSuccessfulResponse<TResponse extends Response>(
  req: CacheableRequest,
  res: TResponse,
  headers: Record<string, string>,
) {
  if (!res.ok) {
    return;
  }

  const clonedRes = res.clone();
  await cacheResponse(req, {
    statusCode: clonedRes.status,
    body: await clonedRes.text(),
    headers: Object.fromEntries(clonedRes.headers.entries()),
    etag: clonedRes.headers.get("etag") ?? undefined,
    lastModified: clonedRes.headers.get("last-modified") ?? undefined,
    request: {
      headers,
    },
  });
}

/**
 * Wrap a fetch function to implement standard fetch cache options using local storage.
 * Supports: 'default' (try cache first, revalidate with server if cached), 'no-store' (never cache),
 * 'force-cache' (use cached without revalidation), 'only-if-cached' (fail if not cached).
 */
export function wrapFetchWithCachingLogic<
  TInit extends RequestInit,
  TResponse extends Response,
>(
  baseFetch: GenericFetch<TInit, TResponse>,
  defaultCacheOption?: RequestCache,
): GenericFetch<TInit, TResponse> {
  return async (input, init) => {
    const cacheOption = init?.cache ?? defaultCacheOption ?? "default";

    const { url, method, headers, body } = parseFetchArgs(input, init);
    const resolvedBody =
      typeof body === "string"
        ? body
        : body instanceof Promise
          ? await body
          : await body;

    const cacheableRequest = {
      url: url.href,
      body: resolvedBody,
      headers,
      method,
    };

    // Handle default: use fresh cache; stale cache is revalidated with server.
    if (cacheOption === "default") {
      const cachedRes = await getCachedResponse(cacheableRequest);
      if (cachedRes) {
        if (isCachedResponseFresh(cachedRes)) {
          return getCachedResponseAsFetchResponse<TResponse>(cachedRes);
        }

        const { response: revalidatedRes, servedFromCache } =
          await revalidateCachedResponse(
            baseFetch,
            input,
            init,
            cachedRes,
            headers,
          );
        if (!servedFromCache) {
          await cacheSuccessfulResponse(
            cacheableRequest,
            revalidatedRes,
            headers,
          );
        }
        return revalidatedRes;
      }
      // No cached response, fall through to fetch fresh
    }

    // Handle no-cache: always revalidate with origin if cache exists.
    if (cacheOption === "no-cache") {
      const cachedRes = await getCachedResponse(cacheableRequest);
      if (cachedRes) {
        const { response: revalidatedRes, servedFromCache } =
          await revalidateCachedResponse(
            baseFetch,
            input,
            init,
            cachedRes,
            headers,
          );
        if (!servedFromCache) {
          await cacheSuccessfulResponse(
            cacheableRequest,
            revalidatedRes,
            headers,
          );
        }
        return revalidatedRes;
      }
    }

    // Handle 'force-cache' and 'only-if-cached': try cache first without revalidation
    if (cacheOption === "force-cache" || cacheOption === "only-if-cached") {
      const cachedRes = await getCachedResponse(cacheableRequest);
      if (cachedRes) {
        return getCachedResponseAsFetchResponse<TResponse>(cachedRes);
      }
      if (cacheOption === "only-if-cached") {
        return new Response(
          `No cached response available for ${cacheableRequest.url}`,
          {
            status: 504,
            statusText: "Gateway Timeout",
            headers: { "content-type": "text/plain" },
          },
        ) as TResponse;
      }
    }

    // For 'no-store', skip caching entirely
    if (cacheOption === "no-store") {
      return baseFetch(input, init);
    }

    const res = await baseFetch(input, init);

    await cacheSuccessfulResponse(cacheableRequest, res, headers);

    return res;
  };
}
