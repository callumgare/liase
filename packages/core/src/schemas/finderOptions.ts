import { z } from "zod";

import { pluginSchema } from "./plugin.js";

export const finderOptionsSchema = z
  .object({
    plugins: pluginSchema.array().default([]),
  })
  .strict();

export type FinderOptions = z.infer<typeof finderOptionsSchema>;

export type FinderOptionsInput = z.input<typeof finderOptionsSchema>;
