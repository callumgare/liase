import type { GenericFetch } from "./types.js";
import {
  type WreqCreateSessionOptions,
  type WreqRequestInit,
  type WreqResponse,
  type WreqSession,
  createWreqFetchSession,
  wreqFetch,
} from "./wreq-fetch.js";

import {
  cacheResponse,
  getCachedResponse,
  wrapFetchWithCachingLogic,
} from "./caching.js";

import {
  type RetryOptions,
  type WithRetryOptions,
  wrapFetchWithRetryLogic,
} from "./retry.js";

// The specific fetchExtended client we export from this file is based off wreq-js's fetch client,
// but the createFetchExtended() function can be used to extend any fetch client.
export type FetchExtendedRequestInit<
  TInit extends RequestInit = WreqRequestInit,
> = WithRetryOptions<TInit>;

export type FetchExtended<
  TInit extends RequestInit = WreqRequestInit,
  TResponse extends Response = WreqResponse,
> = GenericFetch<FetchExtendedRequestInit<TInit>, TResponse>;

export type FetchExtendedResponse<TResponse extends Response = WreqResponse> =
  TResponse;

// Export caching types and functions
export { wrapFetchWithCachingLogic, getCachedResponse, cacheResponse };

// Unlike createFetchExtended(), createFetchExtendedSession() is specific to wreq-js, since there isn't a standard
// fetch session interface as there is with the fetch client.
export type FetchExtendedSessionOptions = WreqCreateSessionOptions & {
  retry?: RetryOptions;
  cache?: RequestCache;
};

export type FetchExtendedSession = WreqSession & {
  fetch: (
    input: RequestInfo | URL,
    init?: FetchExtendedRequestInit,
  ) => Promise<FetchExtendedResponse>;
};

/**
 * Create a fetch function with extended functionality (retry and caching support).
 * Wraps the provided fetch client and returns a function that can handle retry and cache options
 * passed via the init parameter. The returned function has the same init type as the
 * input fetch client, extended with retry and cache options.
 */
function createFetchExtended<
  TInit extends RequestInit,
  TResponse extends Response,
  TInitDefaults extends RequestInit,
>(
  fetchClient: GenericFetch<TInit, TResponse>,
  defaults?: WithRetryOptions<TInitDefaults>,
): GenericFetch<WithRetryOptions<TInit>, TResponse> {
  const retryDefaults: WithRetryOptions<RequestInit> = {
    retry: defaults?.retry,
  };
  const cacheDefaults = {
    cache: defaults?.cache,
  };
  return wrapFetchAndMergeDefaultInit(
    wrapFetchWithCachingLogic(
      wrapFetchWithRetryLogic(fetchClient),
      defaults?.cache,
    ),
    Object.assign({}, cacheDefaults, retryDefaults),
  );
}

function wrapFetchAndMergeDefaultInit<
  TInit extends RequestInit,
  TResponse extends Response,
  TInitDefaults extends RequestInit,
>(
  fetchClient: GenericFetch<TInit, TResponse>,
  defaults?: TInitDefaults,
): GenericFetch<TInit, TResponse> {
  return (input, init) => {
    const initWithDefaults = Object.assign({}, defaults, init);
    return fetchClient(input, initWithDefaults);
  };
}

/**
 * Create a fetch function with extended functionality (retry support).
 * Uses wreq-js for browser impersonation and optionally applies retry logic.
 * Wraps wreq-js to provide a standard fetch-compatible interface with retry support.
 */
export const fetchExtended = createFetchExtended(wreqFetch);

/**
 * Create a fetch session with extended functionality (retry support).
 * Returns a fetch function that maintains cookies and supports retries.
 * Default retry options can be provided and will be applied to all requests,
 * but can be overridden at call time.
 */
export async function createFetchExtendedSession(
  options?: FetchExtendedSessionOptions,
) {
  const { retry, cache, ...wreqSessionOptions } = options ?? {};

  // Create the underlying wreq-js session for cookie/session persistence
  const wreqSession = await createWreqFetchSession(wreqSessionOptions);

  // Wrap with retry and cache support using createFetchExtended
  // Construct defaults object - use any to avoid type conflicts with RequestInit.cache
  const defaults: WithRetryOptions<RequestInit> = {
    retry: options?.retry,
    cache: options?.cache,
  };

  const extendedFetch = createFetchExtended(
    wreqSession.fetch.bind(wreqSession),
    defaults,
  );

  return Object.assign(wreqSession, {
    fetch: extendedFetch,
  });
}
