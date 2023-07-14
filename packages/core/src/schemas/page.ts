import { z } from "zod";
import {
  createSchemaFromSuperset,
  ZodShape,
  MergeShape,
  PickShape,
  PartialShape,
} from "./helpers.js";

const basePageProperties = z.object({
  source: z
    .string()
    .describe("The name of the source where the media was found"),
  meta: z.object({
    type: z
      .literal("page")
      .describe(
        'This will always be "media" and can be used to test if an object is a media object or not'
      ),
  }).strict(),
}).strict();

type BasePageShape = ZodShape<typeof basePageProperties>

const cursorPageProperties = z.object({
  paginationType: z
    .literal("cursor")
    .describe("The type of this returned object"),
  cursor: z.number().int().describe(""),
}).strict();

const offsetPageProperties = z.object({
  paginationType: z
    .literal("offset")
    .describe("The type of this returned object"),
  number: z.number().int().describe(""),
}).strict();

const commonPageProperties = z.object({
  totalPages: z.number().int(),
  url: z.string().url(),
  inexactUrl: z.string().url(),
  totalItems: z
    .number()
    .int()
    .describe(
      "Total items found not just on this page but the sum of items from all pages."
    ),
  hasNext: z.boolean(),
}).strict();

type CommonPageShape = ZodShape<typeof commonPageProperties>

export function createPageSchema<
  ItemsShape extends z.ZodRawShape,
  CommonPropsRequired extends keyof CommonPageShape,
  CommonPropsOptional extends keyof CommonPageShape,
  ExtendProps extends z.ZodRawShape = NonNullable<unknown>
>({
  paginationType,
  itemsSchema,
  required,
  optional = [],
  extend,
}: {
  paginationType: z.infer<typeof cursorPageProperties.shape.paginationType>;
  itemsSchema: z.ZodObject<ItemsShape>;
  required: ReadonlyArray<CommonPropsRequired>;
  optional: ReadonlyArray<CommonPropsOptional>;
  extend?: ExtendProps;
}):
z.ZodObject<
  MergeShape<
    MergeShape<
      MergeShape<
        MergeShape<
          BasePageShape,
          MergeShape<
            PickShape<CommonPageShape, CommonPropsRequired>,
            PartialShape<
              PickShape<CommonPageShape, CommonPropsOptional>
            >
          >
        >,
        {items: z.ZodArray<z.ZodObject<ItemsShape>>}
      >,
      ZodShape<typeof cursorPageProperties>
    >,
    ExtendProps
  >
>;

export function createPageSchema<
  ItemsShape extends z.ZodRawShape,
  CommonPropsRequired extends keyof CommonPageShape,
  CommonPropsOptional extends keyof CommonPageShape,
  ExtendProps extends z.ZodRawShape = NonNullable<unknown>
>({
  paginationType,
  itemsSchema,
  required,
  optional = [],
  extend,
}: {
  paginationType: z.infer<typeof offsetPageProperties.shape.paginationType>;
  itemsSchema: z.ZodObject<ItemsShape>;
  required: ReadonlyArray<CommonPropsRequired>;
  optional: ReadonlyArray<CommonPropsOptional>;
  extend?: ExtendProps;
}):
z.ZodObject<
  MergeShape<
    MergeShape<
      MergeShape<
        MergeShape<
          BasePageShape,
          MergeShape<
            PickShape<CommonPageShape, CommonPropsRequired>,
            PartialShape<
              PickShape<CommonPageShape, CommonPropsOptional>
            >
          >
        >,
        {items: z.ZodArray<z.ZodObject<ItemsShape>>}
      >,
      ZodShape<typeof offsetPageProperties>
    >,
    ExtendProps
  >
>;

export function createPageSchema<
  ItemsShape extends z.ZodRawShape,
  CommonPropsRequired extends keyof CommonPageShape,
  CommonPropsOptional extends keyof CommonPageShape,
  PaginationType extends Readonly<
    | z.infer<typeof cursorPageProperties.shape.paginationType>
    | z.infer<typeof offsetPageProperties.shape.paginationType>
  >,
  ExtendProps extends z.ZodRawShape = NonNullable<unknown>
>({
  paginationType,
  itemsSchema,
  required: requiredProperties,
  optional: optionalProperties = [],
  extend: extendProperties,
}: {
  paginationType: PaginationType;
  itemsSchema: z.ZodObject<ItemsShape>;
  required: ReadonlyArray<CommonPropsRequired>;
  optional: ReadonlyArray<CommonPropsOptional>; // Making this prop optional and not passing in any array when creating
    // results in a type that includes all props of CommonMediaShape. Until we figure out why and fix that we just
    // require this prop so callers will at least pass in an empty array.
  extend?: ExtendProps;
}) {
  let result = createSchemaFromSuperset(
    basePageProperties,
    commonPageProperties,
    requiredProperties,
    optionalProperties
  ).extend({
    items: z.array(itemsSchema),
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (paginationType === "offset") {
    result = result.merge(offsetPageProperties)
  } else if (paginationType === "cursor") {
    result = result.merge(cursorPageProperties)
  } else {
    throw Error(`Pagination type "${paginationType}" is unknown`);
  }
  if (extendProperties) {
    result = result.extend(extendProperties);
  }
  return result
}
