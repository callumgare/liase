import { z } from "zod";

import type { Constructor, RequestHandler } from "@liase/core";
import { rootUrl, sourceId } from "../shared.js";
import { singleMediaResponseSchema } from "../types.js";

const requestSchema = z
  .object({
    source: z.string(),
    queryType: z.string(),
    id: z.string(),
  })
  .strict();

const responseConstructor = {
  _setup: async ($) => {
    const encodedId = encodeURIComponent($.request.id);
    $.set("url", `${rootUrl}catalogue/${encodedId}/index.html`);
    return $.loadUrl($("url")).then((res) => res.root);
  },
  media: [
    {
      liaseSource: sourceId,
      id: ($) => $.request.id,
      url: ($) => $("url"),
      title: ($) => $().getFirst(".product_page h1").text,
      description: ($) => $().getFirst("#product_description + p").text,
      files: [
        {
          _setup: ($) => {
            const relativeUrl = $()
              .getFirst("#product_gallery img")
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
} satisfies Constructor;

const requestHandler: RequestHandler = {
  id: "single-media",
  displayName: "Single media",
  description: "Find book with given id",
  requestSchema,
  paginationType: "none",
  responses: [
    {
      schema: singleMediaResponseSchema.extend({ request: requestSchema }),
      constructor: responseConstructor,
    },
  ],
};

export default requestHandler;
