import { z } from "zod";

import { genericMediaSchema } from "./media.js";
import { genericRequestSchema } from "./request.js";

const sharedPageProps = {
  url: z.string().optional(),
  inexactUrl: z.string().optional(),
  totalMedia: z
    .number()
    .int()
    .optional()
    .describe(
      "Total media found not just on this page but the sum of media on all pages.",
    ),
  totalPages: z.number().int().optional().describe("Total number of pages."),
  pageSize: z
    .number()
    .int()
    .optional()
    .describe("Max number of media per page."),
  isLastPage: z.boolean().optional(),
  pageFetchLimitReached: z.boolean(),
};

const pageSchema = z.discriminatedUnion("paginationType", [
  z
    .object({
      paginationType: z.literal("offset"),
      pageNumber: z.number().int(),
      ...sharedPageProps,
    })
    .strict(),
  z
    .object({
      paginationType: z.literal("cursor"),
      cursor: z.union([z.string(), z.number(), z.null()]),
      nextCursor: z.union([z.string(), z.number(), z.null()]),
      ...sharedPageProps,
    })
    .strict(),
]);

export const genericResponseSchema = z
  .object({
    page: pageSchema.optional(),
    media: genericMediaSchema.array(),
    groups: z.object({ name: z.string() }).strict().array().optional(),
    request: genericRequestSchema,
  })
  .passthrough();

export const genericResponseWithPageSchema = genericResponseSchema.extend({
  page: pageSchema,
});

export const genericResponseWithoutPageSchema = genericResponseSchema.omit({
  page: true,
});

export type GenericResponse = z.infer<typeof genericResponseSchema>;
export type GenericResponseWithPage = z.infer<
  typeof genericResponseWithPageSchema
>;
export type GenericResponseWithoutPage = z.infer<
  typeof genericResponseWithoutPageSchema
>;
