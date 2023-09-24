import { z } from "zod";
import Giphy from "giphy-api";

import {
  giphyResponseSchema,
  GiphyResponse,
} from "../types.js";
import { getMediaFromGifItem } from "../helpers.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";

const singleMediaInputSchema = z.object({
  id: z.string(),
}).passthrough();

const secretsSchema = z.object({
  apiKey: z.string(),
}).passthrough();

type Props = {
  request: z.infer<typeof singleMediaInputSchema>,
  secrets: z.infer<typeof secretsSchema>
}

async function getSingleMedia({request, secrets}: Props): Promise<Omit<GiphyResponse, "page">> {
  const giphy = Giphy(secrets.apiKey);
  const res = await giphy.id(request.id);
  return {
    media: [getMediaFromGifItem(res.data[0])],
  }
}

const requestHandler: RequestHandler = {
  name: "Single media",
  requestSchema: singleMediaInputSchema,
  secretsSchema,
  responseSchema: giphyResponseSchema.omit({page: true}),
  paginationType: "none",
  run: getSingleMedia,
};

export default requestHandler;
