import { z } from "zod";
import Giphy from "giphy-api";

import {
  giphyResponseSchema,
  GiphyResponse
} from "../types.js";
import { getMediaFromGifItem } from "../helpers.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  cursor: z.number().optional(),
}).passthrough();

const secretsSchema = z.object({
  apiKey: z.string(),
}).passthrough();


type Props = {
  request: z.infer<typeof mediaSearchInputSchema>,
  secrets: z.infer<typeof secretsSchema>
}

async function getSearch({request, secrets}: Props): Promise<GiphyResponse> {
  const giphy = Giphy(secrets.apiKey);
  const res = await giphy.search({
    q: request.searchText,
    limit: 10,
    rating: "g",
    offset: request.cursor,
  });

  return {
    page: {
      paginationType: "cursor",
      cursor: res.pagination.offset,
      nextCursor: res.pagination.offset + res.pagination.count,
      totalMedia: res.pagination.total_count,
      isLastPage:
        res.pagination.count + res.pagination.offset >= res.pagination.total_count,
      url: `https://giphy.com/search/${encodeURIComponent(request.searchText)}`,

    },
    media: res.data.map((gif) => getMediaFromGifItem(gif)),
  }
}

const requestHandler: RequestHandler = {
  name: "Search",
  requestSchema:  mediaSearchInputSchema,
  secretsSchema,
  responseSchema: giphyResponseSchema,
  paginationType: "cursor",
  run: getSearch,
};

export default requestHandler;
