import { z } from "zod";
import { genericSecretsSchema } from "./secrets.js";

export const queryOptionsSchema = z
  .object({
    secrets: genericSecretsSchema.default({}),
    fetchCountLimit: z.number().int().default(10),
  })
  .strict();

export type QueryOptions = z.infer<typeof queryOptionsSchema>;

export type QueryOptionsInput = z.input<typeof queryOptionsSchema>;
