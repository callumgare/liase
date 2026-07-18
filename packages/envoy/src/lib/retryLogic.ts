/**
 * Generic retry logic that can wrap any request client.
 * This module provides the core retry matching and backoff logic.
 */

import type { FetchNetworkError } from "../fetchExtended/types.js";

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

/**
 * A generic request client that accepts any arguments and returns a promise response.
 * The type parameter represents both the request args and the response type.
 */
export type RequestClient<TRequest extends readonly unknown[], TResponse> = (
  ...args: TRequest
) => Promise<TResponse>;

/**
 * Extracts retry-relevant information from a request and response.
 * Returns status code, error information, and HTTP method for the retry logic to decide whether to retry.
 */
export type RetryInfoExtractor<
  TRequest extends readonly unknown[],
  TResponse,
> = (
  request: TRequest,
  response: TResponse,
) => {
  statusCode?: number;
  error?: FetchNetworkError;
  method?: string;
};

/**
 * Retry information extracted from a request and response.
 */
export interface RetryInfo {
  statusCode?: number;
  error?: FetchNetworkError;
  method?: string;
}

export class RetriesExhausted<TResponse> extends Error {
  attempts: number;
  finalResponse?: TResponse;
  finalStatusCode?: number;

  constructor(
    message?: string,
    options: {
      attempts?: number;
      response?: TResponse;
      statusCode?: number;
    } = {},
  ) {
    super(message ?? "Retries exhausted");
    this.name = "RetriesExhausted";
    this.attempts = options.attempts ?? 0;
    this.finalResponse = options.response;
    this.finalStatusCode = options.statusCode;
  }
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

function matchesAnyStatusCode(
  status: number,
  patterns: string | number | (string | number)[],
): boolean {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  return patternArray.some((pattern) => matchesStatusCode(status, pattern));
}

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

function matchesMatcher(
  statusCode: number | undefined,
  error: FetchNetworkError | undefined,
  matcher: RetryableResponseMatcher,
  method?: string,
): boolean {
  if (matcher.statusCode !== undefined) {
    if (error && statusCode === undefined) {
      return false;
    }
    if (statusCode === undefined) {
      return false;
    }
    if (!matchesAnyStatusCode(statusCode, matcher.statusCode)) {
      return false;
    }
  }

  if (matcher.method !== undefined) {
    if (!method || !matchesMethod(method, matcher.method)) {
      return false;
    }
  }

  if (matcher.networkErrorCode !== undefined) {
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

function shouldRetry(
  statusCode: number | undefined,
  error: FetchNetworkError | undefined,
  resToRetry: RetryableResponseMatcher | RetryableResponseMatcher[] | undefined,
  method?: string,
): boolean {
  if (!resToRetry) {
    return false;
  }
  const matchers = Array.isArray(resToRetry) ? resToRetry : [resToRetry];
  return matchers.some((matcher) =>
    matchesMatcher(statusCode, error, matcher, method),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic retry wrapper that works with any request client.
 * Returns a wrapped function with the same type signature as the input client.
 *
 * @param makeRequest - The request client to wrap
 * @param extractRetryInfo - Callback that extracts retry-relevant info from request and response
 * @param retryOptions - Retry configuration
 * @returns A wrapped function with the same type as makeRequest
 */
export function retryWithLogic<TRequest extends readonly unknown[], TResponse>(
  makeRequest: RequestClient<TRequest, TResponse>,
  extractRetryInfo: RetryInfoExtractor<TRequest, TResponse>,
  retryOptions?: RetryOptions,
): RequestClient<TRequest, TResponse> {
  return async (...args: TRequest): Promise<TResponse> => {
    if (!retryOptions) {
      return makeRequest(...args);
    }

    const maxAttempts = retryOptions.maxAttempts ?? 3;
    const backoff = retryOptions.backoff ?? {};
    const initialDelay = backoff.delay ?? 1000;
    const multiplier = backoff.multiplier ?? 2;
    const { resToRetry } = retryOptions;

    if (maxAttempts < 1) {
      throw new Error("maxAttempts must be at least 1");
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await makeRequest(...args);
        const retryInfo = extractRetryInfo(args, response);

        if (
          shouldRetry(
            retryInfo.statusCode,
            retryInfo.error,
            resToRetry,
            retryInfo.method,
          )
        ) {
          if (attempt < maxAttempts) {
            const delay = initialDelay * multiplier ** attempt;
            await sleep(delay);
            continue;
          }
          throw new RetriesExhausted(
            "Retries exhausted due to response conditions",
            {
              attempts: attempt,
              response,
              statusCode: retryInfo.statusCode,
            },
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
          throw new Error(
            `Unexpected error type thrown by request client: ${error}`,
            {
              cause: error,
            },
          );
        }
        const networkError = error as FetchNetworkError;

        if (
          attempt < maxAttempts &&
          shouldRetry(undefined, networkError, resToRetry)
        ) {
          const delay = initialDelay * multiplier ** attempt;
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unexpected retry state");
  };
}
