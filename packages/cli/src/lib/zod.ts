import {
	type Primitive,
	type ZodFirstPartySchemaTypes,
	ZodFirstPartyTypeKind,
	type z,
} from "zod";

type SimpleSchema = (
	| {
			type: "string";
			default?: string;
			checks?: z.ZodStringCheck[];
	  }
	| {
			type: "number";
			default?: number;
			checks?: Array<z.ZodNumberCheck | z.ZodBigIntCheck>;
	  }
	| {
			type: "boolean";
			default?: boolean;
	  }
	| {
			type: "date";
			default?: Date | string;
			checks?: z.ZodDateCheck[];
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
			zodTypeName: ZodFirstPartySchemaTypes["_def"]["typeName"];
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
	ZodArray: z.ZodArray<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodObject: z.ZodObject<any, any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodUnion: z.ZodUnion<any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodDiscriminatedUnion: z.ZodDiscriminatedUnion<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodIntersection: z.ZodIntersection<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodTuple: z.ZodTuple<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodRecord: z.ZodRecord<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodMap: z.ZodMap<any>;
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
	ZodEffects: z.ZodEffects<any, any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodNativeEnum: z.ZodNativeEnum<any>;
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
	ZodBranded: z.ZodBranded<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodPipeline: z.ZodPipeline<any, any>;
	// biome-ignore lint/suspicious/noExplicitAny: This is a third-party zod type
	ZodReadonly: z.ZodReadonly<any>;
	ZodSymbol: z.ZodSymbol;
};

function isZodType<T extends keyof ZodFirstPartySchemaTypesNameMap>(
	zodSchema: ZodFirstPartySchemaTypesNameMap[keyof ZodFirstPartySchemaTypesNameMap],
	type: T,
): zodSchema is ZodFirstPartySchemaTypesNameMap[T] {
	return zodSchema?.constructor?.name === type;
}

export function zodSchemaToSimpleSchema(
	zodSchema: ZodFirstPartySchemaTypes,
): SimpleSchema {
	let simpleSchema: SimpleSchema;
	const zodTypeName = zodSchema._def.typeName;
	const description = zodSchema._def.description;
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
			zodSchema._def.shape() as { [key: string]: ZodFirstPartySchemaTypes },
		)) {
			simpleSchema.children[name] = zodSchemaToSimpleSchema(zodType);
		}
	} else if (isZodType(zodSchema, "ZodIntersection")) {
		type SimpleSchemaObject = Extract<SimpleSchema, { type: "object" }>;
		const left = zodSchemaToSimpleSchema(
			zodSchema._def.left as z.AnyZodObject,
		) as SimpleSchemaObject;
		const right = zodSchemaToSimpleSchema(
			zodSchema._def.right as z.AnyZodObject,
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
			children: zodSchemaToSimpleSchema(zodSchema._def.type),
		};
	} else if (isZodType(zodSchema, "ZodSet")) {
		simpleSchema = {
			...defaultProps,
			type: "array",
			children: zodSchemaToSimpleSchema(zodSchema._def.valueType),
		};
	} else if (
		isZodType(zodSchema, "ZodUnion") ||
		isZodType(zodSchema, "ZodDiscriminatedUnion")
	) {
		const zodTypesInUnion: ZodFirstPartySchemaTypes[] = zodSchema._def.options;
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
			...zodSchemaToSimpleSchema(zodSchema._def.innerType),
			optional: true,
		};
	} else if (isZodType(zodSchema, "ZodString")) {
		simpleSchema = { ...defaultProps, type: "string" };
		if (zodSchema._def.checks.length)
			simpleSchema.checks = zodSchema._def.checks;
	} else if (
		isZodType(zodSchema, "ZodNumber") ||
		isZodType(zodSchema, "ZodBigInt")
	) {
		simpleSchema = { ...defaultProps, type: "number" };
		if (zodSchema._def.checks.length)
			simpleSchema.checks = zodSchema._def.checks;
	} else if (isZodType(zodSchema, "ZodBoolean")) {
		simpleSchema = { ...defaultProps, type: "boolean" };
	} else if (isZodType(zodSchema, "ZodDate")) {
		simpleSchema = { ...defaultProps, type: "date" };
		if (zodSchema._def.checks.length)
			simpleSchema.checks = zodSchema._def.checks;
	} else if (isZodType(zodSchema, "ZodNull")) {
		simpleSchema = { ...defaultProps, type: "null" };
	} else if (isZodType(zodSchema, "ZodLiteral")) {
		const value = zodSchema._def.value as Primitive;
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
		const enumValues: string[] = zodSchema._def.values;
		simpleSchema = {
			...defaultProps,
			type: enumValues.map((enumValue) => ({
				type: "literal",
				value: enumValue,
				valueType: "string",
				zodTypeName: ZodFirstPartyTypeKind.ZodLiteral,
			})),
		};
	} else if (isZodType(zodSchema, "ZodEffects")) {
		simpleSchema = {
			...defaultProps,
			...zodSchemaToSimpleSchema(zodSchema._def.schema),
		};
	} else if (isZodType(zodSchema, "ZodNativeEnum")) {
		simpleSchema = { ...defaultProps, type: "number" };
	} else if (isZodType(zodSchema, "ZodNullable")) {
		simpleSchema = {
			...defaultProps,
			type: [
				zodSchemaToSimpleSchema(zodSchema._def.innerType),
				{ type: "null" },
			],
		};
	} else if (isZodType(zodSchema, "ZodDefault")) {
		simpleSchema = {
			...defaultProps,
			...zodSchemaToSimpleSchema(zodSchema._def.innerType),
			default: zodSchema._def.defaultValue(),
		};
	} else if (isZodType(zodSchema, "ZodCatch")) {
		simpleSchema = {
			...defaultProps,
			...zodSchemaToSimpleSchema(zodSchema._def.innerType),
		};
	} else if (isZodType(zodSchema, "ZodBranded")) {
		simpleSchema = {
			...defaultProps,
			...zodSchemaToSimpleSchema(zodSchema._def.type),
		};
	} else if (isZodType(zodSchema, "ZodPipeline")) {
		simpleSchema = {
			...defaultProps,
			...zodSchemaToSimpleSchema(zodSchema._def.in),
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
		zodSchema satisfies never; // Ensure we have a case for every type in ZodFirstPartySchemaTypes
		simpleSchema = {
			...defaultProps,
			type: "other",
			zodTypeName,
		};
	}
	return simpleSchema;
}
