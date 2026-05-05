import { z } from "zod";
import Giphy, { SearchOptions } from "giphy-api";

import { responseSchema } from "../types.js";
import { mediaResponseConstructor } from "../shared.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";

const giphyRatings = ["y", "g", "pg", "pg-13", "r"] as const;

// Validate that our array of ratings matches type used by Giphy API
type IsEqual<Type1, Type2> = Type1 | Type2 extends Type1 & Type2 ? true : never;
true satisfies IsEqual<(typeof giphyRatings)[number], SearchOptions["rating"]>;

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
        _setup: ($) =>
          Giphy($.secrets.apiKey).search({
            q: $.request.searchText,
            limit: $.request.pageSize,
            rating: $.request.contentRating,
            offset: $.request.cursor,
          }),
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
