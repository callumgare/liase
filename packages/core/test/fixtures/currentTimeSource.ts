import { Source } from "@/src/index.js";
import { z } from "zod";
import { createServer, Server } from "node:http";

export default {
  id: "current-time",
  displayName: "Current Time",
  description: "",
  requestHandlers: [
    {
      id: "current-time",
      displayName: "Current Time",
      description: "",
      requestSchema: z
        .object({
          source: z.string(),
          queryType: z.string(),
          pageNumber: z.number().default(1),
          requestMethod: z.enum(["loadUrl", "fetch"]),
        })
        .strict(),
      paginationType: "offset",
      responses: [
        {
          schema: z
            .object({
              time: z.number(),
            })
            .passthrough(),
          constructor: {
            _setup: ($) =>
              $.request.requestMethod === "loadUrl"
                ? $.loadUrl(getMockServerAddress(), {
                    responseType: "json",
                  }).then((res) => res.data)
                : $.fetch(getMockServerAddress()).then((res) => res.json()),
            media: [],
            time: ($) => $(),
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

export async function startMockServer(cacheable: boolean) {
  server = createServer((req, res) => {
    if (cacheable) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
    res.end(Date.now().toString());
  }).listen(0);

  return new Promise((resolve) => server.on("listening", resolve));
}

export function getMockServerAddress() {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw Error("Failed to start server");
  }
  return `http://localhost:${address.port}`;
}

export async function stopMockServer() {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}
