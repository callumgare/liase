import { z } from "zod";
import fetch from "node-fetch";

import {
  gfycatResponseSchema,
  GfycatResponse,
  gfycatRawAPISearchPageSchema,
} from "../types.js";
import { getMediaFromGfyItem } from "../helpers.js";
import { rootUrlApi } from "../constants.js";
import { validateSchema } from "@/src/sharedSourceFunctions.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";

const mediaSearchInputSchema = z.object({
  queryType: z.string(),
  searchText: z.string(),
  cursor: z.string().optional(),
}).passthrough();

async function getSearch(
  {request}: {request: z.input<typeof mediaSearchInputSchema>}
): Promise<GfycatResponse> {
  const url = `${rootUrlApi}/gfycats/search?search_text=${request.searchText}${
    request.cursor ? `&cursor=${request.cursor}` : ""
  }&count=10&order=trending&type=g`;
  const res = await fetch(url)
    .then((res) => res.json())
    .then((res) => validateSchema(gfycatRawAPISearchPageSchema, res));

  return {
    page: {
      paginationType: "cursor",
      url,
      cursor: request.cursor ?? null,
      nextCursor: res.cursor ?? null,
      totalMedia: res.found,
      isLastPage: !res.cursor,
    },
    media: res.gfycats.map((gfyItem) => getMediaFromGfyItem(gfyItem)),
  };
}

const requestHandler: RequestHandler = {
  name: "Search",
  requestSchema: mediaSearchInputSchema,
  responseSchema: gfycatResponseSchema,
  paginationType: "cursor",
  run: getSearch,
};

export default requestHandler;
