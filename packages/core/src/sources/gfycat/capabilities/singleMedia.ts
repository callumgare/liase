import { z } from "zod";
import { gfycatMediaSchema, gfycatRawAPISingleGfycatSchema } from "../types.js";
import { rootUrlApi } from "../constants.js";
import { getMediaFromGfyItem } from "../helpers.js";
import { validateSchema } from "@/src/sharedSourceFunctions.js";
import { Capability } from "@/types/sources.js";

const singleMediaInputSchema = z.object({
  id: z.string(),
});

async function getSingleMedia(query: z.infer<typeof singleMediaInputSchema>) {
  const url = `${rootUrlApi}/gfycats/${query.id}`;
  const res = await fetch(url).then((res) => res.json());

  validateSchema(gfycatRawAPISingleGfycatSchema, res);

  return getMediaFromGfyItem(res.gfyItem);
}

const capability: Capability<
  typeof singleMediaInputSchema,
  typeof gfycatMediaSchema
> = {
  name: "Single media",
  inputType: singleMediaInputSchema,
  run: getSingleMedia,
  outputType: gfycatMediaSchema,
};

export default capability;
