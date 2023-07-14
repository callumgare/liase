import { z } from "zod";
import { createSchemaFromSuperset, MergeShape, ZodShape, PickShape, PartialShape } from "./helpers.js";

const baseFileSchema = z.object({
  type: z.literal("file").describe(""),
  kind: z.enum(["full", "thumbnail"]).describe(""),
}).strict();

type BaseFileShape = ZodShape<typeof baseFileSchema>

const commonFileSchema = z.object({
  url: z.string().url().describe(""),
  ext: z.string().regex(/^\w+$/).describe(""),
  mimeType: z.string().describe(""),
  image: z.boolean(),
  video: z.boolean(),
  audio: z.boolean(),
  fileSize: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
}).strict();

type CommonFileShape = ZodShape<typeof commonFileSchema>

export function createFileSchema<
  CommonPropsRequired extends keyof CommonFileShape,
  CommonPropsOptional extends keyof CommonFileShape,
>({
  required: requiredProperties,
  optional: optionalProperties = [],
}: {
  required: ReadonlyArray<CommonPropsRequired>;
  optional: ReadonlyArray<CommonPropsOptional>; // Making this prop optional and not passing in any array when creating
    // results in a type that includes all props of CommonMediaShape. Until we figure out why and fix that we just
    // require this prop so callers will at least pass in an empty array.
}): z.ZodObject<
  MergeShape<
    BaseFileShape,
    MergeShape<
      PickShape<CommonFileShape, CommonPropsRequired>,
      PartialShape<
        PickShape<CommonFileShape, CommonPropsOptional>
      >
    >
  >
> {
  const result = createSchemaFromSuperset(
    baseFileSchema,
    commonFileSchema,
    requiredProperties,
    optionalProperties
  ) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return result
}
