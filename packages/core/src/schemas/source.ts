import { z } from "zod";

import { requestHandlerSchema } from "./requestHandler.js"

export const sourceSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  displayName: z.string(),
  description: z.string(),
  requestHandlers: requestHandlerSchema.array()
}).strict()

export type Source = z.infer<typeof sourceSchema>
