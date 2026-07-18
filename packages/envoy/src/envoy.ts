import * as cheerio from "cheerio";
import type {
  UrlResAny,
  UrlResDom,
  UrlResJson,
  UrlResRenderedDom,
  UrlResText,
} from "./UrlRes.js";
import {
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
import {
  cacheResponse,
  getCachedResponse,
} from "./lib/networkRequestsCache.js";
import { getPage, releasePage } from "./lib/playwrightBrowser.js";

/** Options for Playwright requests that return an interactive page handle. */
type EnvoyOptionsPlaywrightPage = {
  agent: "playwright";
  responseType: "rendered dom";
  headers?: Record<string, string>;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeout?: number;
};

type EnvoyOptionsPlaywright = EnvoyOptionsPlaywrightPage;

type EnvoyOptionsFetch = {
  agent?: "fetch";
  responseType?: "dom" | "text" | "json";
  headers?: Record<string, string>;
  body?: string;
} & Omit<FetchExtendedRequestInit, "headers" | "body">;

export type EnvoyOptions = EnvoyOptionsPlaywright | EnvoyOptionsFetch;

export type EnvoyContext = {
  cacheNetworkRequests?: "never" | "auto" | "always";
};

// Internal extension — not exported; used to thread a custom fetch function
// through envoy when a session is active.
type EnvoyInternalContext = EnvoyContext & {
  fetchFn?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
};

export type EnvoySessionOptions = FetchExtendedSessionOptions &
  Pick<EnvoyContext, "cacheNetworkRequests">;

export type EnvoySession = {
  envoy: typeof envoy;
  close: () => Promise<void>;
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
  const cacheNetworkRequests = this?.cacheNetworkRequests;

  if (cacheNetworkRequests === "auto") {
    throw Error(
      `The "auto" value for the cacheNetworkRequests option is not yet supported. Sorry!`,
    );
  }
  if (!options.agent) {
    options.agent = "fetch";
  }

  if (options.agent === "fetch") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- we define only to exclude from requestOptions
    const { agent, responseType, ...requestOptions } = options;

    let res:
      | {
          body: string;
          statusCode: number;
          headers: Record<string, string>;
          cachedOn?: Date;
          request: { headers: Record<string, string> };
        }
      | undefined;

    const cacheableRequest = {
      url,
      method: requestOptions.method ?? "",
      headers: requestOptions.headers ?? {},
      body: requestOptions.body ?? "",
    };

    if (cacheNetworkRequests === "always") {
      res = await getCachedResponse(cacheableRequest);
    } else {
      cacheNetworkRequests satisfies "never" | undefined;
    }

    if (!res) {
      const fetchFn = this?.fetchFn ?? fetchExtended;
      const fetchRes = await fetchFn(url, requestOptions);
      if (!fetchRes.ok) {
        const errorBody = await fetchRes.text();
        throw Error(
          `Got response status ${fetchRes.status} with body: ${errorBody}`,
        );
      }
      res = {
        body: await fetchRes.text(),
        statusCode: fetchRes.status,
        headers: headersToNormalisedBasicObject([
          ...fetchRes.headers.entries(),
        ]),
        request: {
          headers: requestOptions.headers ?? {},
        },
      };
      await cacheResponse(cacheableRequest, res);
    }

    const { body, statusCode, headers, cachedOn } = res;

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
        cached: Boolean(cachedOn),
        cachedOn: cachedOn ?? null,
        request: res.request,
      };
    }
    if (options.responseType === "json") {
      return {
        type: "json",
        data: JSON.parse(body),
        statusCode,
        headers,
        cached: Boolean(cachedOn),
        cachedOn: cachedOn ?? null,
        request: res.request,
      };
    }
    if (options.responseType === "text") {
      return {
        type: "text",
        data: body,
        statusCode,
        headers,
        cached: Boolean(cachedOn),
        cachedOn: cachedOn ?? null,
        request: res.request,
      };
    }
    options.responseType satisfies never;
    throw Error(`Unknown response type "${options.responseType}"`);
  }
  if (options.agent === "playwright") {
    if (options.responseType === "rendered dom") {
      const page = await getPage();

      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      const response = await page.goto(url, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: options.timeout,
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

export async function createEnvoySession(
  options?: EnvoySessionOptions,
): Promise<EnvoySession> {
  const { cacheNetworkRequests, ...sessionOptions } = options ?? {};
  const session = await createFetchExtendedSession(sessionOptions);
  return {
    envoy: envoy.bind({
      fetchFn: session.fetch,
      cacheNetworkRequests,
    } satisfies EnvoyInternalContext) as typeof envoy,
    close: () => session.close(),
  };
}
