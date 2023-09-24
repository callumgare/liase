import { z } from "zod"
import { sourceSchema } from "./source.js"

export const pluginSchema = z.object({
  sources: sourceSchema.array()
}).strict()

export type Plugin = z.infer<typeof pluginSchema>