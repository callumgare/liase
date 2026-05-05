import { z } from "zod";

import { responseSchema } from "../types.js";
import { postsToMediaResponseConstructor } from "../shared.js";
import { RequestHandler } from "@/src/schemas/requestHandler.js";
import { getAgent } from "../client.js";

export default {
  id: "single-media",
  displayName: "Single media",
  description: "Find a specific media included in a post",
  requestSchema: z
    .object({
      source: z.string(),
      queryType: z.string(),
      id: z.string(),
    })
    .strict(),
  secretsSchema: z
    .object({
      handle: z.string().optional(),
      password: z.string().optional(),
      serviceUrl: z.string().optional(),
    })
    .strict(),
  paginationType: "none",
  responses: [
    {
      schema: responseSchema.omit({ page: true }),
      constructor: {
        _setup: async ($) => {
          let res;
          try {
            const agent = await getAgent({
              $,
              handle: $.secrets.handle,
              password: $.secrets.password,
              serviceUrl: $.secrets.serviceUrl,
            });
            res = await agent.app.bsky.feed.getPosts({
              uris: [$.request.id.replace(/#\w+$/, "")],
            });
            if (!res.success) {
              throw Error("Unsuccessful request to Bluesky");
            }
            return res.data;
          } catch (error) {
            console.info("Response:", res);
            throw error;
          }
        },
        media: postsToMediaResponseConstructor,
        request: ($) => $.request,
      },
    },
  ],
} as const satisfies RequestHandler;
