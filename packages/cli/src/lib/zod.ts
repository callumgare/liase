import type { z } from "zod";

type Primitive = string | number | boolean | null | undefined | bigint | symbol;

type SimpleSchema = (
  | {
      type: "string";
      default?: string;
      checks?: unknown[];
    }
  | {
      type: "number";
      default?: number;
      checks?: unknown[];
    }
  | {
      type: "boolean";
      default?: boolean;
    }
  | {
      type: "date";
      default?: Date | string;
      checks?: unknown[];
    }
  | {
      type: "object";
      children: { [key: string]: SimpleSchema };
      default?: { [key: string]: unknown };
    }
  | {
      type: "array";
      children: SimpleSchema;
      default?: unknown[];
    }
  | {
      type: SimpleSchema[]; // Union type
      default?: unknown;
    }
  | {
      type: "literal";
      value: Primitive;
      valueType: "string" | "number" | "boolean" | "null" | "other";
      default?: never;
    }
  | {
      type: "null";
      default?: null;
    }
  | {
      type: "other" | "undefined";
      default?: unknown;
      zodTypeName: string;
    }
) & {
  optional?: boolean;
  description?: string;
};

type ZodFirstPartySchemaTypesNameMap = {
  ZodString: z.ZodString;
  ZodNumber: z.ZodNumber;
  ZodNaN: z.ZodNaN;
  ZodBigInt: z.ZodBigInt;
  ZodBoolean: z.ZodBoolean;
  ZodDate: z.ZodDate;
  ZodUndefined: z.ZodUndefined;
  ZodNull: z.ZodNull;
  ZodAny: z.ZodAny;
  ZodUnknown: z.ZodUnknown;
  ZodNever: z.ZodNever;
  ZodVoid: z.ZodVoid;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodArray: z.ZodArray<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodObject: z.ZodObject<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodUnion: z.ZodUnion<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodDiscriminatedUnion: z.ZodDiscriminatedUnion<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodIntersection: z.ZodIntersection<any, any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodTuple: z.ZodTuple<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodRecord: z.ZodRecord<any, any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodMap: z.ZodMap<any, any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodSet: z.ZodSet<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodFunction: z.ZodFunction<any, any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodLazy: z.ZodLazy<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodLiteral: z.ZodLiteral<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodEnum: z.ZodEnum<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodOptional: z.ZodOptional<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodNullable: z.ZodNullable<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodDefault: z.ZodDefault<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodCatch: z.ZodCatch<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodPromise: z.ZodPromise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
  ZodReadonly: z.ZodReadonly<any>;
  ZodSymbol: z.ZodSymbol;
  // These types were removed in Zod 4 but may still appear from Zod 3 schemas
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Zod 3 types
  ZodEffects: any;
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Zod 3 types
  ZodNativeEnum: any;
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Zod 3 types
  ZodBranded: any;
  // biome-ignore lint/suspicious/noExplicitAny: Legacy Zod 3 types
  ZodPipeline: any;
};

function isZodType<T extends keyof ZodFirstPartySchemaTypesNameMap>(
  // biome-ignore lint/suspicious/noExplicitAny: Must accept any Zod type including future/external versions
  zodSchema: any,
  type: T,
): zodSchema is ZodFirstPartySchemaTypesNameMap[T] {
  return zodSchema?.constructor?.name === type;
}

