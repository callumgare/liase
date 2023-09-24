import {z} from "zod"
import { sourceName } from "./constants.js";

export const giphyFileSchema = z.object({
  type: z.enum(["thumbnail", "full"]),
  url: z.string().url(),
  ext: z.string().regex(/^\w+$/),
  mimeType: z.string().describe(""),
  image: z.boolean(),
  video: z.boolean(),
  fileSize: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
}).strict();

export type GiphyFile = z.infer<typeof giphyFileSchema>

export const giphyMediaSchema = z.object({
  source: z.literal(sourceName),
  id: z.string(),
  title: z.string(),
  url: z.string(),
  dateUploaded: z.date(),
  usernameOfUploader: z.string(),
  files: z.array(giphyFileSchema)
}).strict()

export type GiphyMedia = z.infer<typeof giphyMediaSchema>

export const giphyResponseSchema = z.object({
  page: z.object({
    paginationType: z.literal("cursor"),
    cursor: z.number().int(),
    nextCursor: z.number().int(),
    totalMedia: z.number().int(),
    isLastPage: z.boolean(),
    url: z.string(),
  }).strict(),
  media: z.array(giphyMediaSchema),
}).strict()

export type GiphyResponse = z.infer<typeof giphyResponseSchema>
