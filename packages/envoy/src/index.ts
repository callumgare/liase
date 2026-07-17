export { CheerioDomSelection } from "./lib/dom/CheerioDomSelection.js";
export { CheerioDomNode } from "./lib/dom/CheerioDomNode.js";
export { DomNode } from "./lib/dom/DomNode.js";
export {
  DomSelection,
  normaliseDomSelector,
} from "./lib/dom/DomSelection.js";
export { RenderedDomNode } from "./lib/dom/RenderedDomNode.js";
export { RenderedDomSelection } from "./lib/dom/RenderedDomSelection.js";
export { PlaywrightDomSelection } from "./lib/dom/PlaywrightDomSelection.js";
export { PlaywrightDomNode } from "./lib/dom/PlaywrightDomNode.js";
export { envoy, createEnvoySession } from "./envoy.js";
export type {
  EnvoyOptions,
  EnvoySession,
  EnvoySessionOptions,
} from "./envoy.js";
export type {
  UrlRes,
  UrlResAny,
  UrlResDom,
  UrlResJson,
  UrlResRenderedDom,
  UrlResType,
  UrlResText,
} from "./UrlRes.js";
export {
  addCachingFetchWrapper,
  cacheResponse,
  getCachedResponse,
  type CacheNetworkRequests,
} from "./lib/networkRequestsCache.js";
export {
  headersToNormalisedBasicObject,
  parseFetchArgs,
} from "./lib/fetch.js";
export {
  configureBrowser,
  getPage,
  isBrowserRunning,
  releasePage,
  shutdownBrowser,
} from "./lib/playwrightBrowser.js";
