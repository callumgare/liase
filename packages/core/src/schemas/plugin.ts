import { z } from "zod";
import { sourceSchema } from "./source.js";

const hookSchema = z
  .function()
  .input([z.any(), z.function().input([z.any()]).output(z.promise(z.any()))])
  .output(z.promise(z.any()))
  .optional();

export const pluginSchema = z
  .object({
    sources: sourceSchema.array().optional(),
    hooks: z
      .object({
        loadUrl: hookSchema,
        getFetchClient: hookSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export type Plugin = z.infer<typeof pluginSchema>;
