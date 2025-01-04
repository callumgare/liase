import { CheerioDomSelection, DomSelection } from "./DomSelection.js";
import * as cheerio from "cheerio";
import {
  gotScraping,
  Options as GotOptions,
  OptionsInit as GotOptionsInit,
} from "got-scraping";
import {
  cacheResponse,
  getCachedResponse,
} from "./lib/networkRequestsCache.js";
import deepmerge from "deepmerge";
import { ActionContext } from "./ActionContext.js";
import { headersToNormalisedBasicObject } from "./lib/fetch.js";

type LoadUrlOptionsPlaywright = {
  agent: "playwright";
  responseType?: "dom";
  headers?: Record<string, string>;
};

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

export type LoadUrlResponse =
  | LoadUrlResponseDom
  | LoadUrlResponseJson
  | LoadUrlResponseText;
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

    let cache;

    let res;

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
    } else if (options.responseType === "json") {
      return {
        data: JSON.parse(body),
        statusCode,
        headers,
        cached: Boolean(cachedOn),
        cachedOn: cachedOn ?? null,
        request: res.request,
      };
    } else if (options.responseType === "text") {
      return {
        data: body,
        statusCode,
        headers,
        cached: Boolean(cachedOn),
        cachedOn: cachedOn ?? null,
        request: res.request,
      };
    } else {
      options.responseType satisfies never;
      throw Error(`Unknown response type "${options.responseType}"`);
    }
  } else if (options.agent === "playwright") {
    throw Error("Playwright not supported yet");
  } else {
    options.agent satisfies never;
    throw Error(`Unknown agent "${options.agent}"`);
  }
}
