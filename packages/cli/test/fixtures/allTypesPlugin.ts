import type { Plugin } from "@liase/core";
import { z } from "zod";

/**
 * Fixture plugin whose single request handler covers every Zod field type
 * that query-controls.js renders as a distinct input:
 *   string   → text input
 *   number   → number input  (with min / max checks)
 *   boolean  → checkbox
 *   enum     → <select>  (serialised as union-of-literals by zodSchemaToSimpleSchema)
 *   array    → comma-separated text input
 *   optional → any of the above with optional: true
 *   default  → any of the above with a default value
 */
export default {
  sources: [
    {
      id: "all-types-source",
      displayName: "All Types Source",
      description: "Source used to test all web-ui input kinds",
      requestHandlers: [
        {
          id: "all-types",
          displayName: "All Types",
          description: "Request handler with one field of every input type",
          requestSchema: z
            .object({
              source: z.string(),
              queryType: z.string(),
              stringField: z.string().describe("A plain string"),
              numberField: z
                .number()
                .min(0)
                .max(100)
                .describe("A number with min/max"),
              booleanField: z.boolean().describe("A boolean"),
              enumField: z.enum(["alpha", "beta", "gamma"]).describe("An enum"),
              arrayField: z.array(z.string()).describe("An array of strings"),
              optionalField: z
                .string()
                .optional()
                .describe("An optional string"),
              defaultField: z
                .string()
                .default("fallback")
                .describe("A string with a default"),
            })
            .strict(),
          paginationType: "none",
          responses: [
            {
              schema: z
                .object({
                  media: z.array(z.object({}).passthrough()),
                  request: z.object({}).passthrough(),
                })
                .passthrough(),
              constructor: {
                media: [],
                request: ($: { request: unknown }) => $.request,
              },
            },
          ],
        },
      ],
    },
  ],
} satisfies Plugin;
