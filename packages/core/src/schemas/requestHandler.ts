import { z } from "zod";
import { ConstructorSchema } from "./constructor.js";

export const requestHandlerSchema = z
  .object({
    id: z.string().regex(/^[a-z-]+$/),
    displayName: z.string(),
    description: z.string(),
    requestSchema: z.custom<
      z.ZodObject<
        {
          source: z.ZodString;
          queryType: z.ZodString;
          pageNumber?: z.ZodTypeAny;
          cursor?: z.ZodTypeAny;
        },
        "strict",
        z.ZodTypeAny,
        Omit<
          z.objectOutputType<
            {
              source: z.ZodString;
              queryType: z.ZodString;
              pageNumber?: z.ZodNumber;
              cursor?: z.ZodTypeAny;
            },
            z.ZodTypeAny,
            "strip"
          >,
          "pageNumber" | "cursor"
        > & {
          pageNumber?: number;
          cursor?: string | number | null;
        }
      >
    >((val) => val?.constructor?.name === "ZodObject"),
    secretsSchema: z
      .custom<z.AnyZodObject>((val) => val?.constructor?.name === "ZodObject")
      .optional(),
    paginationType: z.enum(["offset", "cursor", "none"]).default("none"),
    responses: z
      .array(
        z
          .object({
            requestMatcher: z
              .custom<z.AnyZodObject>(
                (val) => val?.constructor?.name === "ZodObject",
              )
              .optional(),
            description: z.string().optional(),
            schema: z.custom<z.AnyZodObject>(
              (val) => val?.constructor?.name === "ZodObject",
            ),
            constructor: ConstructorSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type RequestHandler = z.infer<typeof requestHandlerSchema>;
export type RequestHandlerInput = z.input<typeof requestHandlerSchema>;
