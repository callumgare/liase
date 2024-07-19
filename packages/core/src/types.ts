import { GenericRequest } from "./schemas/request.js";
import { RequestHandler } from "./schemas/requestHandler.js";
import { GenericSecrets } from "./schemas/secrets.js";

export type ConstructorExecutionContext = {
  request: GenericRequest;
  secrets: GenericSecrets;
  requestHandler: RequestHandler;
  responseDetails: RequestHandler["responses"][0];
  pageFetchLimitReached?: boolean;
  sourceId: string;
  proxyUrls?: string[];
  cachingProxyPort?: number;
};
