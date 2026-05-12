import * as cheerio from "cheerio";
import deepmerge from "deepmerge";
import {
  Options as GotOptions,
  type OptionsInit as GotOptionsInit,
  gotScraping,
} from "got-scraping";
import type { Page } from "playwright";
import type { ActionContext } from "./ActionContext.js";
import {
  CheerioDomSelection,
  type DomSelection,
  PlaywrightDomSelection,
} from "./DomSelection.js";
import { headersToNormalisedBasicObject } from "./lib/fetch.js";
import {
  cacheResponse,
  getCachedResponse,
} from "./lib/networkRequestsCache.js";
import { getPage, releasePage } from "./lib/playwrightBrowser.js";

/** Options for Playwright requests that return an interactive page handle. */
type LoadUrlOptionsPlaywrightPage = {
  agent: "playwright";
  responseType: "page";
  headers?: Record<string, string>;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeout?: number;
};

type LoadUrlOptionsPlaywright = LoadUrlOptionsPlaywrightPage;

type LoadUrlOptionsGot = {
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
  | "agent" // omit so it doesn't intersect with our own agent field above
>;

export type LoadUrlOptions = LoadUrlOptionsPlaywright | LoadUrlOptionsGot;

type LoadURLSharedResponse = {
  statusCode: number;
  headers: Record<string, string>;
  cached: boolean;
  cachedOn: Date | null;
  request: {
    headers: Record<string, string>;
  };
};

type LoadUrlResponseDom = LoadURLSharedResponse & {
  root: DomSelection;
};
type LoadUrlResponseJson = LoadURLSharedResponse & {
  data: unknown;
};
type LoadUrlResponseText = LoadURLSharedResponse & {
  data: string;
};

/**
 * Response type for `responseType: "page"`. Provides an interactive Playwright
 * `Page` object. The caller MUST call `close()` when done to release resources
 * back to the shared browser pool.
 */
export type LoadUrlResponsePage = {
  /** The Playwright Page — use this to interact with the loaded page. */
  page: Page;
  /**
   * Release the page back to the browser pool and close it.
   * Always call this when you are done with the page.
   */
  close: () => Promise<void>;
  /** URL after navigation (may differ from the requested URL after redirects). */
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  cached: false;
  cachedOn: null;
  request: {
    headers: Record<string, string>;
  };
  /** Lazily fetches the rendered page HTML and returns a parsed DOM selection. */
  root: Promise<PlaywrightDomSelection>;
};

export type LoadUrlResponse =
  | LoadUrlResponseDom
  | LoadUrlResponseJson
  | LoadUrlResponseText
  | LoadUrlResponsePage;

export function isLoadUrlResponsePage(
  r: LoadUrlResponse,
): r is LoadUrlResponsePage {
  return "page" in r;
}

export function isLoadUrlResponseDom(
  r: LoadUrlResponse,
): r is LoadUrlResponseDom {
  return "root" in r && !("page" in r);
}
export async function loadUrl(
  url: string,
  options: LoadUrlOptions & { agent: "playwright"; responseType: "page" },
): Promise<LoadUrlResponsePage>;
export async function loadUrl(
  url: string,
  options: LoadUrlOptions & { responseType: "json" },
): Promise<LoadUrlResponseJson>;
export async function loadUrl(
  url: string,
  options?: LoadUrlOptions & { responseType?: "dom" },
): Promise<LoadUrlResponseDom>;
export async function loadUrl(
  url: string,
  options: LoadUrlOptions & { responseType: "text" },
): Promise<LoadUrlResponseText>;

export async function loadUrl(
  this: ActionContext,
  url: string,
  options?: LoadUrlOptions,
): Promise<LoadUrlResponse> {
  if (!options) {
    // biome-ignore lint/style/noParameterAssign: assigning default value to optional parameter
    options = {};
  }
  if (this.cacheNetworkRequests === "auto") {
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

    if (this.cacheNetworkRequests === "always") {
      res = await getCachedResponse(cacheableRequest);
    } else {
      this.cacheNetworkRequests satisfies "never" | undefined;
    }

    if (!res) {
      let sentHeaders: Record<string, string> = {};
      const gotRes = await gotScraping({
        url,
        ...requestOptions,
        responseType: "text",
        retry,
        cache,
        http2: false, // Seems to be necessary otherwise got will throw "Unknown HTTP2 promise event: destroy"
        // when caching.
        hooks: {
          beforeRequest: [
            (options) => {
              sentHeaders = headersToNormalisedBasicObject(options.headers);
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
      return {
        root: new CheerioDomSelection(cheerio.load(body)),
        statusCode,
        headers,
        cached: Boolean(cachedOn),
        cachedOn: cachedOn ?? null,
        request: res.request,
      };
    }
    if (options.responseType === "json") {
      return {
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
    if (options.responseType === "page") {
      const page = await getPage();

      // Set extra HTTP headers if provided
      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      const response = await page.goto(url, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: options.timeout,
      });

      const statusCode = response?.status() ?? 0;
      const rawHeaders = response?.headers() ?? {};
      // Playwright returns header names in lowercase already
      const headers: Record<string, string> = rawHeaders as Record<
        string,
        string
      >;

      let _root: PlaywrightDomSelection | undefined;
      return {
        page,
        close: () => releasePage(page),
        get root(): Promise<PlaywrightDomSelection> {
          if (_root) return Promise.resolve(_root);
          return PlaywrightDomSelection.fromPage(page).then((dom) => {
            _root = dom;
            return dom;
          });
        },
        finalUrl: page.url(),
        statusCode,
        headers,
        cached: false,
        cachedOn: null,
        request: {
          headers: options.headers ?? {},
        },
      } satisfies LoadUrlResponsePage;
    }
  }
  options.agent satisfies never;
  throw Error(`Unknown agent "${options.agent}"`);
}
