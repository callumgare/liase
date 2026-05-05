import { z } from "zod";
import { sourceId } from "./shared.js";

export const fileSchema = z
  .object({
    type: z.enum(["thumbnail", "full"]),
    url: z.string().url(),
    ext: z.string().regex(/^\w+$/),
    mimeType: z.string().describe(""),
    image: z.boolean(),
    video: z.boolean(),
    fileSize: z.number().int().optional(),
    aspectRatio: z
      .object({ height: z.number(), width: z.number() })
      .strict()
      .optional(),
  })
  .strict();

export type File = z.infer<typeof fileSchema>;

export const mediaSchema = z
  .object({
    mediaFinderSource: z.literal(sourceId),
    id: z.string(),
    title: z.string(),
    url: z.string(),
    dateUploaded: z.date(),
    usernameOfUploader: z.string(),
    nameOfUploader: z.string(),
    files: z.tuple([
      fileSchema.extend({ type: z.literal("full") }),
      fileSchema.extend({ type: z.literal("thumbnail") }),
    ]),
    contentHash: z.string(),
  })
  .strict();

export type Media = z.infer<typeof mediaSchema>;

export const responseSchema = z
  .object({
    page: z
      .object({
        paginationType: z.literal("cursor"),
        cursor: z.string().optional(),
        nextCursor: z.string().nullable(),
        isLastPage: z.boolean(),
        pageFetchLimitReached: z.boolean(),
      })
      .strict(),
    media: z.array(mediaSchema),
    request: z.record(z.unknown()),
  })
  .strict();

export type Response = z.infer<typeof responseSchema>;
