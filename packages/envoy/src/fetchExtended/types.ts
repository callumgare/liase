/**
 * The type of error that fetch throws when a network error occurs.
 */
export type FetchNetworkError = Error & Record<"code", string>;

/**
 * Valid network error codes that can be matched.
 */
export const VALID_NETWORK_ERROR_CODES = [
  "ETIMEDOUT",
  "ECONNRESET",
  "EADDRINUSE",
  "ECONNREFUSED",
  "EPIPE",
  "ENOTFOUND",
  "ENETUNREACH",
  "EAI_AGAIN",
] as const;

export type ValidNetworkErrorCode = (typeof VALID_NETWORK_ERROR_CODES)[number];

// A type for a fetch client that implments at least the same base level interface as standard fetch, but may have
// additional properties or methods.
export type GenericFetch<
  TInit extends RequestInit = RequestInit,
  TResponse extends Response = Response,
> = (input: RequestInfo | URL, init?: TInit) => Promise<TResponse>;
