import { z } from "zod";

export const requestHandlerSchema = z.object({
  name: z.string(),
  requestSchema: z.instanceof(z.ZodObject),
  secretsSchema: z.instanceof(z.ZodObject).optional(),
  responseSchema: z.instanceof(z.ZodObject),
  paginationType: z.enum(["offset", "cursor", "none"]),
  // Ideally we'd scope this down to requestSchema, secretsSchema and responseSchema but object don't have good generics option
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: z.custom<({request, secrets}: {request: any, secrets: any}) => Promise<any>>()
}).strict()

export type RequestHandler = z.infer<typeof requestHandlerSchema>
export type RequestHandlerInput = z.input<typeof requestHandlerSchema>
