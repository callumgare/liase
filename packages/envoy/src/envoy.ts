import * as cheerio from "cheerio";
import deepmerge from "deepmerge";
import {
  Options as GotOptions,
  type OptionsInit as GotOptionsInit,
  gotScraping,
} from "got-scraping";
import type {
  UrlResAny,
  UrlResDom,
  UrlResJson,
  UrlResRenderedDom,
  UrlResText,
} from "./UrlRes.js";
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

type EnvoyOptionsGot = {
  agent?: "got";
  responseType?: "dom" | "text" | "json";
  headers?: Record<string, string>;
  body?: string;
  retryAdditional?: GotOptionsInit["retry"];
} & Omit<
  GotOptionsInit,
  | "responseType"
  | "headers"
  | "body"
  | "retry"
  | "hooks"
  | "resolveBodyOnly"
  | "isStream"
  | "url"
  | "json"
  | "form"
  | "agent"
>;

export type EnvoyOptions = EnvoyOptionsPlaywright | EnvoyOptionsGot;

export type EnvoyContext = {
  cacheNetworkRequests?: "never" | "auto" | "always";
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
  this: EnvoyContext | undefined,
  url: string,
  options?: EnvoyOptions,
): Promise<UrlResAny>;

export async function envoy(
  this: EnvoyContext | undefined,
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
    options.agent = "got";
  }

  if (options.agent === "got") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- we define only to exclude from requestOptions
    const { agent, retryAdditional, responseType, ...requestOptions } = options;

    const defaultGotOptions = new GotOptions();
    let retry = defaultGotOptions.retry;
    if (options.retryAdditional) {
      retry = deepmerge(retry, options.retryAdditional);
    }

    let cache: GotOptionsInit["cache"];

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
      headerGeneratorOptions: requestOptions.headerGeneratorOptions,
    };

    if (cacheNetworkRequests === "always") {
      res = await getCachedResponse(cacheableRequest);
    } else {
      cacheNetworkRequests satisfies "never" | undefined;
    }

    if (!res) {
      let sentHeaders: Record<string, string> = {};
      const gotRes = await gotScraping({
        url,
        ...requestOptions,
        responseType: "text",
        retry,
        cache,
        http2: false,
        hooks: {
          beforeRequest: [
            (requestConfig) => {
              sentHeaders = headersToNormalisedBasicObject(
                requestConfig.headers,
              );
            },
          ],
        },
      });
      if (!gotRes.ok) {
        throw Error(
          `Got response status ${gotRes.statusCode} (retry count: ${gotRes.retryCount}) with body: ${gotRes.body}`,
        );
      }
      res = {
        body: gotRes.body,
        statusCode: gotRes.statusCode,
        headers: headersToNormalisedBasicObject(gotRes.headers),
        request: {
          headers: sentHeaders ?? {},
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
        refetch: async () => {},
        html: async () => body,
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
        html: () => page.content(),
        title: () => page.title(),
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
