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
        // We use $.fetch rather than the giphy-api library because giphy-api uses Node's
        // native http/https modules, which bypass the $.fetch caching wrapper.
        _setup: async ($) => {
          const params = new URLSearchParams({
            api_key: $.secrets.apiKey,
            ids: $.request.id,
          });
          const res = await $.fetch(`https://api.giphy.com/v1/gifs?${params}`);
          if (!res.ok) {
            throw new Error(`Giphy API error: ${res.status}`);
          }
          return res.json();
        },
        media: mediaResponseConstructor,
        request: ($) => $.request,
      },
    },
  ],
} as const satisfies RequestHandler;
