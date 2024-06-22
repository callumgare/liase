import { RequestHandler } from "./schemas/requestHandler.js";
import { guessMediaInfoFromUrl } from "./actionHelpers.js";
import { loadUrl } from "./loadUrl.js";
import { Action } from "./schemas/constructor.js";
import { GenericRequest } from "./schemas/request.js";
import { GenericSecrets } from "./schemas/secrets.js";
import { ConstructorExecutionContext } from "./types.js";
import {decodeHTML} from "entities"
import { generateResponse, getResponseSchemaBasedOnRequest } from "./generateResponse.js";

export class ActionContext extends Function {
  constructor(args: {
    constructorContext: ConstructorExecutionContext,
    executeActions: (actions: Action[], context: ActionContext, path: (string | number)[]) => Promise<ActionContext>,
    path: (string | number)[],
    initialData?:  Record<string, any>
  }) {
    super()
    this.#constructorContext = args.constructorContext
    this.#executeActions = args.executeActions
    this.#path = args.path
    if (args.initialData) {
      this.#dataStore = args.initialData
    }
    return new Proxy(this, {
      apply: (target, thisArg, args) => target.get(...args),
      get: (target, propName: keyof ActionContext, receiver) => {
        const value = target[propName];
        if (value instanceof Function) {
          return (...args: any[]) => value.apply(this === receiver ? target : this, args);
        }
        return value;
      }
    })
  }

  #constructorContext: ConstructorExecutionContext
  #executeActions
  #path
  #resultHistory: any[] = []
  #unresolvedPromises: any[] = []

  #dataStore: Record<string, any> = {}

  get(key: string = '') {
    if ( !(key in this.#dataStore) ) {
      throw Error(`Attempted to access value "${key}" but that value was never set`)
    }
    return this.#dataStore[key]
  }

  set(key: string, value: any) {
    if (value instanceof Promise) {
      this.#unresolvedPromises.push(
        value.then(resolvedValue => {
          if (this.get(key) === value) {
            this.set(key, resolvedValue)
          } else {
            throw Error(`The value saved under the key "${key}" was changed before the original value (which was a promise) finished resolving.`)
          }
        })
      )
    }
    this.#dataStore[key] = value
    return this
  }

  has(key: string = '') {
    return key in this.#dataStore
  }

  getAll() {
    return {...this.#dataStore}
  }

  recordResult(result: any) {
    this.#resultHistory.push(result)
  }

  lastResult(): any {
    return this.#resultHistory[this.#resultHistory.length - 1]
  }

  clone({path}: {path?: (string | number)[]} = {}) {
    return new ActionContext({
      constructorContext: this.#constructorContext,
      initialData: {...this.#dataStore},
      executeActions: this.#executeActions,
      path: path ?? this.#path
    })
  }

  chain(...actions: Action[]) {
    return this.#executeActions(actions, this, this.#path)
  }

  waitForAllPromisesToResolve() {
    return Promise.all(this.#unresolvedPromises)
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

  loadUrl = async (
    url: Parameters<typeof loadUrl>[0],
    options?: Parameters<typeof loadUrl>[1]
  ) => loadUrl(
    url,
    {
      proxyUrls: this.#constructorContext.proxyUrls ?? [],
      crawlerType: "cheerio",
      cachingProxyPort: this.#constructorContext.cachingProxyPort,
      ...options,
    }
  )

  loadRequest = async (
    requestHandler: RequestHandler,
    request: Omit<GenericRequest, "source" | "queryType"> & Partial<Pick<GenericRequest, "source" | "queryType">>,
    {
      secrets = {},
    }: {
      secrets?: GenericSecrets
    } = {}
  ) => {
    const sourceId = request.source ?? this.#constructorContext.sourceId
    const fullRequest = {
      ...request,
      source: sourceId,
      queryType: request.queryType ?? requestHandler.id
    }
    const constructorContext = {
      request: fullRequest,
      secrets,
      requestHandler,
      responseSchema: getResponseSchemaBasedOnRequest(requestHandler.responseSchema, fullRequest),
      sourceId,
    }
    return generateResponse(constructorContext)
  }

  guessMediaInfoFromUrl = guessMediaInfoFromUrl

  decodeHTML = (value: string) => decodeHTML(value)
}
