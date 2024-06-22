import { z } from "zod";
import { GenericRequest } from "./schemas/request.js";
import { RequestHandler } from "./schemas/requestHandler.js";
import { GenericSecrets } from "./schemas/secrets.js";
import { Source } from "./schemas/source.js";

export type ConstructorExecutionContext = {
  request: GenericRequest,
  secrets: GenericSecrets,
  requestHandler: RequestHandler,
  responseSchema: z.ZodObject<z.ZodRawShape, z.UnknownKeysParam, z.ZodTypeAny, unknown, unknown>,
  pageFetchLimitReached?: boolean,
  source: Source,
  proxyUrls?: string[],
  cachingProxyPort?: number,
}
