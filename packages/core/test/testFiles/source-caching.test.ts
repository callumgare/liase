import { afterEach, expect } from "vitest";
import { createBasicTestsForRequestHandlers } from "../utils/vitest.js";
import currentTimeSource, {
  startMockServer,
  stopMockServer,
} from "../fixtures/currentTimeSource.js";

afterEach(async () => {
  await stopMockServer();
});

createBasicTestsForRequestHandlers({
  source: currentTimeSource,
  queries: {
    "current-time": [
      {
        testName:
          "Responses are not cached if cacheNetworkRequests = never using loadUrl",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).not.toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "never",
        },
      },
      {
        testName:
          "Responses are not cached if cacheNetworkRequests = never using fetch",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).not.toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "never",
        },
      },
      {
        testName: "cacheNetworkRequests = auto is not currently supported",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).not.toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "auto",
        },
        expectError: /not yet supported/,
      },
      {
        testName:
          "Responses that indicate they are cacheable are cached if cacheNetworkRequests = always using loadUrl",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "always",
        },
      },
      {
        testName:
          "Responses that indicate they are not cacheable are cached anyway if cacheNetworkRequests = always using loadUrl",
        before: async () => await startMockServer(false),
        request: {
          requestMethod: "loadUrl",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "always",
        },
      },
      {
        testName:
          "Responses that indicate they are cacheable are cached if cacheNetworkRequests = always using fetch",
        before: async () => await startMockServer(true),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "always",
        },
      },
      {
        testName:
          "Responses that indicate they are not cacheable are cached anyway if cacheNetworkRequests = always using fetch",
        before: async () => await startMockServer(false),
        request: {
          requestMethod: "fetch",
        },
        checkAllResponses: (responses) =>
          expect(responses[0].time).toEqual(responses[1].time),
        numOfPagesToLoad: 2,
        queryOptions: {
          cacheNetworkRequests: "always",
        },
      },
      {
        testName: "Default setting for cacheNetworkRequests in tests is always",
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
    finderOptions: {
      plugins: [
        {
          sources: [currentTimeSource],
        },
      ],
    },
  },
});
