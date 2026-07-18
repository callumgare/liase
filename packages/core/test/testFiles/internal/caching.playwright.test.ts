import { type Server, createServer } from "node:http";
import type { Source } from "@/src/index.js";
import { afterEach, expect } from "vitest";
import { z } from "zod";
import { createBasicTestsForRequestHandlers } from "../../utils/vitest.js";

const playwrightCacheSource = {
  id: "playwright-cache-source",
  displayName: "Playwright Cache Source",
  description: "",
  requestHandlers: [
    {
      id: "get-title",
      displayName: "Get Title",
      description: "",
      requestSchema: z
        .object({
          source: z.string(),
          queryType: z.string(),
          pageNumber: z.number().default(1),
        })
        .strict(),
      paginationType: "offset",
      responses: [
        {
          schema: z
            .object({
              title: z.string(),
            })
            .passthrough(),
          constructor: {
            _setup: ($) =>
              $.loadUrl(getMockServerAddress(), {
                agent: "playwright",
                responseType: "rendered dom",
              }).then(async (res) => await res.title),
            media: [],
            title: ($) => $(),
            request: ($) => $.request,
            page: {
              paginationType: "offset",
              pageNumber: ($) => $.request.pageNumber ?? 1,
              pageFetchLimitReached: ($) => $.pageFetchLimitReached,
            },
          },
        },
      ],
    },
  ],
} as const satisfies Source;

let server: Server;

afterEach(async () => {
  await stopMockServer();
});

createBasicTestsForRequestHandlers({
  source: playwrightCacheSource,
  queries: {
    "get-title": [
      {
        testName:
          "Playwright loadUrl works with cachedResponseStrategy 'never'",
        before: async () => await startMockServer(),
        checkResponse: (response) =>
          expect(response?.title).toBe("Playwright Cache Title"),
        queryOptions: {
          cachedResponseStrategy: "never",
        },
      },
      {
        testName:
          "Playwright loadUrl works with cachedResponseStrategy 'if-cached'",
        before: async () => await startMockServer(),
        checkResponse: (response) =>
          expect(response?.title).toBe("Playwright Cache Title"),
        queryOptions: {
          cachedResponseStrategy: "if-cached",
        },
      },
      {
        testName:
          "Playwright loadUrl rejects cachedResponseStrategy 'exclusively'",
        before: async () => await startMockServer(),
        checkAllResponses: () => {},
        queryOptions: {
          cachedResponseStrategy: "exclusively",
        },
        expectError: /not supported for Playwright requests/,
      },
    ],
  },
  queriesShared: {
    timeout: 20_000,
    liaseOptions: {
      plugins: [
        {
          sources: [playwrightCacheSource],
        },
      ],
    },
  },
});

async function startMockServer() {
  server = createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      "<!doctype html><html><head><title>Playwright Cache Title</title></head><body><h1>Playwright Cache Title</h1></body></html>",
    );
  }).listen(0);

  return new Promise((resolve) => server.on("listening", resolve));
}

function getMockServerAddress() {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw Error("Failed to start server");
  }
  return `http://localhost:${address.port}`;
}

async function stopMockServer() {
  if (!server?.listening) {
    return;
  }

  server.closeAllConnections();

  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}
