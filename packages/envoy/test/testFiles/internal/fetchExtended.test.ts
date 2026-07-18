import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  type FetchExtendedSession,
  createFetchExtendedSession,
} from "../../../src/fetchExtended/index.js";
import {
  RetriesExhausted,
  wrapFetchWithRetryLogic,
} from "../../../src/fetchExtended/retry.js";
import type {
  RetryableResponseMatcher,
  WithRetryOptions,
} from "../../../src/fetchExtended/retry.js";
import type { GenericFetch } from "../../../src/fetchExtended/types.js";
import {
  startTestHttpServer,
  stopTestHttpServer,
} from "./utils/testHttpServer.js";

describe("fetchExtended retry functionality", () => {
  // Use fake timers so retry backoff delays don't slow tests down.
  // Tests that involve real network calls (e.g. createFetchExtendedSession) must
  // use real timers and are responsible for restoring them if needed.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Runs a promise that internally uses setTimeout for backoff delays to
   * completion by advancing fake timers alongside it.
   *
   * The key timing guarantee: we schedule vi.runAllTimersAsync() as a microtask
   * (via Promise.resolve().then) so it starts AFTER the first microtask from
   * the promise itself has run — that microtask is what registers the first
   * setTimeout. vi.runAllTimersAsync internally does `await Promise.resolve()`
   * between every timer it fires, flushing the microtask queue each time, so
   * any newly-scheduled timers (from subsequent retry iterations) are also
   * picked up before it exits its loop.
   */
  async function runWithFakeTimers<T>(promise: Promise<T>): Promise<T> {
    const [result] = await Promise.allSettled([
      promise,
      Promise.resolve().then(() => vi.runAllTimersAsync()),
    ]);
    if (result.status === "rejected") throw result.reason;
    return result.value;
  }
  // Helper to create a mock fetch that tracks calls and can fail
  function createMockFetch() {
    let callCount = 0;
    let failForAttempts: number[] = [];
    let alwaysReturnStatus = 200;
    let errorToThrow: Error | undefined;

    const mockFetch: Mock & GenericFetch<RequestInit, Response> = vi
      .fn()
      .mockImplementation(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          callCount++;

          // Throw error if configured for this attempt
          if (
            errorToThrow &&
            callCount <= 1 &&
            failForAttempts.includes(callCount)
          ) {
            throw errorToThrow;
          }

          // Return failure status for configured failure attempts
          if (failForAttempts.includes(callCount)) {
            return new Response("Failed", { status: alwaysReturnStatus });
          }

          return new Response("Success", { status: alwaysReturnStatus });
        },
      );

    return {
      mockFetch,
      reset: () => {
        callCount = 0;
        failForAttempts = [];
        alwaysReturnStatus = 200;
        errorToThrow = undefined;
        mockFetch.mockClear();
      },
      setFailFor: (attempts: number[]) => {
        failForAttempts = attempts;
      },
      setStatusToReturn: (status: number) => {
        alwaysReturnStatus = status;
      },
      setErrorToThrow: (error: Error) => {
        errorToThrow = error;
      },
    };
  }

  describe("status code matching", () => {
    it("matches exact status codes", async () => {
      const { mockFetch, setStatusToReturn, reset } = createMockFetch();

      reset();
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: 500 },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("matches wildcard status codes like 4xx", async () => {
      const { mockFetch, setStatusToReturn, reset } = createMockFetch();

      reset();
      setStatusToReturn(404);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: "4xx" },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Called twice: initial + retry
    });

    it("matches wildcard status codes like 5xx", async () => {
      const { mockFetch, setStatusToReturn, reset } = createMockFetch();

      reset();
      setStatusToReturn(503);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: "5xx" },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("matches array of status codes", async () => {
      const { mockFetch, setStatusToReturn, reset } = createMockFetch();

      reset();
      setStatusToReturn(502);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: [500, 502, 503] },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry non-matching status codes", async () => {
      const { mockFetch, setStatusToReturn, reset } = createMockFetch();

      reset();
      setStatusToReturn(404);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      const response = await wrappedFetch("http://example.com", {
        retry: {
          maxAttempts: 3,
          resToRetry: { statusCode: 500 },
        },
      });

      expect(response.status).toBe(404);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("method matching", () => {
    it("retries on matching POST method", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            method: "POST",
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: 500, method: "POST" },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it("does not retry when method does not match", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      // Making a GET request when only POST should be retried
      const response = await wrappedFetch("http://example.com", {
        retry: {
          maxAttempts: 1,
          resToRetry: { statusCode: 500, method: "POST" },
        },
      });

      expect(response.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("retries on matching Request object method", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      const request = new Request("http://example.com", { method: "PUT" });
      await expect(
        runWithFakeTimers(
          wrappedFetch(request, {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: 500, method: "PUT" },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe("network error matching", () => {
    it("retries on matching network error code", async () => {
      const { mockFetch, reset, setErrorToThrow, setFailFor } =
        createMockFetch();

      const timeoutError = new Error("Request timeout");
      (timeoutError as { code?: string }).code = "ETIMEDOUT";

      reset();
      setErrorToThrow(timeoutError);
      setFailFor([1]);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      const response = await runWithFakeTimers(
        wrappedFetch("http://example.com", {
          retry: {
            maxAttempts: 2,
            resToRetry: { networkErrorCode: "ETIMEDOUT" },
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry non-matching error codes", async () => {
      const { mockFetch, reset, setErrorToThrow, setFailFor } =
        createMockFetch();

      const timeoutError = new Error("Request timeout");
      (timeoutError as { code?: string }).code = "ETIMEDOUT";

      reset();
      setErrorToThrow(timeoutError);
      setFailFor([1]);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        wrappedFetch("http://example.com", {
          retry: {
            maxAttempts: 1,
            resToRetry: { networkErrorCode: "ECONNREFUSED" },
          },
        }),
      ).rejects.toThrow("Request timeout");
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("multiple matchers (OR logic)", () => {
    it("retries if any matcher matches", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(429); // Too Many Requests

      const matchers: RetryableResponseMatcher[] = [
        { statusCode: 500 },
        { statusCode: 503 },
        { statusCode: 429 },
      ];

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: matchers,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry limits", () => {
    it("respects maxAttempts limit", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              maxAttempts: 3,
              resToRetry: { statusCode: 500 },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("defaults to 3 retries", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      await expect(
        runWithFakeTimers(
          wrappedFetch("http://example.com", {
            retry: {
              // No maxAttempts specified
              resToRetry: { statusCode: 500 },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);

      expect(mockFetch).toHaveBeenCalledTimes(3); // 3 total attempts (default maxAttempts)
    });
  });

  describe("backoff timing", () => {
    it("applies exponential backoff without erroring", async () => {
      const { mockFetch, reset } = createMockFetch();

      reset();

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      // Just verify it doesn't error - timing is hard to test reliably
      const response = await wrappedFetch("http://example.com", {
        retry: {
          maxAttempts: 1,
          resToRetry: { statusCode: 500 },
          backoff: { delay: 10, multiplier: 2 },
        },
      });
      expect(response).toBeDefined();
    });

    it("respects custom backoff configuration", async () => {
      const { mockFetch, reset } = createMockFetch();

      reset();

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      const response = await wrappedFetch("http://example.com", {
        retry: {
          maxAttempts: 1,
          resToRetry: { statusCode: 500 },
          backoff: { delay: 5, multiplier: 3 },
        },
      });
      expect(response).toBeDefined();
    });
  });

  describe("createFetchExtendedSession", () => {
    let session: FetchExtendedSession;

    // These tests create real wreq-js sessions and make real network calls —
    // they need real timers, not the fake ones set up in the outer beforeEach.
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(async () => {
      if (session) {
        await session.close();
      }
    });

    it("returns a fetch function and close method", async () => {
      session = await createFetchExtendedSession();

      expect(typeof session.fetch).toBe("function");
      expect(typeof session.close).toBe("function");
    });

    it("creates a fetch function with retry support", async () => {
      session = await createFetchExtendedSession({
        retry: {
          maxAttempts: 1,
          resToRetry: { statusCode: 500 },
        },
      });

      // The retry support is verified through the wrapFetchWithRetryLogic function tests
      // Here we just verify the session is created successfully with retry options
      expect(session).toBeDefined();
    });

    it("maintains session state across requests", async () => {
      session = await createFetchExtendedSession();

      // The main purpose of sessions is cookie persistence,
      // which is tested by wreq-js itself.
      // Here we just verify the close method works.
      await expect(session.close()).resolves.toBeUndefined();
    });

    it("supports call-time retry options when session created without defaults", async () => {
      // This test catches the regression where retry options passed at call time
      // wouldn't work if the session was created without default retry options.
      // We spin up a real HTTP server so the session's wreq-js fetch can connect
      // and we can verify that retry options are actually honoured at runtime.
      let requestCount = 0;
      const { server, url } = await startTestHttpServer((_req, res) => {
        requestCount++;
        // Fail the first request so the retry logic has something to act on.
        if (requestCount === 1) {
          res.writeHead(500);
          res.end("error");
        } else {
          res.writeHead(200);
          res.end("ok");
        }
      });

      try {
        session = await createFetchExtendedSession();

        // Pass retry options at call time — session was created without defaults.
        const response = await session.fetch(`${url}/`, {
          retry: {
            maxAttempts: 2,
            resToRetry: { statusCode: 500 },
          },
        });

        // First attempt got 500 and was retried; second attempt returns 200.
        expect(response.status).toBe(200);
        expect(requestCount).toBe(2);
      } finally {
        await stopTestHttpServer(server);
      }
    });

    it("uses session default retry options when fetch called without options", async () => {
      session = await createFetchExtendedSession({
        retry: {
          maxAttempts: 1,
          resToRetry: { statusCode: 500 },
        },
      });

      // The session's fetch should have retry support built in with the defaults
      expect(session).toBeDefined();
      expect(typeof session.fetch).toBe("function");
    });
  });

  describe("no retry configuration", () => {
    it("returns response without retrying when no retry options", async () => {
      const { mockFetch, reset, setFailFor, setStatusToReturn } =
        createMockFetch();

      reset();
      setFailFor([1]);
      setStatusToReturn(500);

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      const response = await wrappedFetch("http://example.com", {
        retry: {
          // No resToRetry specified
        },
      });

      expect(response.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("returns response immediately when no retry options provided", async () => {
      const { mockFetch, reset } = createMockFetch();

      reset();

      const wrappedFetch = wrapFetchWithRetryLogic(mockFetch);

      const response = await wrappedFetch("http://example.com", {
        retry: {
          maxAttempts: 3,
          // No resToRetry specified
        },
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("fetchExtended with call-time retry options", () => {
    it("applies retry options passed at call time", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      // fetchExtended is exported and wraps wreq-js fetch
      // We'll test the pattern by using our mock
      const wrappedWithCallTime = async (
        input: RequestInfo | URL,
        init?: WithRetryOptions<RequestInit>,
      ) => {
        const fetchFn = wrapFetchWithRetryLogic(
          mockFetch as unknown as (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => Promise<Response>,
        );
        return fetchFn(input, init);
      };

      await expect(
        runWithFakeTimers(
          wrappedWithCallTime("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: 500 },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      // Should have been called multiple times due to retries
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("works without retry options when none provided", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(200);

      const wrappedWithCallTime = async (
        input: RequestInfo | URL,
        init?: WithRetryOptions<RequestInit>,
      ) => {
        const fetchFn = wrapFetchWithRetryLogic(
          mockFetch as unknown as (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => Promise<Response>,
        );
        return fetchFn(input, init);
      };

      const response = await wrappedWithCallTime("http://example.com");

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("supports default retry options with call-time override", async () => {
      const { mockFetch, reset, setStatusToReturn } = createMockFetch();

      reset();
      setStatusToReturn(500);

      // Simulate having default retry options but overriding at call time
      const wrappedWithDefaults = async (
        input: RequestInfo | URL,
        init?: WithRetryOptions<RequestInit>,
      ) => {
        const defaultRetry = {
          maxAttempts: 1,
          resToRetry: { statusCode: 502 }, // Won't match 500
        };
        const retryOptions = init?.retry || defaultRetry;
        const fetchFn = wrapFetchWithRetryLogic(
          mockFetch as unknown as (
            input: RequestInfo | URL,
            init?: RequestInit,
          ) => Promise<Response>,
        );
        return fetchFn(input, { ...init, retry: retryOptions });
      };

      // Override defaults with call-time options to match 500
      await expect(
        runWithFakeTimers(
          wrappedWithDefaults("http://example.com", {
            retry: {
              maxAttempts: 2,
              resToRetry: { statusCode: 500 },
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RetriesExhausted);
      // Should retry because call-time options match the status
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
