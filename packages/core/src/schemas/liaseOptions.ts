import { z } from "zod";

import { pluginSchema } from "./plugin.js";

export const liaseOptionsSchema = z
  .object({
    plugins: pluginSchema.array().default([]),
  })
  .strict();

export type LiaseOptions = z.infer<typeof liaseOptionsSchema>;

export type LiaseOptionsInput = z.input<typeof liaseOptionsSchema>;
