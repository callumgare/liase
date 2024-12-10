import { z } from "zod";

import { responseSchema } from "../types.js";
import { postsToMediaResponseConstructor } from "../shared.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";
import { getAgent } from "../client.js";

export default {
  id: "search",
  displayName: "Search",
  description: "Search network for media",
  requestSchema: z
    .object({
      source: z.string(),
      queryType: z.string(),
      sort: z.enum(["latest", "top"]).optional(),
      searchText: z.string().default("*"),
      tags: z.array(z.string()).optional(),
      since: z.union([z.date(), z.string()]).optional(),
      until: z.union([z.date(), z.string()]).optional(),
      cursor: z.string().optional().describe("The page cursor"),
      pageSize: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(25)
        .describe("The max number of items to be returned in a page"),
    })
    .strict(),
  secretsSchema: z
    .object({
      handle: z.string().optional(),
      password: z.string().optional(),
      serviceUrl: z.string().optional(),
    })
    .strict(),
  paginationType: "cursor",
  responses: [
    {
      schema: responseSchema,
      constructor: {
        _setup: async ($) => {
          const params = {
            ...($.request.pageSize ? { limit: $.request.pageSize } : {}),
            ...($.request.since ? { since: $.request.since } : {}),
            ...($.request.until ? { until: $.request.until } : {}),
            ...($.request.cursor ? { cursor: $.request.cursor } : {}),
            ...($.request.sort ? { sort: $.request.sort } : {}),
            q: [
              $.request.searchText,
              ...($.request.tags || []).map((tag: string) => `#${tag}`),
            ].join(" "),
          };
          let res;
          try {
            const agent = await getAgent({
              $,
              handle: $.secrets.handle,
              password: $.secrets.password,
              serviceUrl: $.secrets.serviceUrl,
            });
            res = await agent.app.bsky.feed.searchPosts(params);
            if (!res.success) {
              throw Error("Unsuccessful request to Bluesky");
            }
            return res.data;
          } catch (error) {
            console.info("Request sent to Bluesky:", params);
            console.info("Response:", res);
            throw error;
          }
        },
        page: {
          paginationType: () => "cursor",
          cursor: ($) => $.request.cursor || "",
          nextCursor: ($) => $().cursor ?? null,
          isLastPage: ($) => typeof $().cursor === "undefined",
          pageFetchLimitReached: ($) => $.pageFetchLimitReached,
        },
        media: postsToMediaResponseConstructor,
        request: ($) => $.request,
      },
    },
  ],
} as const satisfies RequestHandler;
