import { z } from "zod";
import fetch from "node-fetch";

import {
  gfycatPageOfMediaSchema,
  gfycatRawAPISearchPageSchema,
  GfycatPageOfMedia
} from "../types.js";
import { getMediaFromGfyItem } from "../helpers.js";
import { rootUrlApi, sourceName } from "../constants.js";
import { validateSchema } from "@/src/sharedSourceFunctions.js";
import { Capability } from "@/types/sources.js";

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  cursor: z.string().optional(),
});

async function getSearch(
  query: z.infer<typeof mediaSearchInputSchema>
): Promise<GfycatPageOfMedia> {
  const url = `${rootUrlApi}/gfycats/search?search_text=${query.searchText}${
    query.cursor ? `&cursor=${query.cursor}` : ""
  }&count=10&order=trending&type=g`;
  const res = await fetch(url)
    .then((res) => res.json())
    .then((res) => validateSchema(gfycatRawAPISearchPageSchema, res));

  return gfycatPageOfMediaSchema.parse({
    source: sourceName,
    meta: {
      type: "page",
    },
    paginationType: "cursor",
    url,
    items: res.gfycats.map((gfyItem) => getMediaFromGfyItem(gfyItem)),
    cursor: res.cursor,
    totalItems: res.found,
    hasNext: Boolean(res.cursor),
  } as GfycatPageOfMedia);
}

const source: Capability<typeof mediaSearchInputSchema, typeof gfycatPageOfMediaSchema> = {
  name: "Media search",
  inputType: mediaSearchInputSchema,
  pagination: "cursor",
  run: getSearch,
  outputType: gfycatPageOfMediaSchema,
};

export default source;
