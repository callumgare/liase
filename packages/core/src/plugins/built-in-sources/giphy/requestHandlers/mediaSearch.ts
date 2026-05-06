import { z } from "zod";

import type { RequestHandler } from "@/src/schemas/requestHandler.js";
import { mediaResponseConstructor } from "../shared.js";
import { responseSchema } from "../types.js";

const giphyRatings = ["y", "g", "pg", "pg-13", "r"] as const;

export default {
  id: "search",
  displayName: "Search",
  description: "Finds gifs that match the given search text",
  requestSchema: z
    .object({
      source: z.string(),
      queryType: z.string(),
      searchText: z.string(),
      cursor: z.number().optional().describe("The page cursor"),
      pageSize: z
        .number()
        .optional()
        .default(10)
        .describe("The max number of items to be returned in a page"),
      contentRating: z
        .enum(giphyRatings)
        .default("g")
        .optional()
        .describe(
          "Highest allowed content rating: https://developers.giphy.com/docs/optional-settings/#rating",
        ),
    })
    .strict(),
  secretsSchema: z
    .object({
      apiKey: z.string(),
    })
    .strict(),
  paginationType: "cursor",
  responses: [
    {
      schema: responseSchema,
      constructor: {
        // We use $.fetch rather than the giphy-api library because giphy-api uses Node's
        // native http/https modules, which bypass the $.fetch caching wrapper. Without
        // caching, Giphy's dynamic ranking causes duplicate GIFs to appear across pages.
        _setup: async ($) => {
          const params = new URLSearchParams({
            api_key: $.secrets.apiKey,
            q: $.request.searchText,
            limit: String($.request.pageSize),
            rating: $.request.contentRating ?? "g",
            ...($.request.cursor !== undefined
              ? { offset: String($.request.cursor) }
              : {}),
          });
          const res = await $.fetch(
            `https://api.giphy.com/v1/gifs/search?${params}`,
          );
          if (!res.ok) {
            throw new Error(`Giphy API error: ${res.status}`);
          }
          return res.json();
        },
        page: {
          paginationType: () => "cursor",
          cursor: ($) => $().pagination.offset,
          nextCursor: ($) => $().pagination.offset + $().pagination.count,
          totalMedia: ($) => $().pagination.total_count,
          isLastPage: ($) =>
            $().pagination.count + $().pagination.offset >=
            $().pagination.total_count,
          url: ($) =>
            `https://giphy.com/search/${encodeURIComponent($.request.searchText)}`,
          pageFetchLimitReached: ($) => $.pageFetchLimitReached,
        },
        media: mediaResponseConstructor,
        request: ($) => $.request,
      },
    },
  ],
} as const satisfies RequestHandler;
