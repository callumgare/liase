import { z } from "zod"

export const genericRequestSchema = z.object({
    source: z.string().regex(/^[a-z-]+$/),
    queryType: z.string().regex(/^[a-z-]+$/),
    pageNumber: z.number().optional(),
    cursor: z.union([z.string(), z.number(), z.null()]).optional(),
}).passthrough()

export const genericPaginationOffsetRequestSchema = genericRequestSchema.extend({
  pageNumber: genericRequestSchema.shape.pageNumber.unwrap(),
  cursor: z.never()
})

export const genericPaginationCursorRequestSchema = genericRequestSchema.extend({
  cursor: genericRequestSchema.shape.cursor.unwrap(),
  pageNumber: z.never()
})

export const genericPaginationNoneRequestSchema = genericRequestSchema.extend({
  cursor: genericRequestSchema.shape.cursor.unwrap(),
  pageNumber: z.never()
})

export type GenericRequest = z.infer<typeof genericRequestSchema>
export type GenericRequestInput = z.input<typeof genericRequestSchema>
