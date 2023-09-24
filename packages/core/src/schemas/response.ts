import { z } from "zod"

import { genericMediaSchema } from "./media.js"
import { genericRequestSchema } from "./request.js"

const sharedPageProps = {
    url: z.string().optional(),
    inexactUrl: z.string().optional(),
    totalMedia: z.number().int().optional().describe(
      "Total media found not just on this page but the sum of media on all pages."
    ),
    isLastPage: z.boolean().optional(),
    fetchCountLimitHit: z.boolean(), // Set by MediaFinder so sources don't need to set this
}

export const genericResponseSchema = z.object({
    page: z.discriminatedUnion("paginationType",[
        z.object({
            paginationType: z.literal("offset"),
            pageNumber: z.number().int(),
            ...sharedPageProps,
        }).strict(),
        z.object({
            paginationType: z.literal("cursor"),
            cursor: z.union([z.string(), z.number(), z.null()]),
            nextCursor: z.union([z.string(), z.number(), z.null()]),
            ...sharedPageProps,
        }).strict()
    ]).optional(),
    media: genericMediaSchema.array(),
    groups: z.object({name: z.string()}).strict().array().optional(),
    request: genericRequestSchema
}).strict()

export type GenericResponse = z.infer<typeof genericResponseSchema>
