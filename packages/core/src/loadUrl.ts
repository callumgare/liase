import { CheerioDomSelection, DomSelection } from "./DomSelection.js";
import {
  HttpCrawler,
  CheerioCrawler,
  Configuration,
  Request,
  LogLevel,
  CheerioCrawlingContext,
  BasicCrawlerOptions,
} from "crawlee";
import { getPromiseWithResolvers, getUniqueId } from "./lib/utils.js";
import { CheerioAPI } from "cheerio";
import { gotScraping, type Options as GotOptions } from "got-scraping";

const crawleeConfig = new Configuration({
  logLevel: LogLevel.WARNING,
  persistStorage: false,
});

const crawlerRequestCallbacks: Record<
  string,
  | {
      responseResolve: (value?: unknown) => void;
      responseReject: (reason?: any, ...otherData: any[]) => void;
    }
  | undefined
> = {};

type LoadUrlOptionsPuppeteer = {
  agent?: "puppeteer";
  responseType?: "webpage";
  headers?: Record<string, string>;
};

type LoadUrlOptionsGot = {
  agent?: "got";
  responseType?: "webpage" | "text" | "json";
  headers?: Record<string, string>;
  method?: GotOptions["method"];
  body?: GotOptions["body"];
};

type LoadUrlOptions = LoadUrlOptionsPuppeteer | LoadUrlOptionsGot;

type LoadUrlResponseWebpage = {
  root: DomSelection;
  statusCode: number;
};
type LoadUrlResponseJson = {
  data: unknown;
  statusCode: number;
};

type LoadUrlResponse = LoadUrlResponseWebpage | LoadUrlResponseJson;

export async function loadUrl(url: string): Promise<LoadUrlResponseWebpage>;
export async function loadUrl(
  url: string,
  props:
    | Omit<LoadUrlOptionsPuppeteer, "responseType">
    | Omit<LoadUrlOptionsGot, "responseType">,
): Promise<LoadUrlResponseWebpage>;
export async function loadUrl(
  url: string,
  props: (LoadUrlOptionsPuppeteer | LoadUrlOptionsGot) & {
    responseType: "webpage";
  },
): Promise<LoadUrlResponseWebpage>;
export async function loadUrl(
  url: string,
  props: LoadUrlOptionsGot & { responseType: "json" },
): Promise<LoadUrlResponseJson>;

export async function loadUrl(
  url: string,
  { agent, responseType, headers, ...otherProps }: LoadUrlOptions = {},
): Promise<LoadUrlResponse> {
  if (!agent) {
    if (responseType === "json") {
      agent = "got";
    } else if (!responseType || responseType === "webpage") {
      agent = "got";
    } else if (responseType === "text") {
      agent = "got";
    } else {
      responseType satisfies never;
      throw Error(`Unrecognised "responseType" value: ${responseType}`);
    }
  }
  let crawlerType;
  if (agent === "got") {
    if (!responseType || responseType === "webpage") {
      crawlerType = "cheerio";
    } else {
      crawlerType = "got";
    }
  } else if (agent === "puppeteer") {
    crawlerType = "puppeteer";
  } else {
    agent satisfies never;
    throw Error(`Unrecognised "agent" value: ${responseType}`);
  }
  const {
    promise: responsePromise,
    resolve: responseResolve,
    reject: responseReject,
  } = getPromiseWithResolvers();
  const requestId = getUniqueId();
  const request = new Request({
    url,
    headers: { Accept: "application/json", ...headers },
    label: requestId,
    uniqueKey: requestId,
  });
  crawlerRequestCallbacks[requestId] = { responseResolve, responseReject };

  let response;
  if (crawlerType === "cheerio") {
    const crawler = getCrawler(crawlerType);
    if (!crawler.running) {
      throw Error("Crawlee not running");
    }
    await crawler.addRequests([request]);
    const crawleeContext = (await responsePromise) as CheerioCrawlingContext<
      any,
      any
    >;
    response = {
      root: new CheerioDomSelection(crawleeContext.$ as CheerioAPI),
      statusCode: crawleeContext.response.statusCode,
    };
  } else if (crawlerType === "got") {
    if (responseType === "webpage") {
      throw Error("Can not use got crawlerType with webpage response");
    }
    const { body, statusCode, ok, retryCount } = await gotScraping({
      url,
      method: "method" in otherProps ? otherProps.method : undefined,
      body: "body" in otherProps ? otherProps.body : undefined,
      headers,
      responseType,
      // We add "POST" to the retry methods and set everything else to their defaults
      // https://github.com/sindresorhus/got/blob/main/documentation/7-retry.md#retry
      retry: {
        methods: ["GET", "PUT", "HEAD", "DELETE", "OPTIONS", "TRACE", "POST"],
        limit: 2,
        statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
        errorCodes: [
          "ETIMEDOUT",
          "ECONNRESET",
          "EADDRINUSE",
          "ECONNREFUSED",
          "EPIPE",
          "ENOTFOUND",
          "ENETUNREACH",
          "EAI_AGAIN",
        ],
        maxRetryAfter: undefined,
        calculateDelay: ({ computedValue }) => computedValue,
        backoffLimit: Number.POSITIVE_INFINITY,
        noise: 100,
      },
    });
    if (!ok) {
      throw Error(
        `Got response status ${statusCode} (retry count: ${retryCount}) with body: ${body}`,
      );
    }
    return { data: body, statusCode };
  } else {
    throw Error(`Unknown crawler type "${crawlerType}"`);
  }

  return response;
}

const _initedCrawlers: {
  got?: HttpCrawler<any>;
  cheerio?: CheerioCrawler;
  puppeteer?: CheerioCrawler;
} = {};
type InitedCrawlersMap = typeof _initedCrawlers;

function getCrawler<
  CrawlerType extends keyof InitedCrawlersMap,
  Crawler extends Exclude<InitedCrawlersMap[CrawlerType], undefined>,
>(crawlerType: CrawlerType): Crawler {
  const crawlerConstructorOptions = {
    async requestHandler(crawleeContext: any) {
      const { responseResolve } =
        crawlerRequestCallbacks[crawleeContext.request.label] || {};
      if (!responseResolve) {
        throw Error("Processed response with no promise callback");
      }
      responseResolve(crawleeContext);
    },
    async failedRequestHandler(crawleeContext: any, error: any) {
      const { responseReject } =
        crawlerRequestCallbacks[crawleeContext.request.label] || {};
      if (!responseReject) {
        throw Error("Processed reject with no promise callback");
      }
      responseReject(error, crawleeContext);
    },
  } satisfies BasicCrawlerOptions;

  if (crawlerType === "cheerio") {
    if (!_initedCrawlers.cheerio || _initedCrawlers.cheerio.running === false) {
      _initedCrawlers.cheerio = new CheerioCrawler(
        crawlerConstructorOptions,
        crawleeConfig,
      );
      _initedCrawlers.cheerio.run();
    }
    return _initedCrawlers.cheerio as Crawler;
  } else {
    throw Error(`Unknown crawler type "${crawlerType}"`);
  }
}
