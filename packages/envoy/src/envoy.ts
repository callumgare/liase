import * as cheerio from "cheerio";
import type {
  UrlResAny,
  UrlResDom,
  UrlResJson,
  UrlResRenderedDom,
  UrlResText,
} from "./UrlRes.js";
import {
  type FetchExtended,
  createFetchExtendedSession,
  fetchExtended,
} from "./fetchExtended/index.js";
import type {
  FetchExtendedRequestInit,
  FetchExtendedSessionOptions,
} from "./fetchExtended/index.js";
import { CheerioDomSelection } from "./lib/dom/CheerioDomSelection.js";
import { PlaywrightDomSelection } from "./lib/dom/PlaywrightDomSelection.js";
import type { RenderedDomNode } from "./lib/dom/RenderedDomNode.js";
import { headersToNormalisedBasicObject } from "./lib/fetch.js";
import { getPage, gotoExtended, releasePage } from "./lib/playwrightBrowser.js";
import {
  applyPlaywrightNetworkCache,
  assertPlaywrightCacheStrategySupported,
} from "./lib/playwrightNetworkCache.js";
import type { RetryOptions } from "./lib/retryLogic.js";

/** Options for Playwright requests that return an interactive page handle. */
type EnvoyOptionsPlaywrightPage = {
  agent: "playwright";
  responseType: "rendered dom";
  headers?: Record<string, string>;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeout?: number;
  retry?: RetryOptions;
};

type EnvoyOptionsPlaywright = EnvoyOptionsPlaywrightPage;

type EnvoyOptionsFetch = {
  agent?: "fetch";
  responseType?: "dom" | "text" | "json";
  headers?: Record<string, string>;
  body?: string;
} & Omit<FetchExtendedRequestInit, "headers" | "body">;

export type EnvoyOptions = EnvoyOptionsPlaywright | EnvoyOptionsFetch;

export type CachedResponseStrategy =
  | "never"
  | "if-fresh"
  | "if-cached"
  | "exclusively";

export type EnvoyContext = {
  cachedResponseStrategy?: CachedResponseStrategy;
};

// Internal extension — not exported; used to thread a custom fetch function
// through envoy when a session is active.
type EnvoyInternalContext = EnvoyContext & {
  fetchFn?: (
    input: string | URL | Request,
    init?: FetchExtendedRequestInit,
  ) => Promise<Response>;
};

export type EnvoySessionOptions = FetchExtendedSessionOptions &
  Pick<EnvoyContext, "cachedResponseStrategy">;

export type NetworkRequestsHistoryItem = {
  meta?: Record<string, unknown>;
  request: {
    url: URL;
    method: string;
    headers: Record<string, string>;
    body?: string | Promise<string>;
  };
  response: {
    headers: Record<string, string>;
    body: string | Promise<string>;
    statusCode: number;
    cached: boolean;
    cachedOn: Date | null;
  };
};

export type EnvoySession = {
  envoy: typeof envoy;
  fetch: FetchExtended;
  close: () => Promise<void>;
  clone: (options?: { meta?: Record<string, unknown> }) => EnvoySession;
  getHistory: () => NetworkRequestsHistoryItem[];
};

export async function envoy(
  url: string,
  options: EnvoyOptions & { responseType: "text" },
): Promise<UrlResText>;
export async function envoy(
  url: string,
  options: EnvoyOptions & { responseType: "json" },
): Promise<UrlResJson>;
export async function envoy(
  url: string,
  options?: EnvoyOptions & { responseType?: "dom" },
): Promise<UrlResDom>;
export async function envoy(
  url: string,
  options: EnvoyOptions & { responseType: "rendered dom" },
): Promise<UrlResRenderedDom>;
export async function envoy(
  this: EnvoyInternalContext | undefined,
  url: string,
  options?: EnvoyOptions,
): Promise<UrlResAny>;

