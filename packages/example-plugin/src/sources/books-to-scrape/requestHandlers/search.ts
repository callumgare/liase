import { z } from "zod";

import type { Constructor, RequestHandler } from "@liase/core";
import type { DomNode } from "@liase/core/envoy";
import { rootUrl, sourceId } from "../shared.js";
import { pageOfMediaResponseSchema } from "../types.js";

const responseConstructor = {
  _setup: async ($) => {
    const res = await $.loadUrl(`${rootUrl}index.html`);
    const categorySlugMap = Object.fromEntries(
      res.root
        .get(".side_categories ul li a")
        .map((elm: DomNode) => [
          (elm.text as string).trim(),
          elm.attr("href")?.split("/").at(-2),
        ]),
    );

    const filename =
      $.request.pageNumber === 1
        ? "index.html"
        : `page-${$.request.pageNumber}.html`;
    const categorySlug =
      $.request.category && categorySlugMap[$.request.category];
    const basePath = $.request.category
      ? `catalogue/category/books/${categorySlug}/`
      : "catalogue/category/books_1/";

    $.set("url", `${rootUrl}${basePath}${filename}`);
    return $.loadUrl($("url")).then((res) => res.root);
  },
  page: {
    paginationType: "offset",
    pageNumber: ($) =>
      Number.parseInt(
        $()
          .get(".pager .current")
          .text?.match(/^Page (\d+)/)?.[1] ?? "1",
      ),
    totalPages: ($) =>
      Number.parseInt(
        $().get(".pager .current").text?.match(/\d+$/)?.[0] ?? "1",
      ),
    isLastPage: ($) => !$().exists(".pager .next"),
    url: ($) => $("url"),
    pageFetchLimitReached: ($) => $.pageFetchLimitReached,
  },
  media: [
    {
      _arrayMap: ($) => $().get(".row li article"),
      _setup: ($) => {
        $.set("mediaId", $().getFirst("h3 a").attr("href")?.split("/").at(-2));
      },
      liaseSource: sourceId,
      id: ($) => $("mediaId"),
      url: ($) => `${rootUrl}catalogue/${$("mediaId")}/index.html`,
      title: ($) => $().getFirst("h3 a").text,
      files: [
        {
          _setup: ($) => {
            const relativeUrl = $()
              .getFirst(".image_container img")
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
  id: "search",
  displayName: "Search",
  description: "Finds books by category.",
  requestSchema: z
    .object({
      source: z.string(),
      queryType: z.string(),
      pageNumber: z.number().default(1).describe("The page number"),
      category: z.string().optional(),
    })
    .strict(),
  paginationType: "offset",
  responses: [
    {
      schema: pageOfMediaResponseSchema,
      constructor: responseConstructor,
    },
  ],
};

export default requestHandler;
