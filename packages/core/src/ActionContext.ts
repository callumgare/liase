import {
  type EnvoySession,
  type UrlResAny,
  addCachingFetchWrapper,
  type envoy as loadUrl,
} from "@liase/envoy";
import { decodeHTML } from "entities";
import {
  guessMediaInfoFromMimeType,
  guessMediaInfoFromUrl,
} from "./actionHelpers.js";
import {
  generateResponse,
  getResponseDetailsBasedOnRequest,
} from "./generateResponse.js";
import type { Action } from "./schemas/constructor.js";
import type { GenericRequest } from "./schemas/request.js";
import type { RequestHandler } from "./schemas/requestHandler.js";
import type { GenericSecrets } from "./schemas/secrets.js";
import type { ConstructorExecutionContext } from "./types.js";

export const excludeFieldMarker = Symbol("ExcludeField");

export class ActionContext extends Function {
  #constructorContext: ConstructorExecutionContext;
  #executeActions: (
    actions: Action[],
    context: ActionContext,
    path: (string | number)[],
  ) => Promise<ActionContext>;
  #path: (string | number)[];
  // biome-ignore lint/suspicious/noExplicitAny: data store accepts arbitrary values
  #dataStore: Record<string, any> = {};
  // biome-ignore lint/suspicious/noExplicitAny: result history can store any type
  #resultHistory: any[] = [];
  #clonedChildren: ActionContext[] = [];
  #envoySession: EnvoySession;

  constructor(args: {
    constructorContext: ConstructorExecutionContext;
    executeActions: (
      actions: Action[],
      context: ActionContext,
      path: (string | number)[],
    ) => Promise<ActionContext>;
    path: (string | number)[];
    // biome-ignore lint/suspicious/noExplicitAny: data store accepts arbitrary values
    initialData?: Record<string, any>;
    envoySession: EnvoySession;
  }) {
    super();
    this.#constructorContext = args.constructorContext;
    this.#executeActions = args.executeActions;
    this.#path = args.path;
    this.#envoySession = args.envoySession;
    if (args.initialData) {
      this.#dataStore = args.initialData;
    }
    // biome-ignore lint/correctness/noConstructorReturn: Proxy wrapping requires returning from constructor
    return new Proxy(this, {
      apply: (target, thisArg, args) => target.get(...args),
      get: (target, propName: keyof ActionContext, receiver) => {
        const value = target[propName];
        if (value instanceof Function) {
          // biome-ignore lint/suspicious/noExplicitAny: spread args for dynamic proxy forwarding
          return (...args: any[]) =>
            value.apply(this === receiver ? target : this, args);
        }
        return value;
      },
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: unresolved promise store accepts arbitrary values
  #unresolvedPromises: any[] = [];

  get(key = "") {
    if (!(key in this.#dataStore)) {
      throw Error(
        `Attempted to access value "${key}" but that value was never set`,
      );
    }
    return this.#dataStore[key];
  }

  // biome-ignore lint/suspicious/noExplicitAny: value can be any type in dynamic data store
  set(key: string, value: any) {
    if (value instanceof Promise) {
      this.#unresolvedPromises.push(
        value.then((resolvedValue) => {
          if (this.get(key) === value) {
            this.set(key, resolvedValue);
          } else {
            throw Error(
              `The value saved under the key "${key}" was changed before the original value (which was a promise) finished resolving.`,
            );
          }
        }),
      );
    }
    this.#dataStore[key] = value;
    return this;
  }

  has(key = "") {
    return key in this.#dataStore;
  }

  getAll() {
    return { ...this.#dataStore };
  }

  // biome-ignore lint/suspicious/noExplicitAny: result can be any type from dynamic action execution
  recordResult(result: any) {
    this.#resultHistory.push(result);
  }

  // biome-ignore lint/suspicious/noExplicitAny: result can be any type from dynamic action execution
  lastResult(): any {
    return this.#resultHistory[this.#resultHistory.length - 1];
  }

  clone({
    path,
    appendToPath,
    data,
  }: {
    path?: (string | number)[];
    appendToPath?: (string | number)[];
    // biome-ignore lint/suspicious/noExplicitAny: data store accepts arbitrary values
    data?: Record<string, any>;
  } = {}) {
    const newPath = (path ?? this.#path).concat(appendToPath ?? []);
    const clone = new ActionContext({
      constructorContext: this.#constructorContext,
      initialData: data ? { ...data } : { ...this.#dataStore },
      executeActions: this.#executeActions,
      path: newPath,
      envoySession: this.#envoySession.clone({
        meta: { constructorPath: newPath },
      }),
    });
    this.#clonedChildren.push(clone);
    return clone;
  }

  get descendants(): ActionContext[] {
    return this.#clonedChildren.flatMap((clonedChild) => [
      clonedChild,
      ...clonedChild.descendants,
    ]);
  }

  chain(...actions: Action[]) {
    return this.#executeActions(actions, this, this.#path);
  }

  waitForAllPromisesToResolve() {
    return Promise.all(this.#unresolvedPromises);
  }

  // biome-ignore lint/suspicious/noExplicitAny: request is a dynamic object from user input
  get request(): Record<string, any> {
    return Object.freeze(this.#constructorContext.request);
  }

  // biome-ignore lint/suspicious/noExplicitAny: secrets is a dynamic object from user input
  get secrets(): Record<string, any> {
    return Object.freeze(this.#constructorContext.secrets);
  }

  get requestHandler() {
    return Object.freeze(this.#constructorContext.requestHandler);
  }

  get pageFetchLimitReached() {
    return this.#constructorContext.pageFetchLimitReached;
  }

  get cacheNetworkRequests() {
    return this.#constructorContext.cacheNetworkRequests;
  }

  loadUrl = (async (url: string, options?: Parameters<typeof loadUrl>[1]) => {
    const envoyFn = this.#envoySession.envoy as unknown as (
      url: string,
      // biome-ignore lint/suspicious/noExplicitAny: envoy function requires flexible types
      options?: any,
      // biome-ignore lint/suspicious/noExplicitAny: envoy function requires flexible types
    ) => Promise<any>;
    return envoyFn(url, options);
    // We cast here so that loadUrl inherits the overload signatures of the original loadUrl function
  }) as unknown as typeof loadUrl;

  get networkRequestsHistory() {
    return this.#envoySession.getHistory();
  }

  loadRequest = async (
    requestHandler: RequestHandler,
    request: Omit<GenericRequest, "source" | "queryType"> &
      Partial<Pick<GenericRequest, "source" | "queryType">>,
    {
      secrets = {},
    }: {
      secrets?: GenericSecrets;
    } = {},
  ) => {
    const sourceId = request.source ?? this.#constructorContext.sourceId;
    const fullRequest = {
      ...request,
      source: sourceId,
      queryType: request.queryType ?? requestHandler.id,
    };
    const constructorContext = {
      request: fullRequest,
      secrets,
      requestHandler,
      responseDetails: getResponseDetailsBasedOnRequest(
        requestHandler.responses,
        fullRequest,
      ),
      sourceId,
      hooks: this.#constructorContext.hooks,
    };
    return generateResponse(constructorContext);
  };

  get hooks() {
    return this.#constructorContext.hooks;
  }

  get fetch(): typeof fetch {
    const cachingFetch = addCachingFetchWrapper(
      this.#envoySession.fetch,
      this.#constructorContext.cacheNetworkRequests,
    );
    return cachingFetch;
  }

  guessMediaInfoFromUrl = guessMediaInfoFromUrl;

  guessMediaInfoFromMimeType = guessMediaInfoFromMimeType;

  decodeHTML = (value: string) => decodeHTML(value);

  durationStringToNumber = (duration: string) => {
    const match = duration.match(
      /^\s*(?:(?:(\d+)[:D])?(\d{1,2})[:H])?(\d{1,2})[:M](\d{2})[S]?\s*$/,
    );

    if (!match) {
      throw Error(`The value "${duration}" is not a valid duration string`);
    }

    const [, ...segments] = match;
    let totalSeconds = 0;
    if (typeof segments[0] === "string") {
      totalSeconds += Number.parseInt(segments[0]) * 24 * 60 * 60;
    }
    if (typeof segments[1] === "string") {
      totalSeconds += Number.parseInt(segments[1]) * 60 * 60;
    }
    totalSeconds += Number.parseInt(segments[2]) * 60;
    totalSeconds += Number.parseInt(segments[3]);

    return totalSeconds;
  };

  excludeField = excludeFieldMarker;

  get path() {
    return this.#path;
  }
}
