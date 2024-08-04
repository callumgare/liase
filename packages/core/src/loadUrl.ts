import { CheerioDomSelection, DomSelection } from "./DomSelection.js";
import {
  HttpCrawler,
  CheerioCrawler,
  Request,
  Configuration,
  LogLevel,
  CheerioCrawlingContext,
  BasicCrawlerOptions,
} from "crawlee";
import { getPromiseWithResolvers, getUniqueId } from "./lib/utils.js";
import { CheerioAPI } from "cheerio";

const crawleeConfig = new Configuration({
  logLevel: LogLevel.WARNING,
  persistStorage: false,
});

type LoadUrlOptions = {
  crawlerType: "got" | "cheerio" | "puppeteer";
  headers?: Record<string, string>;
};

type LoadUrlResponse = {
  root: DomSelection;
  statusCode: number;
};

const crawlerRequestCallbacks: Record<
  string,
  | {
      responseResolve: (value?: unknown) => void;
      responseReject: (reason?: any, ...otherData: any[]) => void;
    }
  | undefined
> = {};

export async function loadUrl(
  url: string,
  { crawlerType, headers }: LoadUrlOptions = {
    crawlerType: "cheerio",
  },
): Promise<LoadUrlResponse> {
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
