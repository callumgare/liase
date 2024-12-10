import { z } from "zod";
import { genericRequestSchema } from "./request.js";

export const genericFileSchema = z
  .object({
    type: z
      .union([z.literal("full"), z.literal("thumbnail"), z.string()])
      .describe(""),
    url: z.string().url().describe(""),
    ext: z.string().regex(/^\w+$/).optional().describe(""),
    mimeType: z.string().optional().describe(""),
    image: z.boolean().optional(),
    video: z.boolean().optional(),
    audio: z.boolean().optional(),
    fileSize: z.number().int().optional(),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    aspectRatio: z
      .union([
        z.number(),
        z.object({ height: z.number(), width: z.number() }).strict(),
      ])
      .optional(),
    urlExpires: z.union([z.date(), z.boolean()]).optional(),
    urlRefreshDetails: genericRequestSchema.optional(),
    duration: z.number().optional(),
    contentHash: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type GenericFile = z.infer<typeof genericFileSchema>;
