import { z } from "zod";

import { requestHandlerSchema } from "./requestHandler.js"

export const sourceSchema = z.object({
  name: z.string(),
  requestHandlers: requestHandlerSchema.array()
}).strict()

export type Source = z.infer<typeof sourceSchema>