import { z } from "zod";
import { sourceId } from "./shared.js";

export const fileSchema = z
  .object({
    type: z.literal("full"),
    url: z.string().url(),
    ext: z.string().regex(/^\w+$/),
    mimeType: z.string().describe(""),
    image: z.boolean(),
    video: z.boolean(),
  })
  .strict();

export type File = z.infer<typeof fileSchema>;

export const mediaSchema = z
  .object({
    mediaFinderSource: z.literal(sourceId),
    id: z.string().regex(/\d+/),
    title: z.string(),
    url: z.string(),
    description: z.string(),
    files: z.tuple([fileSchema]),
  })
  .strict();

export type Media = z.infer<typeof mediaSchema>;

export const pageOfMediaResponseSchema = z
  .object({
    page: z
      .object({
        paginationType: z.literal("offset"),
        pageNumber: z.number().int(),
        totalPages: z.union([z.number().int(), z.undefined()]),
        isLastPage: z.union([z.boolean(), z.undefined()]),
        url: z.string(),
        pageFetchLimitReached: z.boolean(),
      })
      .strict(),
    media: z.array(
      mediaSchema.omit({
        description: true,
      }),
    ),
    request: z.object({}).passthrough(),
  })
  .strict();

export const singleMediaResponseSchema = z
  .object({
    media: z.tuple([mediaSchema]),
  })
  .strict();
