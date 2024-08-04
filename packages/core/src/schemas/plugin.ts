import { z } from "zod";
import { sourceSchema } from "./source.js";

const hookSchema = z
  .function()
  .args(z.any(), z.function().args(z.any()).returns(z.promise(z.any())))
  .returns(z.promise(z.any()))
  .optional();

export const pluginSchema = z
  .object({
    sources: sourceSchema.array().optional(),
    hooks: z
      .object({
        loadUrl: hookSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export type Plugin = z.infer<typeof pluginSchema>;
