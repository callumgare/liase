import { z } from "zod";

import { rootUrl, sourceId } from "../shared.js";
import { RequestHandler } from "media-finder";
import { pageOfMediaResponseSchema } from "../types.js";
import { type Constructor } from "media-finder/dist/schemas/constructor.js";

const responseConstructor = {
  _setup: async ($) => {
    const res = await $.loadUrl(`${rootUrl}index.html`);
    const categorySlugMap = Object.fromEntries(
      res.root
        .select(".side_categories ul li a")
        .map((elm: any) => [
          elm.text.trim(),
          elm.attr("href").split("/").at(-2),
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
      parseInt(
        $()
          .select(".pager .current")
          .text?.match(/^Page (\d+)/)?.[1] ?? "1",
      ),
    totalPages: ($) =>
      parseInt($().select(".pager .current").text?.match(/\d+$/)?.[0] ?? "1"),
    isLastPage: ($) => !$().exists(".pager .next"),
    url: ($) => $("url"),
    pageFetchLimitReached: ($) => $.pageFetchLimitReached,
  },
  media: [
    {
      _arrayMap: ($) => $().select(".row li article"),
      _setup: ($) => {
        $.set("mediaId", $().select("h3 a").attr("href").split("/").at(-2));
      },
      mediaFinderSource: sourceId,
      id: ($) => $("mediaId"),
      url: ($) => `${rootUrl}catalogue/${$("mediaId")}/index.html`,
      title: ($) => $().select("h3").text,
      files: [
        {
          _setup: ($) => {
            const relativeUrl = $().select(".image_container img").attr("src");
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

export default {
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
} as const satisfies RequestHandler;
