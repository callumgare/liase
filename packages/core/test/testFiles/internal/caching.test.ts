import { afterEach, describe, expect, it } from "vitest";
import currentTimeSource, {
  startMockServer,
  stopMockServer,
} from "../../fixtures/currentTimeSource.js";
import { createBasicTestsForRequestHandlers } from "../../utils/vitest.js";

afterEach(async () => {
  await stopMockServer();
});

createBasicTestsForRequestHandlers({
  source: currentTimeSource,
  queries: {
    "current-time": [
      {
        testName:
          "Responses are not cached with 'never' strategy using loadUrl",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).not.toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "never",
        },
      },
      {
        testName: "Responses are not cached with 'never' strategy using fetch",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).not.toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "never",
        },
      },
      {
        testName:
          "Cacheable responses are cached and reused with 'if-fresh' strategy using fetch",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "if-fresh",
        },
      },
      {
        testName:
          "Cacheable responses are cached and reused with 'if-cached' strategy using loadUrl",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "if-cached",
        },
      },
      {
        testName:
          "Non-cacheable responses are still cached with 'if-cached' strategy using loadUrl",
        before: async () => await startMockServer(false),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "if-cached",
        },
      },
      {
        testName:
          "Cacheable responses are cached and reused with 'if-cached' strategy using fetch",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "if-cached",
        },
      },
      {
        testName:
          "Non-cacheable responses are still cached with 'if-cached' strategy using fetch",
        before: async () => await startMockServer(false),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cachedResponseStrategy: "if-cached",
        },
      },
      {
        testName:
          "Default setting for cachedResponseStrategy in tests is 'if-cached'",
        before: async () => await startMockServer(false),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
      },
    ],
  },
  queriesShared: {
    liaseOptions: {
      plugins: [
        {
          sources: [currentTimeSource],
        },
      ],
    },
  },
});
