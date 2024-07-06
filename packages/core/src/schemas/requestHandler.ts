import { z } from "zod";
import { ConstructorSchema } from "./constructor.js"

export const requestHandlerSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  displayName: z.string(),
  description: z.string(),
  requestSchema: z.instanceof(
    z.ZodObject<
      {
        source: z.ZodString,
        queryType: z.ZodString,
        pageNumber?: z.ZodTypeAny,
        cursor?: z.ZodTypeAny,
      },
      "strict",
      z.ZodTypeAny,
      Omit<
        z.objectOutputType<
          {
            source: z.ZodString,
            queryType: z.ZodString,
            pageNumber?: z.ZodNumber,
            cursor?: z.ZodTypeAny,
          },
          z.ZodTypeAny,
          "strip"
        >,
        "pageNumber" | "cursor"
      > & {
        pageNumber?: number,
        cursor?: string | number | null
      }
    >
  ),
  secretsSchema: z.instanceof(z.ZodObject).optional(),
  paginationType: z.enum(["offset", "cursor", "none"]).default("none"),
  responses: z.array(
    z.object({
      requestMatcher: z.instanceof(z.ZodObject).optional(),
      description: z.string().optional(),
      schema: z.instanceof(z.ZodObject),
      constructor: ConstructorSchema,
    }).strict()
  ).min(1)
}).strict()

export type RequestHandler = z.infer<typeof requestHandlerSchema>
export type RequestHandlerInput = z.input<typeof requestHandlerSchema>
