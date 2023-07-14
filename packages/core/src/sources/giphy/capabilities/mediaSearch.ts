import { z } from "zod";
import Giphy from "giphy-api";

import {
  giphyPageOfMediaSchema,
  GiphyPageOfMedia
} from "../types.js";
import { getMediaFromGifItem } from "../helpers.js";
import { sourceName } from "../constants.js";
import { Capability } from "@/types/sources.js";

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  apiKey: z.string().optional(),
  cursor: z.number().optional(),
}).passthrough();

async function getSearch(
  query: z.infer<typeof mediaSearchInputSchema>
): Promise<GiphyPageOfMedia> {
  if (!query.apiKey) {
    throw new Error("API key needed to search Giphy");
  }
  const giphy = Giphy(query.apiKey);
  const res = await giphy.search({
    q: query.searchText,
    limit: 10,
    rating: "g",
    offset: query.cursor,
  });

  return {
    source: sourceName,
    meta: {
      type: "page",
    },
    url: `https://giphy.com/search/${encodeURIComponent(query.searchText)}`,
    paginationType: "cursor",
    items: res.data.map((gif) => getMediaFromGifItem(gif)),
    cursor: res.pagination.offset + res.pagination.count,
    totalItems: res.pagination.total_count,
    hasNext:
      res.pagination.count + res.pagination.offset < res.pagination.total_count,
  };
}

const source: Capability<typeof mediaSearchInputSchema, typeof giphyPageOfMediaSchema> = {
  name: "Media search",
  inputType: mediaSearchInputSchema,
  pagination: "cursor",
  run: getSearch,
  outputType: giphyPageOfMediaSchema,
};

export default source;
