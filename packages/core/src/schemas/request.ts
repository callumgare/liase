import { z } from "zod"

export const genericRequestSchema = z.object({
    source: z.string(),
    queryType: z.string(),
    pageNumber: z.number().optional(),
    cursor: z.union([z.string(), z.number(), z.null()]).optional(),
}).passthrough()

export type GenericRequest = z.infer<typeof genericRequestSchema>
export type GenericRequestInput = z.input<typeof genericRequestSchema>