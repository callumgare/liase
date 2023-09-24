import { z } from "zod";
import { gfycatResponseSchema, GfycatResponse, gfycatRawAPISingleGfycatSchema } from "../types.js";
import { rootUrlApi } from "../constants.js";
import { getMediaFromGfyItem } from "../helpers.js";
import { validateSchema } from "@/src/sharedSourceFunctions.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";

const singleMediaInputSchema = z.object({
  id: z.string(),
}).passthrough();

async function getSingleMedia(
  {request}: {request: z.infer<typeof singleMediaInputSchema>}
): Promise<Omit<GfycatResponse, "page">> {
  const url = `${rootUrlApi}/gfycats/${request.id}`;
  const res = await fetch(url)

  if (res.status < 200 || res.status >= 300) {
    const body = await res.text()
    throw Error(`Got ${res.status} - ${body}`)
  }
  const data = await res.json();

  validateSchema(gfycatRawAPISingleGfycatSchema, data);

  return {
    media: [getMediaFromGfyItem(data.gfyItem)]
  }
}

const requestHandler: RequestHandler = {
  name: "Single media",
  requestSchema: singleMediaInputSchema,
  responseSchema: gfycatResponseSchema.omit({page: true}),
  paginationType: "none",
  run: getSingleMedia,
};

export default requestHandler;
