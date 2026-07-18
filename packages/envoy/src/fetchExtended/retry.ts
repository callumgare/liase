import type {
  BackoffConfig,
  RetryOptions,
  RetryableResponseMatcher,
  WithRetryOptions,
} from "../lib/retryLogic.js";
import { RetriesExhausted, retryWithLogic } from "../lib/retryLogic.js";
import type { GenericFetch } from "./types.js";

export type {
  RetryOptions,
  RetryableResponseMatcher,
  BackoffConfig,
  WithRetryOptions,
};
export { RetriesExhausted };

/**
 * Extract the HTTP method from a request.
 */
function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

/**
 * Wrap a fetch function to support retry options.
 * Returns a function that extends the fetch client's init type to include retry options.
 * Retry logic is applied only if retry options are provided at call time.
 */
export function wrapFetchWithRetryLogic<
  TInit extends RequestInit,
  TResponse extends Response,
>(
  baseFetch: GenericFetch<TInit, TResponse>,
): GenericFetch<WithRetryOptions<TInit>, TResponse> {
  return async (input, init) => {
    // Extract retry options from init
    const retryOptions = init?.retry;
    const { retry: _, ...cleanInit } = init ?? {};
    const baseInit = cleanInit as TInit;

    // Create the retry-enabled wrapper
    const wrappedFetch = retryWithLogic(
      baseFetch,
      ([input, init], response) => {
        const method = extractMethod(input, init);
        return { statusCode: response.status, method };
      },
      retryOptions,
    );

    // Call the wrapped fetch with the cleaned args
    return wrappedFetch(input, baseInit);
  };
}
