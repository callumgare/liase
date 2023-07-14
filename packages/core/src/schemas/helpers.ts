import { z, ZodRawShape, ZodObject } from "zod";

type identity<T> = T;
type flatten<T> = identity<{ [k in keyof T]: T[k] }>;
export type extendShape<A, B> = flatten<Omit<A, keyof B> & B>;

export type ZodShape<Schema extends z.AnyZodObject> = ReturnType<
  Schema["_def"]["shape"]
>;

export type PickShape<
  BaseShape extends ZodRawShape,
  Mask extends keyof BaseShape
> = Pick<BaseShape, Mask>;

export type MergeShape<
  BaseShape extends ZodRawShape,
  AdditionalShape extends ZodRawShape
> = extendShape<BaseShape, AdditionalShape>;

export type PartialShape<Shape extends ZodRawShape> =
{
  [k in keyof Shape]: z.ZodOptional<Shape[k]>;
}

export function createSchemaFromSuperset<
  BaseShape extends ZodRawShape,
  CommonShape extends ZodRawShape,
  CommonPropsRequired extends keyof CommonShape,
  CommonPropsOptional extends keyof CommonShape
>(
  baseSchema: ZodObject<BaseShape>,
  commonSchema: ZodObject<CommonShape>,
  requiredProperties: ReadonlyArray<CommonPropsRequired>,
  optionalProperties: ReadonlyArray<CommonPropsOptional> = []
): z.ZodObject<
  MergeShape<
    BaseShape,
    MergeShape<
      PickShape<CommonShape, CommonPropsRequired>,
      PartialShape<
        PickShape<CommonShape, CommonPropsOptional>
      >
    >
  >
>
{
  const requiredPropertiesObj = requiredProperties.reduce(
    (r, key): { [k in keyof CommonShape]: true } => {
      return {
        ...r,
        [key]: true,
      };
    },
    {} as { [k in keyof CommonShape]: true }
  );

  const optionalPropertiesObj = optionalProperties.reduce(
    (r, key): { [k in keyof CommonShape]: true } => {
      return {
        ...r,
        [key]: true,
      };
    },
    {} as { [k in keyof CommonShape]: true }
  );

  const result = z.object({}).merge(
    baseSchema.merge(
      commonSchema
        .pick(requiredPropertiesObj)
        .merge(
          commonSchema.pick(optionalPropertiesObj).partial()
        )
    )
  ).strict() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return result
}










