import { RequestHandler } from "./schemas/requestHandler.js";
import {
  guessMediaInfoFromUrl,
  guessMediaInfoFromMimeType,
} from "./actionHelpers.js";
import { loadUrl } from "./loadUrl.js";
import { Action } from "./schemas/constructor.js";
import { GenericRequest } from "./schemas/request.js";
import { GenericSecrets } from "./schemas/secrets.js";
import { ConstructorExecutionContext } from "./types.js";
import { decodeHTML } from "entities";
import {
  generateResponse,
  getResponseDetailsBasedOnRequest,
} from "./generateResponse.js";
import { getCachingFetch } from "./lib/networkRequestsCache.js";
import { LoadUrlHistoryItem } from "./loadUrlHistory.js";

export const excludeFieldSymbol = Symbol("ExcludeField");

export class ActionContext extends Function {
  constructor(args: {
    constructorContext: ConstructorExecutionContext;
    executeActions: (
      actions: Action[],
      context: ActionContext,
      path: (string | number)[],
    ) => Promise<ActionContext>;
    path: (string | number)[];
    initialData?: Record<string, any>;
    loadUrlHistory?: LoadUrlHistoryItem[];
  }) {
    super();
    this.#constructorContext = args.constructorContext;
    this.#executeActions = args.executeActions;
    this.#path = args.path;
    if (args.initialData) {
      this.#dataStore = args.initialData;
    }
    this.#loadUrlHistory = args.loadUrlHistory ?? [];
    return new Proxy(this, {
      apply: (target, thisArg, args) => target.get(...args),
      get: (target, propName: keyof ActionContext, receiver) => {
        const value = target[propName];
        if (value instanceof Function) {
          return (...args: any[]) =>
            value.apply(this === receiver ? target : this, args);
        }
        return value;
      },
    });
  }

  #constructorContext: ConstructorExecutionContext;
  #executeActions;
  #path;
  #resultHistory: any[] = [];
  #loadUrlHistory;
  // eslint-disable-next-line no-use-before-define -- we need to use before it's defined since it's recursive
  #clonedChildren: ActionContext[] = [];

  #unresolvedPromises: any[] = [];

  #dataStore: Record<string, any> = {};

  get(key: string = "") {
    if (!(key in this.#dataStore)) {
      throw Error(
        `Attempted to access value "${key}" but that value was never set`,
      );
    }
    return this.#dataStore[key];
  }

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

  has(key: string = "") {
    return key in this.#dataStore;
  }

  getAll() {
    return { ...this.#dataStore };
  }

  recordResult(result: any) {
    this.#resultHistory.push(result);
  }

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
    data?: Record<string, any>;
  } = {}) {
    const clone = new ActionContext({
      constructorContext: this.#constructorContext,
      initialData: data ? { ...data } : { ...this.#dataStore },
      executeActions: this.#executeActions,
      path: (path ?? this.#path).concat(appendToPath ?? []),
      loadUrlHistory: this.#loadUrlHistory,
    });
    this.#clonedChildren.push(clone);
    return clone;
  }

  get descendants(): ActionContext[] {
    return this.#clonedChildren
      .map((clonedChild) => [clonedChild, ...clonedChild.descendants])
      .flat();
  }

  chain(...actions: Action[]) {
    return this.#executeActions(actions, this, this.#path);
  }

  waitForAllPromisesToResolve() {
    return Promise.all(this.#unresolvedPromises);
  }

  get request(): Record<string, any> {
    return Object.freeze(this.#constructorContext.request);
  }

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

  loadUrl: typeof loadUrl = (async (
    url: string,
    options: Parameters<typeof loadUrl>[1],
  ) => {
    const response = await loadUrl.call(this, url, options);
    this.#loadUrlHistory.push({
      constructorPath: this.#path,
      url,
      options,
      response,
    });
    return response;
  }) as any;

  get loadUrlHistory() {
    return this.#loadUrlHistory;
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

  async getFetchClient(): Promise<typeof fetch> {
    return await getCachingFetch(this.#constructorContext.cacheNetworkRequests);
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
      totalSeconds += parseInt(segments[0]) * 24 * 60 * 60;
    }
    if (typeof segments[1] === "string") {
      totalSeconds += parseInt(segments[1]) * 60 * 60;
    }
    totalSeconds += parseInt(segments[2]) * 60;
    totalSeconds += parseInt(segments[3]);

    return totalSeconds;
  };

  excludeField = excludeFieldSymbol;

  get path() {
    return this.#path;
  }
}
