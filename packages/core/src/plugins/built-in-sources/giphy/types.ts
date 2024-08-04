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
    fileSize: z.number().int(),
    width: z.number().int(),
    height: z.number().int(),
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
    files: z.tuple([
      fileSchema.extend({ type: z.literal("full") }),
      fileSchema.extend({ type: z.literal("thumbnail") }),
    ]),
  })
  .strict();

export type Media = z.infer<typeof mediaSchema>;

export const responseSchema = z
  .object({
    page: z
      .object({
        paginationType: z.literal("cursor"),
        cursor: z.number().int(),
        nextCursor: z.number().int(),
        totalMedia: z.number().int(),
        isLastPage: z.boolean(),
        url: z.string(),
        pageFetchLimitReached: z.boolean(),
      })
      .strict(),
    media: z.array(mediaSchema),
    request: z.record(z.unknown()),
  })
  .strict();

export type Response = z.infer<typeof responseSchema>;
