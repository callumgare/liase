import type { FetchNetworkError, GenericFetch } from "./types.js";

/**
 * Matcher for retry conditions based on status code, HTTP method, or network error code.
 *
 * - statusCode: Can be a string like "4xx" or "5xx" (wildcard patterns), a single number,
 *   or an array of numbers/strings
 * - method: HTTP method(s) to match (GET, POST, etc.)
 * - networkErrorCode: Network error code(s) to match (ETIMEDOUT, ECONNRESET, etc.)
 *
 * Matching logic: ALL keys present in a matcher must match. Multiple matchers in an array
 * use OR logic (match any one matcher).
 */
export interface RetryableResponseMatcher {
  statusCode?: string | number | (string | number)[];
  method?: string | string[];
  networkErrorCode?: string | string[];
}

/**
 * Backoff configuration for retry delays.
 */
export interface BackoffConfig {
  delay?: number; // Initial delay in milliseconds
  multiplier?: number; // Exponential backoff multiplier
}

/**
 * Retry options for the retry wrapper.
 */
export interface RetryOptions {
  maxAttempts?: number;
  backoff?: BackoffConfig;
  resToRetry?: RetryableResponseMatcher | RetryableResponseMatcher[];
}

/**
 * Utility type to add retry options to a RequestInit type.
 * Use this to extend any fetch init type with retry support.
 *
 * @example
 * type MyFetchInit = WithRetryOptions<RequestInit>;
 */
export type WithRetryOptions<T extends RequestInit = RequestInit> = T & {
  retry?: RetryOptions;
};

export class RetriesExhausted<TResponse extends Response> extends Error {
  finalResponse?: TResponse;

  constructor(
    message?: string,
    options: ErrorOptions & { response?: TResponse } = {},
  ) {
    const { response, ...restOptions } = options;
    super(message ?? "Retries exhausted", restOptions);
    this.name = "RetriesExhausted";
    this.finalResponse = response;
  }
}

/**
 * Extract the HTTP method from a request.
 */
function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  // If init explicitly specifies a method, use that
  if (init?.method) {
    return init.method.toUpperCase();
  }

  // If input is a Request object, use its method
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  // Default to GET
  return "GET";
}

/**
 * Check if a status code matches a pattern.
 * Patterns like "4xx" match any status code in that range.
 */
function matchesStatusCode(status: number, pattern: string | number): boolean {
  const normalisedStatus = String(status);
  const normalisedPattern = String(pattern).toLocaleLowerCase();

  if (normalisedPattern.length !== normalisedStatus.length) {
    return false;
  }
  // Not matching if any non-wildcard char in the pattern does't match the corresponding char in the status code
  for (let i = 0; i < normalisedPattern.length; i++) {
    if (
      normalisedPattern[i] !== "x" &&
      normalisedPattern[i] !== normalisedStatus[i]
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a status code matches any pattern in an array.
 */
function matchesAnyStatusCode(
  status: number,
  patterns: string | number | (string | number)[],
): boolean {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  return patternArray.some((pattern) => matchesStatusCode(status, pattern));
}

/**
 * Check if a method matches a pattern.
 */
function matchesMethod(
  method: string | undefined,
  pattern: string | string[],
): boolean {
  if (!method) {
    return false;
  }

  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  return patterns.some((p) => p.toUpperCase() === method.toUpperCase());
}

/**
 * Check if a network error code matches a pattern.
 */
function matchesErrorCode(
  errorCode: string | undefined,
  pattern: string | string[],
): boolean {
  if (!errorCode) {
    return false;
  }

  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  return patterns.some((p) => p === errorCode);
}

/**
 * Check if a response/error matches a single matcher object.
 * All keys present in the matcher must match.
 */
function matchesMatcher(
  response: Response | undefined,
  error: FetchNetworkError | undefined,
  matcher: RetryableResponseMatcher,
  method?: string,
): boolean {
  // If matcher has statusCode requirement
  if (matcher.statusCode !== undefined) {
    // Network errors don't have status codes, so they can't match statusCode requirement
    if (error && !response) {
      return false;
    }

    const status = response?.status;
    if (status === undefined) {
      return false;
    }

    if (!matchesAnyStatusCode(status, matcher.statusCode)) {
      return false;
    }
  }

  // If matcher has method requirement
  if (matcher.method !== undefined) {
    if (!method || !matchesMethod(method, matcher.method)) {
      return false;
    }
  }

  // If matcher has networkErrorCode requirement
  if (matcher.networkErrorCode !== undefined) {
    // Only network errors have error codes
    if (!error) {
      return false;
    }

    const errorCode = error.code;
    if (!matchesErrorCode(errorCode, matcher.networkErrorCode)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a response/error should be retried based on resToRetry matchers.
 */
function shouldRetry(
  response: Response | undefined,
  error: FetchNetworkError | undefined,
  resToRetry: RetryableResponseMatcher | RetryableResponseMatcher[] | undefined,
  method?: string,
): boolean {
  if (!resToRetry) {
    return false;
  }

  const matchers = Array.isArray(resToRetry) ? resToRetry : [resToRetry];

  // Match any one matcher (OR logic between matchers)
  return matchers.some((matcher) =>
    matchesMatcher(response, error, matcher, method),
  );
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const retryOptions = init?.retry;

    // If no retry options provided, just call the base fetch
    if (!retryOptions) {
      const { retry: _, ...cleanInit } = init ?? {};
      return baseFetch(input, cleanInit as TInit);
    }

    // Apply retry logic with the provided options
    const maxAttempts = retryOptions.maxAttempts ?? 3;
    const backoff = retryOptions.backoff ?? {};
    const initialDelay = backoff.delay ?? 1000;
    const multiplier = backoff.multiplier ?? 2;
    const { resToRetry } = retryOptions;
    const method = extractMethod(input, init);

    if (maxAttempts < 1) {
      throw new Error("maxAttempts must be at least 1");
    }

    // Remove retry from init before passing to base fetch
    const { retry: _, ...cleanInit } = init ?? {};
    const baseInit = cleanInit as TInit;

    let lastError: Error | undefined;
    let lastResponse: TResponse | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await baseFetch(input, baseInit);

        // Check if we should retry this response
        if (shouldRetry(response, undefined, resToRetry, method)) {
          if (attempt < maxAttempts) {
            // Wait before retrying
            const delay = initialDelay * multiplier ** attempt;
            await sleep(delay);

            continue;
          }

          throw new RetriesExhausted(
            "Retries exhausted due to response conditions",
            { response },
          );
        }

        return response;
      } catch (error) {
        if (error instanceof RetriesExhausted) {
          throw error;
        }
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          typeof error.code !== "string"
        ) {
          throw new Error(`Unexpected error type thrown by fetch: ${error}`, {
            cause: error,
          });
        }
        // I can't seem to narrow error.code from uknown to string so we resort to casting here
        const networkError = error as FetchNetworkError;

        // Check if we should retry this error
        if (
          attempt < maxAttempts &&
          shouldRetry(undefined, networkError, resToRetry, method)
        ) {
          // Wait before retrying
          const delay = initialDelay * multiplier ** attempt;
          await sleep(delay);

          continue;
        }

        throw error;
      }
    }

    // In theory we should never reach this point as we should either thrown or returned before getting here
    throw new Error("Unexpected retry state");
  };
}
