import type { LiaseHooks } from "./lib/hooks.js";
import type { QueryOptions } from "./schemas/queryOptions.js";
import type { GenericRequest } from "./schemas/request.js";
import type { RequestHandler } from "./schemas/requestHandler.js";
import type { GenericSecrets } from "./schemas/secrets.js";

export type ConstructorExecutionContext = {
  request: GenericRequest;
  secrets: GenericSecrets;
  requestHandler: RequestHandler;
  responseDetails: RequestHandler["responses"][0];
  pageFetchLimitReached?: boolean;
  cachedResponseStrategy?: QueryOptions["cachedResponseStrategy"];
  sourceId: string;
  hooks: LiaseHooks;
};