export async function envoy(
  this: EnvoyInternalContext | undefined,
  url: string,
  options?: EnvoyOptions,
): Promise<UrlResAny> {
  if (!options) {
    // biome-ignore lint/style/noParameterAssign: assigning default value to optional parameter
    options = {};
  }
  const cachedResponseStrategy = this?.cachedResponseStrategy;

  // Map high-level strategy to standard fetch cache options
  const cacheOption = mapStrategyToFetchCache(cachedResponseStrategy);

  if (!options.agent) {
    options.agent = "fetch";
  }

  if (options.agent === "fetch") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- we define only to exclude from requestOptions
    const { agent, responseType, ...requestOptions } = options;

    // Pass standard cache option through to the wrapped fetch
    const fetchOptions = {
      ...requestOptions,
      cache: cacheOption,
    };

    const fetchFn = this?.fetchFn ?? fetchExtended;
    const fetchRes = await fetchFn(url, fetchOptions);
    if (!fetchRes.ok) {
      const errorBody = await fetchRes.text();
      throw Error(
        `Got response status ${fetchRes.status} with body: ${errorBody}`,
      );
    }

    // Detect if response was cached by checking statusText
    // The caching wrapper sets statusText to "Cached on: {timestamp}" for cached responses
    const isCached = fetchRes.statusText.startsWith("Cached on:");
    const cachedOn = isCached
      ? new Date(
          Number.parseInt(fetchRes.statusText.split(":")[1]?.trim() ?? "0", 10),
        )
      : null;

    const res = {
      body: await fetchRes.text(),
      statusCode: fetchRes.status,
      headers: headersToNormalisedBasicObject([...fetchRes.headers.entries()]),
      cached: isCached,
      cachedOn,
      request: {
        headers: requestOptions.headers ?? {},
      },
    };

    const { body, statusCode, headers, cached, cachedOn: cachedOnValue } = res;

    if (options.responseType === "dom" || !options.responseType) {
      const dom = new CheerioDomSelection(cheerio.load(body));
      const root = dom.getFirst("html");
      if (!root) {
        throw new Error("Expected response DOM to contain an html element");
      }
      const jsonLD = dom
        .get('script[type="application/ld+json"]')
        .map((node) => {
          const text = node.text;
          if (!text) {
            return {};
          }
          try {
            return JSON.parse(text);
          } catch {
            return {};
          }
        });
      const firstJsonLD = jsonLD[0] ?? {};
      const canonicalUrl = dom.getFirst("link[rel=canonical]")?.attr("href");

      return {
        type: "dom",
        requestedUrl: url,
        finalUrl: url,
        dom,
        root,
        jsonLD,
        firstJsonLD,
        canonicalUrl,
        get title(): string {
          return dom.getFirst("title")?.text ?? "";
        },
        get html(): string {
          return body;
        },
        refetch: async () => {},
        statusCode,
        headers,
        cached,
        cachedOn: cachedOnValue,
        request: res.request,
      };
    }
    if (options.responseType === "json") {
      return {
        type: "json",
        data: JSON.parse(body),
        statusCode,
        headers,
        cached,
        cachedOn: cachedOnValue,
        request: res.request,
      };
    }
    if (options.responseType === "text") {
      return {
        type: "text",
        data: body,
        statusCode,
        headers,
        cached,
        cachedOn: cachedOnValue,
        request: res.request,
      };
    }
    options.responseType satisfies never;
    throw Error(`Unknown response type "${options.responseType}"`);
  }
  if (options.agent === "playwright") {
    if (options.responseType === "rendered dom") {
      assertPlaywrightCacheStrategySupported(cachedResponseStrategy);
      const page = await getPage();

      try {
        await applyPlaywrightNetworkCache(page, url, cachedResponseStrategy);
      } catch (error) {
        await releasePage(page);
        throw error;
      }

      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      const response = await gotoExtended(page, url, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: options.timeout,
        retry: options.retry,
      });

      const statusCode = response?.status() ?? 0;
      const rawHeaders = response?.headers() ?? {};
      const headers: Record<string, string> = rawHeaders as Record<
        string,
        string
      >;

      let domCache: PlaywrightDomSelection | undefined;
      let rootCache: ReturnType<PlaywrightDomSelection["getFirst"]> | undefined;

      const getDom = (): Promise<PlaywrightDomSelection> => {
        if (domCache) {
          return Promise.resolve(domCache);
        }

        return PlaywrightDomSelection.fromPage(page).then((dom) => {
          domCache = dom;
          return dom;
        });
      };

      const getRoot = (): Promise<RenderedDomNode> => {
        if (rootCache) {
          return Promise.resolve(rootCache);
        }

        return getDom().then((dom) => {
          // Browsers expose a document-level <html> element for parsed pages.
          const root = dom.getFirst("html");
          if (!root) {
            throw new Error("Expected page DOM to contain an html element");
          }

          rootCache = root;
          return rootCache;
        });
      };

      const getJsonLD = async (): Promise<Array<Record<string, unknown>>> => {
        const dom = await getDom();
        const jsonLDElements = dom.get(
          'script[type="application/ld+json"]',
        ).nodes;
        const jsonLD = await Promise.all(
          jsonLDElements.map(async (node) => {
            const text = await node.text;
            if (!text) {
              return {};
            }
            try {
              return JSON.parse(text);
            } catch {
              return {};
            }
          }),
        );
        return jsonLD;
      };

      return {
        type: "rendered dom",
        close: () => releasePage(page),
        get dom(): Promise<PlaywrightDomSelection> {
          return getDom();
        },
        get root(): Promise<RenderedDomNode> {
          return getRoot();
        },
        requestedUrl: url,
        finalUrl: page.url(),
        get jsonLD(): Promise<Array<Record<string, unknown>>> {
          return getJsonLD();
        },
        get firstJsonLD(): Promise<Record<string, unknown>> {
          return getJsonLD().then((jsonLD) => jsonLD[0] ?? {});
        },
        get canonicalUrl(): Promise<string | undefined> {
          return getDom().then((dom) =>
            dom.getFirst("link[rel=canonical]")?.attr("href"),
          );
        },
        get title(): Promise<string> {
          return page.title();
        },
        get html(): Promise<string> {
          return page.content();
        },
        screenshot: () => page.screenshot(),
        waitForUrl: async () => {
          await page.waitForURL("**");
        },
        refetch: async () => {
          await page.reload();
        },
        refresh: async () => {
          await page.reload();
        },
        statusCode,
        headers,
        cached: false,
        cachedOn: null,
        request: {
          headers: options.headers ?? {},
        },
      } satisfies UrlResRenderedDom;
    }
  }
  options.agent satisfies never;
  throw Error(`Unknown agent "${options.agent}"`);
}

