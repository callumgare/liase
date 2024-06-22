import { z } from "zod";
import { ConstructorSchema, Constructor } from "./constructor.js"

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
  responseSchema: z.union([
    z.instanceof(z.ZodObject),
    z.array(
      z.object({
        requestMatcher: z.instanceof(z.ZodObject).optional(),
        description: z.string().optional(),
        schema: z.instanceof(z.ZodObject)
      }).strict()
    )
  ]),
  paginationType: z.enum(["offset", "cursor", "none"]).default("none"),
  responseConstructor: ConstructorSchema
}).strict()

export type RequestHandler = Omit<z.infer<typeof requestHandlerSchema>, "responseConstructor"> &
  {responseConstructor: Constructor}
export type RequestHandlerInput = Omit<z.input<typeof requestHandlerSchema>, "responseConstructor"> &
  {responseConstructor: Constructor}
