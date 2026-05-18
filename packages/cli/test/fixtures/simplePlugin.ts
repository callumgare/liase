import type { Plugin } from "@liase/core";
import { z } from "zod";

export default {
  sources: [
    {
      id: "test-source",
      displayName: "Test Source",
      description: "A simple source used in CLI tests",
      requestHandlers: [
        {
          id: "list",
          displayName: "List",
          description: "List items by tag",
          requestSchema: z
            .object({
              source: z.string(),
              queryType: z.string(),
              tag: z.string().describe("Tag to filter by"),
            })
            .strict(),
          paginationType: "none",
          responses: [
            {
              schema: z
                .object({
                  media: z.array(z.object({}).passthrough()),
                  request: z.object({}).passthrough(),
                })
                .passthrough(),
              constructor: {
                media: [
                  {
                    liaseSource: "test-source",
                    id: "item-1",
                    title: ($) => `Tagged: ${$.request.tag}`,
                    files: [],
                  },
                ],
                request: ($) => $.request,
              },
            },
          ],
        },
      ],
    },
  ],
} satisfies Plugin;