/**
 * Map high-level cached response strategy to standard fetch cache option.
 *
 * - if-fresh: use cache if fresh, validate with server for staleness (maps to 'default')
 * - never: never use cache (maps to 'no-store')
 * - if-cached: use cache if available, otherwise fetch fresh (maps to 'force-cache')
 * - exclusively: only use cache, fail if not cached (maps to 'only-if-cached')
 */
function mapStrategyToFetchCache(
  strategy?: CachedResponseStrategy,
): RequestCache {
  switch (strategy) {
    case "never":
      return "no-store";
    case "exclusively":
      return "only-if-cached";
    case "if-cached":
      return "force-cache";
    case "if-fresh":
      return "default";
    case undefined:
      return "default";
    default:
      strategy satisfies never;
      throw Error(`Unknown cached response strategy: ${strategy}`);
  }
}

export async function createEnvoySession(
  options?: EnvoySessionOptions,
): Promise<EnvoySession> {
  const { cachedResponseStrategy, ...sessionOptions } = options ?? {};

  // Map strategy to standard fetch cache option for the session
  const cacheOption = mapStrategyToFetchCache(cachedResponseStrategy);

  const session = await createFetchExtendedSession({
    ...sessionOptions,
    cache: cacheOption,
  });

  // Shared history array that will be shared across clones
  const history: NetworkRequestsHistoryItem[] = [];

  // Wrapper to track requests/responses
  const createWrappedEnvoy = (
    meta: Record<string, unknown> = {},
    historyArray: NetworkRequestsHistoryItem[] = history,
  ): typeof envoy => {
    return (async (url: string, options?: EnvoyOptions): Promise<UrlResAny> => {
      const response = (await envoy.call(
        {
          fetchFn: session.fetch,
          cachedResponseStrategy,
        } satisfies EnvoyInternalContext,
        url,
        options,
        // biome-ignore lint/suspicious/noExplicitAny: envoy is overloaded, call through base envoy
      )) as any;

      // Extract request details
      const requestMethod =
        options && "method" in options ? (options.method ?? "GET") : "GET";
      const requestBody =
        options && "body" in options ? options.body : undefined;
      const requestHeaders =
        options && "headers" in options ? (options.headers ?? {}) : {};

      // Extract response details
      // biome-ignore lint/suspicious/noExplicitAny: response is union type, need to narrow it
      const resp = response as any;
      const responseHeaders = resp.headers ?? {};
      const statusCode = resp.statusCode ?? 0;
      const cached = resp.cached ?? false;
      const cachedOn = resp.cachedOn ?? null;

      // Handle the different response types based on type field
      const stringifiedBody =
        resp.type === "rendered dom"
          ? `[Playwright page: ${resp.finalUrl}]`
          : resp.type === "dom"
            ? resp.html
            : resp.type === "text"
              ? resp.data
              : resp.type === "json"
                ? JSON.stringify(resp.data, null, 2)
                : "[Unknown response type]";

      // Add to history
      historyArray.push({
        meta,
        request: {
          url: new URL(url),
          method: requestMethod,
          headers: requestHeaders,
          body: requestBody,
        },
        response: {
          headers: responseHeaders,
          body: stringifiedBody,
          statusCode,
          cached,
          cachedOn,
        },
      });

      return response;
    }) as unknown as typeof envoy;
  };

  // Wrapper to track fetch requests/responses
  const createWrappedFetch = (
    meta: Record<string, unknown> = {},
    historyArray: NetworkRequestsHistoryItem[] = history,
  ): FetchExtended => {
    return async (input, init) => {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(urlStr);
      const method =
        init?.method ??
        (typeof input !== "string" && !(input instanceof URL)
          ? input.method
          : undefined) ??
        "GET";
      const headers =
        init?.headers &&
        typeof init.headers === "object" &&
        !Array.isArray(init.headers)
          ? (init.headers as Record<string, string>)
          : typeof input !== "string" &&
              !(input instanceof URL) &&
              input.headers
            ? headersToNormalisedBasicObject([...input.headers.entries()])
            : {};
      const body =
        typeof init?.body === "string"
          ? init.body
          : typeof input !== "string" && !(input instanceof URL) && input.body
            ? typeof input.body === "string"
              ? input.body
              : undefined
            : undefined;

      // Make the actual fetch call through session.fetch
      const response = await session.fetch(input, init);

      // Clone the response so we can read the body
      const clonedResponse = response.clone();
      const responseBody = await clonedResponse.text();
      const responseHeaders = headersToNormalisedBasicObject([
        ...response.headers.entries(),
      ]);
      const statusCode = response.status;

      // Add to history
      historyArray.push({
        meta,
        request: {
          url,
          method,
          headers,
          body,
        },
        response: {
          headers: responseHeaders,
          body: responseBody,
          statusCode,
          cached: false,
          cachedOn: null,
        },
      });

      return response;
    };
  };

  const createSession = (
    meta: Record<string, unknown> = {},
    sessionHistory: NetworkRequestsHistoryItem[] | null = null,
  ): EnvoySession => {
    const historyArray = sessionHistory ?? history;

    return {
      envoy: createWrappedEnvoy(meta, historyArray),
      fetch: createWrappedFetch(meta, historyArray),
      close: () => session.close(),
      clone: (options) => createSession(options?.meta ?? {}, [...historyArray]),
      getHistory: () => historyArray,
    };
  };

  return createSession();
}
