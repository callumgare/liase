import { z } from "zod"

export const queryOptionsSchema = z.object({
    secrets: z.object({}).passthrough().default({}),
    fetchCountLimit: z.number().int().default(10),
}).strict()

export type QueryOptions = z.infer<typeof queryOptionsSchema>

export type QueryOptionsInput = z.input<typeof queryOptionsSchema>
