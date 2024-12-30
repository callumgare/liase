import cacache from "cacache";
import { QueryOptions } from "../schemas/queryOptions.js";
import stringify from "json-stable-stringify";
import { OptionsInit as GotOptionsInit } from "got-scraping";

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
};

export async function getCachedResponse(
  req: CacheableRequest,
): Promise<CachedResponse | undefined> {
  const key = getCacheKeyFromReq(req);
  try {
    const { data } = await cacache.get(cacheDir, key);
    return JSON.parse(data.toString());
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
  res: CachedResponse,
) {
  const key = getCacheKeyFromReq(req);
  await cacache.put(
    cacheDir,
    key,
    JSON.stringify({
      body: res.body,
      statusCode: res.statusCode,
    }),
  );
}

function getCacheKeyFromReq(req: CacheableRequest): string {
  return (
    stringify([req.url, req.method, Object.entries(req.headers), req.body]) ||
    ""
  );
}

export function getCachingFetch(
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

    let url, body, headers, method;
    if (typeof input === "string" || input instanceof URL) {
      url = input instanceof URL ? input.href : input;
      if (!init || !init.body) {
        body = "";
      } else if (init.body instanceof URLSearchParams) {
        body = init.body.toString();
      } else if (init.body instanceof FormData) {
        body = init.body.toString();
      } else if (typeof init.body === "object") {
        throw Error(
          "Only string, URLSearchParams and FormData type bodies are currently supported. Sorry!",
        );
      } else {
        body = init.body;
      }
      headers = init?.headers
        ? // @ts-expect-error Not sure why typescript is concerned by this
          (Object.fromEntries(Array.from(init.headers.entries())) as Record<
            string,
            string
          >)
        : {};
      method = init?.method ?? "";
    } else if (input instanceof Request) {
      const clonedRequest = input.clone();
      url = clonedRequest.url;
      body = (await clonedRequest.text()) ?? "";
      headers = Object.fromEntries(
        // @ts-expect-error Not sure why typescript is concerned by this
        Array.from(clonedRequest.headers.entries()),
      ) as Record<string, string>;
      // headers = headers as Record<string, string>
      method = clonedRequest.method;
    } else {
      input satisfies never;
      throw Error("Input is invalid");
    }

    const cacheableRequest = {
      url,
      body,
      headers,
      method,
      headerGeneratorOptions: undefined,
    };

    let res;
    if (cacheNetworkRequests === "always") {
      res = await getCachedResponse(cacheableRequest);
    } else {
      cacheNetworkRequests satisfies "never" | undefined;
    }
    if (res) {
      return new Response(res.body, init);
    }
    res = await fetch(input, init);
    if (cacheNetworkRequests === "always") {
      const clonedRes = res.clone();
      await cacheResponse(cacheableRequest, {
        statusCode: clonedRes.status,
        body: await clonedRes.text(),
      });
    } else {
      cacheNetworkRequests satisfies "never" | undefined;
    }
    return res;
  };
}
