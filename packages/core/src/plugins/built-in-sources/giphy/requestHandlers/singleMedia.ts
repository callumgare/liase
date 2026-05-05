import Giphy from "giphy-api";
import { z } from "zod";

import type { RequestHandler } from "@/src/schemas/requestHandler.js";
import { mediaResponseConstructor } from "../shared.js";
import { responseSchema } from "../types.js";

export default {
  id: "single-media",
  displayName: "Single media",
  description: "Find gif with given id",
  requestSchema: z
    .object({
      source: z.string(),
      queryType: z.string(),
      id: z.string(),
    })
    .strict(),
  secretsSchema: z
    .object({
      apiKey: z.string(),
    })
    .strict(),
  paginationType: "none",
  responses: [
    {
      schema: responseSchema.omit({ page: true }),
      constructor: {
        _setup: ($) => Giphy($.secrets.apiKey).id($.request.id),
        media: mediaResponseConstructor,
        request: ($) => $.request,
      },
    },
  ],
} as const satisfies RequestHandler;
