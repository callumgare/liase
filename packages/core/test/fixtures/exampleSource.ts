import { z } from "zod";
import { Source } from "@/src/index.js";

const sourceName = "Example Source";
const sourceId = "example-source";

const exampleFileSchema = z
  .object({
    type: z.literal("full"),
    url: z.string().url(),
    ext: z.string().regex(/^\w+$/),
  })
  .strict();

const exampleMediaSchema = z
  .object({
    mediaFinderSource: z.literal(sourceId),
    id: z.string(),
    title: z.string(),
    files: z.array(exampleFileSchema),
  })
  .strict();

const exampleResponseSchema = z
  .object({
    page: z
      .object({
        paginationType: z.literal("offset"),
        pageNumber: z.number().int(),
        isLastPage: z.boolean(),
        pageFetchLimitReached: z.boolean(),
      })
      .strict(),
    media: z.array(exampleMediaSchema),
    request: z.object({}).passthrough(),
  })
  .strict();

export default {
  id: sourceId,
  displayName: sourceName,
  description: "",
  requestHandlers: [
    {
      id: "single-media",
      displayName: "Single media",
      description: "",
      requestSchema: z
        .object({
          source: z.string(),
          queryType: z.string(),
          id: z.string(),
        })
        .strict(),
      paginationType: "none",
      responses: [
        {
          schema: exampleResponseSchema.omit({ page: true }),
          constructor: {
            _setup: ($) => $.loadUrl("https://example.com/"),
            media: [
              {
                mediaFinderSource: () => sourceId,
                id: "1234",
                title: ($) =>
                  $.request.id === "test-getWebpage"
                    ? $().root.select("h1")
                    : "Media Title",
                files: [],
              },
            ],
            request: ($) => $.request,
          },
        },
      ],
    },
    {
      id: "search-media",
      displayName: "Search media",
      description: "",
      requestSchema: z
        .object({
          source: z.string(),
          queryType: z.string(),
          searchText: z.string(),
          pageNumber: z.number().default(1),
        })
        .strict(),
      paginationType: "offset",
      responses: [
        {
          schema: exampleResponseSchema,
          constructor: {
            page: {
              paginationType: "offset",
              pageNumber: ($) => $.request.pageNumber ?? 1,
              isLastPage: ($) => $.request.pageNumber >= 2,
              pageFetchLimitReached: ($) => $.pageFetchLimitReached,
            },
            media: [
              {
                mediaFinderSource: sourceId,
                id: ($) => `${$.request.pageNumber}-a`,
                title: "Media Title",
                files: [],
              },
            ],
            request: ($) => $.request,
          },
        },
      ],
    },
  ],
} as const satisfies Source;
