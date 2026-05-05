import { z } from "zod";

import type { RequestHandler } from "@/src/schemas/requestHandler.js";
import { getAgent } from "../client.js";
import { postsToMediaResponseConstructor } from "../shared.js";
import { responseSchema } from "../types.js";

export default {
  id: "feed",
  displayName: "Feed",
  description: "Get all media in a feed",
  requestSchema: z
    .object({
      source: z.string(),
      queryType: z.string(),
      feedId: z.string(),
      cursor: z.string().optional().describe("The page cursor"),
      maxPostCount: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(25)
        .describe("The max number of posts from which to extract media from"),
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
            feed: $.request.feedId,
            ...($.request.maxPostCount
              ? { limit: $.request.maxPostCount }
              : {}),
            ...($.request.cursor ? { cursor: $.request.cursor } : {}),
          };
          let res: unknown;
          try {
            const agent = await getAgent({
              $,
              handle: $.secrets.handle,
              password: $.secrets.password,
              serviceUrl: $.secrets.serviceUrl,
            });
            const apiRes = await agent.app.bsky.feed.getFeed(params);
            res = apiRes;
            if (!apiRes.success) {
              throw Error("Unsuccessful request to Bluesky");
            }
            return apiRes.data;
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
