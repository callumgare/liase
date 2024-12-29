import { z } from "zod";
import { genericSecretsSchema } from "./secrets.js";

export const queryOptionsSchema = z
  .object({
    secrets: genericSecretsSchema.default({}),
    fetchCountLimit: z.number().int().default(10),
    cacheNetworkRequests: z.enum(["never", "auto", "always"]).optional(),
  })
  .strict();

export type QueryOptions = z.infer<typeof queryOptionsSchema>;

export type QueryOptionsInput = z.input<typeof queryOptionsSchema>;
