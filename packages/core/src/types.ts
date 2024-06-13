import { GenericRequest } from "./schemas/request.js";
import { RequestHandler } from "./schemas/requestHandler.js";
import { GenericSecrets } from "./schemas/secrets.js";
import { Source } from "./schemas/source.js";

export type ConstructorExecutionContext = {
  request: GenericRequest,
  secrets: GenericSecrets,
  requestHandler: RequestHandler,
  pageFetchLimitReached?: boolean,
  source: Source,
  proxyUrls?: string[],
  cachingProxyPort?: number,
}