export function zodSchemaToSimpleSchema(zodSchema: z.ZodType): SimpleSchema {
  // biome-ignore lint/suspicious/noExplicitAny: _def is internal Zod API that varies between versions
  const def: any = (zodSchema as any)._def;
  let simpleSchema: SimpleSchema;
  const zodTypeName = zodSchema.constructor.name;
  const description = (zodSchema as { description?: string }).description;
  const defaultProps = {
    ...(description ? { description } : {}),
  };
  // We don't use instanceof to match against an imported Zod class because the zod schema may be created
  // with a different version of the Zod library and thus not be matched with instanceof
  if (isZodType(zodSchema, "ZodObject")) {
    simpleSchema = {
      ...defaultProps,
      type: "object",
      children: {},
    };
    for (const [name, zodType] of Object.entries(
      def.shape as { [key: string]: z.ZodType },
    )) {
      simpleSchema.children[name] = zodSchemaToSimpleSchema(zodType);
    }
  } else if (isZodType(zodSchema, "ZodIntersection")) {
    type SimpleSchemaObject = Extract<SimpleSchema, { type: "object" }>;
    const left = zodSchemaToSimpleSchema(
      def.left as z.ZodObject,
    ) as SimpleSchemaObject;
    const right = zodSchemaToSimpleSchema(
      def.right as z.ZodObject,
    ) as SimpleSchemaObject;

    simpleSchema = {
      ...defaultProps,
      type: "object",
      children: { ...left.children, ...right.children },
    };
  } else if (isZodType(zodSchema, "ZodArray")) {
    simpleSchema = {
      ...defaultProps,
      type: "array",
      children: zodSchemaToSimpleSchema(def.element),
    };
  } else if (isZodType(zodSchema, "ZodSet")) {
    simpleSchema = {
      ...defaultProps,
      type: "array",
      children: zodSchemaToSimpleSchema(def.valueType),
    };
  } else if (
    isZodType(zodSchema, "ZodUnion") ||
    isZodType(zodSchema, "ZodDiscriminatedUnion")
  ) {
    const zodTypesInUnion: z.ZodType[] = def.options;
    const simpleSchemaTypesInUnion = zodTypesInUnion.map(
      zodSchemaToSimpleSchema,
    );
    simpleSchema = { ...defaultProps, type: simpleSchemaTypesInUnion };
    const unionIncludesUndefined = simpleSchemaTypesInUnion.some(
      (schema) =>
        schema.type === "other" && schema.zodTypeName === "ZodUndefined",
    );
    if (unionIncludesUndefined) {
      simpleSchema.optional = true;
    }
  } else if (isZodType(zodSchema, "ZodOptional")) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(def.innerType),
      optional: true,
    };
  } else if (isZodType(zodSchema, "ZodString")) {
    simpleSchema = { ...defaultProps, type: "string" };
    if (def.checks.length) simpleSchema.checks = def.checks;
  } else if (
    isZodType(zodSchema, "ZodNumber") ||
    isZodType(zodSchema, "ZodBigInt")
  ) {
    simpleSchema = { ...defaultProps, type: "number" };
    if (def.checks.length) simpleSchema.checks = def.checks;
  } else if (isZodType(zodSchema, "ZodBoolean")) {
    simpleSchema = { ...defaultProps, type: "boolean" };
  } else if (isZodType(zodSchema, "ZodDate")) {
    simpleSchema = { ...defaultProps, type: "date" };
    if (def.checks.length) simpleSchema.checks = def.checks;
  } else if (isZodType(zodSchema, "ZodNull")) {
    simpleSchema = { ...defaultProps, type: "null" };
  } else if (isZodType(zodSchema, "ZodLiteral")) {
    const value = (def.values as Primitive[])[0];
    let valueType: "string" | "number" | "boolean" | "null" | "other";
    if (typeof value === "string") {
      valueType = "string";
    } else if (typeof value === "number" || typeof value === "bigint") {
      valueType = "number";
    } else if (typeof value === "boolean") {
      valueType = "boolean";
    } else if (value === null) {
      valueType = "null";
    } else {
      valueType = "other";
    }
    simpleSchema = {
      ...defaultProps,
      type: "literal",
      value,
      valueType,
    };
  } else if (isZodType(zodSchema, "ZodEnum")) {
    const enumValues: string[] = Object.keys(
      def.entries as Record<string, string>,
    );
    simpleSchema = {
      ...defaultProps,
      type: enumValues.map((enumValue) => ({
        type: "literal" as const,
        value: enumValue,
        valueType: "string" as const,
        zodTypeName: "ZodLiteral",
      })),
    };
  } else if (isZodType(zodSchema, "ZodEffects")) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(def.schema),
    };
  } else if (isZodType(zodSchema, "ZodNativeEnum")) {
    simpleSchema = { ...defaultProps, type: "number" };
  } else if (isZodType(zodSchema, "ZodNullable")) {
    simpleSchema = {
      ...defaultProps,
      type: [zodSchemaToSimpleSchema(def.innerType), { type: "null" }],
    };
  } else if (isZodType(zodSchema, "ZodDefault")) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(def.innerType),
      default: def.defaultValue,
    };
  } else if (isZodType(zodSchema, "ZodCatch")) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(def.innerType),
    };
  } else if (isZodType(zodSchema, "ZodBranded")) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(def.innerType ?? def.type),
    };
  } else if (isZodType(zodSchema, "ZodPipeline")) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(def.in),
    };
  } else if (
    isZodType(zodSchema, "ZodAny") ||
    isZodType(zodSchema, "ZodUndefined") ||
    isZodType(zodSchema, "ZodNaN") ||
    isZodType(zodSchema, "ZodUnknown") ||
    isZodType(zodSchema, "ZodNever") ||
    isZodType(zodSchema, "ZodVoid") ||
    isZodType(zodSchema, "ZodTuple") ||
    isZodType(zodSchema, "ZodRecord") ||
    isZodType(zodSchema, "ZodMap") ||
    isZodType(zodSchema, "ZodFunction") ||
    isZodType(zodSchema, "ZodLazy") ||
    isZodType(zodSchema, "ZodVoid") ||
    isZodType(zodSchema, "ZodPromise") ||
    isZodType(zodSchema, "ZodReadonly") ||
    isZodType(zodSchema, "ZodSymbol")
  ) {
    simpleSchema = {
      ...defaultProps,
      type: "other",
      zodTypeName,
    };
  } else {
    zodSchema satisfies never; // Ensure we have a case for every Zod type
    simpleSchema = {
      ...defaultProps,
      type: "other",
      zodTypeName,
    };
  }
  return simpleSchema;
}
