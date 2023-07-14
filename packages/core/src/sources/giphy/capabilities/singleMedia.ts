import { z } from "zod";
import Giphy from "giphy-api";

import {
  giphyMediaSchema,
} from "../types.js";
import { getMediaFromGifItem } from "../helpers.js";
import { Capability } from "@/types/sources.js";

const singleMediaInputSchema = z.object({
  id: z.string(),
  apiKey: z.string().optional(),
}).passthrough();

async function getSingleMedia(query: z.infer<typeof singleMediaInputSchema>): Promise<z.infer<typeof giphyMediaSchema>> {
  if (!query.apiKey) {
    throw new Error("API key needed to search Giphy");
  }
  const giphy = Giphy(query.apiKey);
  const res = await giphy.id(query.id);
  return getMediaFromGifItem(res.data[0]);
}

const source: Capability<typeof singleMediaInputSchema, typeof giphyMediaSchema> = {
  name: "Single media",
  inputType: singleMediaInputSchema,
  run: getSingleMedia,
  outputType: giphyMediaSchema,
};

export default source;
