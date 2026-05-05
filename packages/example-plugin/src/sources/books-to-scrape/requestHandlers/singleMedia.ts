import { z } from "zod";

import { singleMediaResponseSchema } from "../types.js";
import { rootUrl, sourceId } from "../shared.js";
import type { RequestHandler } from "media-finder";

const requestSchema = z
  .object({
    source: z.string(),
    queryType: z.string(),
    id: z.string(),
  })
  .strict();

export default {
  id: "single-media",
  displayName: "Single media",
  description: "Find book with given id",
  requestSchema,
  paginationType: "none",
  responses: [
    {
      schema: singleMediaResponseSchema.extend({ request: requestSchema }),
      constructor: {
        _setup: async ($) => {
          const encodedId = encodeURIComponent($.request.id);
          $.set("url", `${rootUrl}catalogue/${encodedId}/index.html`);
          return $.loadUrl($("url")).then((res) => res.root);
        },
        media: [
          {
            mediaFinderSource: sourceId,
            id: ($) => $.request.id,
            url: ($) => $("url"),
            title: ($) => $().select(".product_page h1").text,
            description: ($) => $().select("#product_description + p").text,
            files: [
              {
                _setup: ($) => {
                  const relativeUrl = $()
                    .select("#product_gallery img")
                    .attr("src");
                  const url = new URL(relativeUrl, $("url"));
                  return $.guessMediaInfoFromUrl(url.href);
                },
                type: "full",
                url: ($) => $().url,
                ext: ($) => $().ext,
                mimeType: ($) => $().mimeType,
                image: ($) => $().image,
                video: ($) => $().video,
              },
            ],
          },
        ],
        request: ($) => $.request,
      },
    },
  ],
} as const satisfies RequestHandler;
