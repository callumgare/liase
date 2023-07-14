import { z } from "zod";
import {
  createSchemaFromSuperset,
  PickShape,
  ZodShape,
  PartialShape,
  MergeShape,
} from "./helpers.js";

const baseMediaSchema = z.object({
  meta: z.object({
    type: z
      .literal("media")
      .describe(
        'This will always be "media" and can be used to test if an object is a media object or not'
      ),
  }),
  source: z
    .string()
    .describe("The name of the source where the media was found"),
  id: z
    .string()
    .describe(
      "The ID value used to identify a media. This value will be unique amount the other media available from the source but two media from different sources could possibly share the same id."
    ),
  url: z.string().url().describe(""),
});

type BaseMediaShape = ZodShape<typeof baseMediaSchema>

const commonMediaSchema = z.object({
  usernameOfUploader: z
    .string()
    .describe(
      "The username of the account which uploaded the media to the source (not necessarily the same as the person who created the media)."
    ),
  usernameOfCreator: z
    .string()
    .describe(
      "The username of the account responsible for creating the media to the source (not necessarily the same as the person who uploaded the media to the source)."
    ),
  title: z.string().describe("The title of the media"),
  tags: z.array(z.string()).describe(""),
  views: z
    .number()
    .int()
    .describe("The number times this media has been viewed"),
  numberOfLikes: z
    .number()
    .int()
    .describe("The number of times this media has been liked."),
  numberOfDislikes: z.number().int().describe(""),
  percentOfLikes: z
    .number()
    .describe(
      "The percentage of likes to dislikes that this media has received"
    ),
  dateUploaded: z.date().describe("The date that the media was uploaded"),
  relativeDateUploaded: z
    .string()
    .describe(
      'The relative time since the media was uploaded. e.g. "Two weeks ago"'
    ),
  description: z.string().describe("A description supplied with the media"),
  duration: z.number().describe("The play time of the media in seconds"),
});

type CommonMediaShape = ZodShape<typeof commonMediaSchema>

export function createMediaSchema<
  FileShape extends z.ZodRawShape,
  CommonPropsRequired extends keyof CommonMediaShape,
  CommonPropsOptional extends keyof CommonMediaShape
>({
  fileSchema,
  required: requiredProperties,
  optional: optionalProperties = [],
}: {
  fileSchema: z.ZodObject<FileShape>;
  required: ReadonlyArray<CommonPropsRequired>;
  optional: ReadonlyArray<CommonPropsOptional>; // Making this prop optional and not passing in any array when creating
    // results in a type that includes all props of CommonMediaShape. Until we figure out why and fix that we just
    // require this prop so callers will at least pass in an empty array.
}): z.ZodObject<
  MergeShape<
    MergeShape<
      BaseMediaShape,
      MergeShape<
        PickShape<CommonMediaShape, CommonPropsRequired>,
        PartialShape<
          PickShape<CommonMediaShape, CommonPropsOptional>
        >
      >
    >,
    {
      files: z.ZodArray<
        z.ZodObject<FileShape>
      >,
    }
  >
> {
  const mediaSchema = createSchemaFromSuperset(
    baseMediaSchema,
    commonMediaSchema,
    requiredProperties,
    optionalProperties
  );

  const result: any = mediaSchema.merge(
    z.object({
      files: z.array(fileSchema),
    })
  );
  return result
}
