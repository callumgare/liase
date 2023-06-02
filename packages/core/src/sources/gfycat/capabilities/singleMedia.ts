import { z } from "zod";
import { gfycatMediaSchema, gfycatRawAPISingleGfycatSchema } from "../types";
import { rootUrlApi } from "../constants";
import { getMediaFromGfyItem } from "../helpers";
import { validateSchema } from "@/src/sharedSourceFunctions";
import { Capability } from "@/types/sources";

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
