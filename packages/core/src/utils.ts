import pluralize from "pluralize";
import { z, ZodFirstPartySchemaTypes, Primitive, ZodFirstPartyTypeKind } from "zod";
import { ActionContext } from "./ActionContext.js";

type SimpleSchema = (
  {
    type: "string",
    default?: string,
    checks?: z.ZodStringCheck[],
  } | {
    type: "number",
    default?: number,
    checks?: Array<z.ZodNumberCheck | z.ZodBigIntCheck>,
  } | {
    type: "boolean",
    default?: boolean,
  } | {
    type: "date",
    default?: Date | string,
    checks?: z.ZodDateCheck[],
  } | {
    type: "object",
    children: {[key: string]: SimpleSchema},
    default?: {[key: string]: unknown},
  } | {
    type: "array",
    children: SimpleSchema,
    default?: unknown[],
  } | {
    type: SimpleSchema[], // Union type
    default?: unknown,
  } | {
    type: "literal",
    value: Primitive
    valueType: "string" | "number" | "boolean" | "null" | "other",
    default?: never,
  } | {
    type: "null",
    default?: null,
  } | {
    type: "other" | "undefined",
    default?: unknown,
    zodTypeName: ZodFirstPartySchemaTypes["_def"]["typeName"],
  }
) & {
  optional?: boolean;
  description?: string;
}


export function zodSchemaToSimpleSchema(zodSchema: ZodFirstPartySchemaTypes): SimpleSchema {
  let simpleSchema: SimpleSchema
  const zodTypeName = zodSchema._def.typeName
  const description = zodSchema._def.description
  const defaultProps = {
    ...(description ? {description} : {})
  }
  if (zodSchema instanceof z.ZodObject) {
    simpleSchema = {
      ...defaultProps,
      type: "object",
      children: {},
    }
    for (const [name, zodType] of Object.entries(zodSchema._def.shape() as {[key: string]: ZodFirstPartySchemaTypes})) {
      simpleSchema.children[name] = zodSchemaToSimpleSchema(zodType)
    }
  } else if (zodSchema instanceof z.ZodIntersection) {
    type SimpleSchemaObject = Extract<SimpleSchema, { type: "object" }>
    const left = zodSchemaToSimpleSchema(zodSchema._def.left as z.AnyZodObject) as SimpleSchemaObject
    const right = zodSchemaToSimpleSchema(zodSchema._def.right as z.AnyZodObject) as SimpleSchemaObject

    simpleSchema = {
      ...defaultProps,
      type: "object",
      children: {...left.children, ...right.children},
    }
  } else if (zodSchema instanceof z.ZodArray) {
    simpleSchema = {
      ...defaultProps,
      type: "array",
      children: zodSchemaToSimpleSchema(zodSchema._def.type),
    }
  } else if (zodSchema instanceof z.ZodSet) {
    simpleSchema = {
      ...defaultProps,
      type: "array",
      children: zodSchemaToSimpleSchema(zodSchema._def.valueType),
    }
  } else if (zodSchema instanceof z.ZodUnion || zodSchema instanceof z.ZodDiscriminatedUnion) {
    const zodTypesInUnion: ZodFirstPartySchemaTypes[] = zodSchema._def.options
    const simpleSchemaTypesInUnion = zodTypesInUnion.map(zodSchemaToSimpleSchema)
    simpleSchema = {...defaultProps, type: simpleSchemaTypesInUnion}
    const unionIncludesUndefined = simpleSchemaTypesInUnion.some(
      schema => schema.type === "other" && schema.zodTypeName === "ZodUndefined"
    )
    if (unionIncludesUndefined) {
      simpleSchema.optional = true
    }
  } else if (zodSchema instanceof z.ZodOptional) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(zodSchema._def.innerType),
      optional: true,
    }
  } else if (zodSchema instanceof z.ZodString) {
    simpleSchema = {...defaultProps, type: "string"}
    if (zodSchema._def.checks.length) simpleSchema.checks = zodSchema._def.checks
  } else if (zodSchema instanceof z.ZodNumber || zodSchema instanceof z.ZodBigInt) {
    simpleSchema = {...defaultProps, type: "number"}
    if (zodSchema._def.checks.length) simpleSchema.checks = zodSchema._def.checks
  } else if (zodSchema instanceof z.ZodBoolean) {
    simpleSchema = {...defaultProps, type: "boolean"}
  } else if (zodSchema instanceof z.ZodDate) {
    simpleSchema = {...defaultProps, type: "date"}
    if (zodSchema._def.checks.length) simpleSchema.checks = zodSchema._def.checks
  } else if (zodSchema instanceof z.ZodNull) {
    simpleSchema = {...defaultProps, type: "null"}
  } else if (zodSchema instanceof z.ZodLiteral) {
    const value = zodSchema._def.value as Primitive
    let valueType
    if (typeof value === "string") {
      valueType = "string" as const
    } else if (typeof value === "number" || typeof value === "bigint") {
      valueType = "number" as const
    } else if (typeof value === "boolean") {
      valueType = "boolean" as const
    } else if (value === null) {
      valueType = "null" as const
    } else {
      valueType = "other" as const
    }
    simpleSchema = {
      ...defaultProps,
      type: "literal",
      value,
      valueType,
    }
  } else if (zodSchema instanceof z.ZodEnum) {
    const enumValues: string[] = zodSchema._def.values
    simpleSchema = {
      ...defaultProps,
      type: enumValues.map(enumValue => ({
        type: "literal",
        value: enumValue,
        valueType: "string",
        zodTypeName: ZodFirstPartyTypeKind.ZodLiteral,
      }))
    }
  } else if (zodSchema instanceof z.ZodEffects) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(zodSchema._def.schema)
    }
  } else if (zodSchema instanceof z.ZodNativeEnum) {
    simpleSchema = {...defaultProps, type: "number"}
  } else if (zodSchema instanceof z.ZodNullable) {
    simpleSchema = {
      ...defaultProps,
      type: [
        zodSchemaToSimpleSchema(zodSchema._def.innerType),
        {type: "null"}
      ]
    }
  } else if (zodSchema instanceof z.ZodDefault) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(zodSchema._def.innerType),
      default: zodSchema._def.defaultValue()
    }
  } else if (zodSchema instanceof z.ZodCatch) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(zodSchema._def.innerType)
    }
  } else if (zodSchema instanceof z.ZodBranded) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(zodSchema._def.type)
    }
  } else if (zodSchema instanceof z.ZodPipeline) {
    simpleSchema = {
      ...defaultProps,
      ...zodSchemaToSimpleSchema(zodSchema._def.in)
    }
  } else if (
    zodSchema instanceof z.ZodAny || zodSchema instanceof z.ZodUndefined || zodSchema instanceof z.ZodNaN ||
    zodSchema instanceof z.ZodUnknown || zodSchema instanceof z.ZodNever || zodSchema instanceof z.ZodVoid ||
    zodSchema instanceof z.ZodTuple || zodSchema instanceof z.ZodRecord || zodSchema instanceof z.ZodMap ||
    zodSchema instanceof z.ZodFunction || zodSchema instanceof z.ZodLazy || zodSchema instanceof z.ZodVoid ||
    zodSchema instanceof z.ZodPromise || zodSchema instanceof z.ZodReadonly || zodSchema instanceof z.ZodSymbol
  ) {
    simpleSchema = {
      ...defaultProps,
      type: "other",
      zodTypeName,
    }
  } else {
    zodSchema satisfies never // Ensure we have a case for every type in ZodFirstPartySchemaTypes
    simpleSchema = {
      ...defaultProps,
      type: "other",
      zodTypeName
    }
  }
  return simpleSchema
}

export function createCounter() {
  let counter = -1
  return () => {
    counter = (counter === Number.MAX_SAFE_INTEGER) ? 0 : (counter + 1)
    return counter
  }
}

// Now that getUniqueId uses a counter to ensure there are no id clashes due to having the same timestamp,
// we don't really need to use a random int but I had fun writing these functions and don't want to get rid
// of them. So until there's a reason to I'm not going to.
export function getRandomIntOfScale(scale = 6) {
  const min = 10 ** (scale - 1)
  const max = (10 ** scale) - 1
  return getRandomIntInRange(min, max)
}

// Both min and max are inclusive
export function getRandomIntInRange(min = 0, max = 999_999) {
  return Math.floor(
    Math.random() * (Math.floor(max) - Math.ceil(min) + 1) + Math.ceil(min)
  );
}

export const getUniqueId = (() => {
  const counter = createCounter()
  return () => `${Date.now()}-${counter()}-${getRandomIntOfScale(6)}`
})()

// Used to increase readability in some places
export function mergeInUnsetProperties(a: object, b: object) {
  return {...b, ...a}
}


export const formatObjectPath = (path: (string | number)[]) => "$" + path
  .map(segment => typeof segment === "number" ? `[${segment}]` : `.${segment}`)
  .join("")

const capitalisedFirstLetter = (string: string) => string[0].toUpperCase() + string.substring(1);

const returnType = (v: unknown) => typeof v
type TypeOfTypes = ReturnType<typeof returnType>

const capitaliseType = (type: TypeOfTypes | "array" | "set" | "date"): string => {
  let result
  switch(type) {
    case "string":
    case "number":
    case "boolean":
    case "symbol":
    case "undefined":
    case "object":
    case "function":
    case "array":
    case "set":
    case "date":
      result = capitalisedFirstLetter(type)
      break;
    case "bigint":
      result = "BigInt"
      break;
  }
  return result
}


type ConstructorExecutionErrorOptions = {
  cause?: Error,
  log: string[],
  message?: string,
  context: ActionContext,
}
export class ConstructorExecutionError extends Error {
  errorOccurredAtPath
  log
  context

  constructor({message, cause, context, log}: ConstructorExecutionErrorOptions) {
    super(message ?? cause?.message ?? "Error when executing constructor", {cause});

    this.errorOccurredAtPath = context.path
    this.log = log
    this.context = context

    Object.setPrototypeOf(this, ConstructorExecutionError.prototype);
  }

  getFormattedErrorInfo() {
    return [
      this.message,
      `  Error occurred at: ${formatObjectPath(this.errorOccurredAtPath)}`
    ].join("\n");
  }
}


export function zodParseOrThrow<Output, Def extends z.ZodTypeDef, Input>(
  zodSchema: z.ZodType<Output, Def, Input>,
  input: any,
  options: {errorMessage?: string} = {},
): Output {
  try {
    return zodSchema.parse(input)
  } catch(error) {
    if (error instanceof z.ZodError) {
      const friendlyError = new FriendlyZodError(error, {message: options.errorMessage, inputData: input})
      console.error(friendlyError.formattedErrorInfo)
      process.exit(1)
    }
    throw error
  }
}


type ValueType = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "array"

export const getType = (value: unknown): ValueType => {
  if (Array.isArray(value)) {
    return "array"
  } else {
    return typeof value
  }
}

function getPathInfo (
  inputData: unknown,
  path: (string | number)[]
): {
  exists: boolean,
  value: unknown,
  type: ValueType,
  longestExistingPath: (string | number)[],
  typeAtLongestExistingPath: ValueType,
} {
  return path.reduce<any>(
    (accumulator: any, currentArrayValue: string | number) => {
      const exists = typeof accumulator.value !== "undefined" && currentArrayValue in accumulator.value
      const value = accumulator.value?.[currentArrayValue]
      const type = getType(value)
      return {
        exists,
        value,
        type,
        longestExistingPath: exists ?
          [...accumulator.longestExistingPath, currentArrayValue]
          : accumulator.longestExistingPath,
        typeAtLongestExistingPath: exists ? type : accumulator.typeAtLongestExistingPath
      }
    },
    {
      exists: true,
      value: inputData,
      longestExistingPath: [],
      typeAtLongestExistingPath: getType(inputData)
    }
  )
}

type FriendlyZodErrorOptions = {
  message?: string,
  inputData?: unknown,
}
export class FriendlyZodError extends Error {
  #inputData
  cause: z.ZodError

  constructor(error: z.ZodError, {message, inputData}: FriendlyZodErrorOptions = {}) {
    super(message ?? error?.message ?? "Error when validating data", {cause: error});
    this.cause = error

    this.#inputData = inputData

    Object.setPrototypeOf(this, FriendlyZodError.prototype);
  }


  formatZodIssue(issue: z.ZodIssue): string {
    const {path, ...detailWithoutPath} = issue
    const formattedPath = formatObjectPath(path)
    let pathInfo = getPathInfo(this.#inputData, path)
    let issueMessage: string

    if (issue.code === "invalid_type") {
      if (pathInfo.exists) {
        const includeValue = ["string", "number"].includes(pathInfo.type)
        issueMessage = `Expected ${formattedPath} to be an ${issue.expected} but ` +
          (includeValue ? `the received value ${JSON.stringify(pathInfo.value)} was` : "received") +
          ` a ${issue.received}.`
      } else {
        const keyOrIndex = path.at(-1)
        const parentPath = formatObjectPath(path.slice(0, -1))
        const isIndex = pathInfo.typeAtLongestExistingPath === "array" && typeof keyOrIndex === "number"
        issueMessage = `Missing ${isIndex ? "element" : "key"} "${keyOrIndex}" at ${parentPath},` +
          ` expected to receive a ${issue.expected}.`
      }
    } else if (issue.code === "unrecognized_keys") {
      const keys = issue.keys.map(key => {
        pathInfo = getPathInfo(this.#inputData, [...path, key])
        const includeValue = ["string", "number"].includes(pathInfo.type)
        const formattedValue = includeValue ? JSON.stringify(pathInfo.value) : `is a ${pathInfo.type}`
        return `"${key}" (value ${formattedValue})`
      })
      issueMessage = `Unexpected ${pluralize("key", keys.length)} found at ${formattedPath}: ${keys.join(", ")}`
    } else if (issue.code === "invalid_string") {
      issueMessage = `${formattedPath} failed ${issue.validation} validation, received ${JSON.stringify(pathInfo.value)}`
    } else if (issue.code === "too_small" || issue.code === "too_big") {
      let condition, threshold
      if (issue.code === "too_small") {
        threshold = issue.inclusive ?
          issue.minimum
          : (typeof issue.minimum === "number" ? issue.minimum + 1 : issue.minimum + BigInt(1))
        condition = issue.exact ? "" : "at least"
      } else if (issue.code === "too_big") {
        threshold = issue.inclusive ?
          issue.maximum
          : (typeof issue.maximum === "number" ? issue.maximum + 1 : issue.maximum + BigInt(1))
        condition = issue.exact ? "" : "less than"
      }

      if (issue.type === "number" || issue.type === "bigint" || issue.type === "date") {
        const capitalisedType = capitaliseType(issue.type)
        issueMessage = `${capitalisedType} at ${formattedPath} must be ${condition}` +
          ` ${threshold} but was ${pathInfo.value}.`
      } else {
        const nameForTypeElement = ({
          "string": "character",
          "array": "element",
          "set": "element",
        })[issue.type]
        const capitalisedType = capitaliseType(issue.type)
        const length = (pathInfo.value as Array<unknown>).length
        issueMessage = `${capitalisedType} at ${formattedPath} must have ${condition}` +
          ` ${threshold} ${nameForTypeElement}(s) but the received ${issue.type} had ${length}.`
      }
    } else {
      pathInfo = getPathInfo(this.#inputData, path)
      issueMessage = `Issue with ${formattedPath}: ${JSON.stringify(detailWithoutPath)} - ${JSON.stringify(pathInfo.value)}`
    }
    return `- ${issueMessage}`
  }

  formatZodErrorIssues(error: z.ZodError = this.cause, depth = 0): string {
    const indentSize = 2
    const lines: string[] = []
    for (const issue of error.issues) {
      lines.push(" ".repeat(depth * indentSize) + this.formatZodIssue(issue))

      if (issue.code === 'invalid_union') {
        lines.push(
          ...issue.unionErrors.map(error => this.formatZodErrorIssues(error, depth + 1))
        )
      } else if (issue.code === "invalid_arguments") {
        lines.push( this.formatZodErrorIssues(issue.argumentsError, depth + 1) )
      } else if (issue.code === "invalid_return_type") {
        lines.push( this.formatZodErrorIssues(issue.returnTypeError, depth + 1) )
      }
    }
    return lines.join("\n")
  }

  get formattedErrorInfo() {
    return [
      this.message,
      ...(this.#inputData ? [`Input data: \n${JSON.stringify(this.#inputData, null, 2)}`] : []),
      `The following ${this.cause.issues.length > 1 ? "issues were" : "issue was"} found:`,
      this.formatZodErrorIssues(this.cause, 1),
    ].join("\n");
  }
}


export function hasNoDuplicates(array: unknown[]): boolean {
  return (new Set(array)).size === array.length;
}


export function getOrdinal(number: number) {
  let suffix
  switch(number % 10) {
    case 1:
      suffix = "st"
      break;
    case 2:
      suffix = "nd"
      break;
    case 3:
      suffix = "rd"
      break;
    default:
      suffix = "th"
  }
  return `${number}${suffix}`
}

export function getPromiseWithResolvers<Expected = unknown>() {
  let resolve: (value: Expected) => void
  let reject: (reason?: any) => void
  const promise = new Promise<Expected>((...resolvers) => {
    resolve = resolvers[0];
    reject = resolvers[1]
  })
  // @ts-expect-error The point of this is to make sure the resolvers are defined
  if (typeof resolve === "undefined" || typeof reject === "undefined" ) {
    throw Error("Resolvers not set yet")
  }
  return {
    promise,
    resolve,
    reject
  }
}

export type ObjectEntry<BaseType> = [keyof BaseType, BaseType[keyof BaseType]];

// Takes an object and if any property values are promises it will wait until they're resolved.
export async function waitForAllPropertiesToResolve<ObjectWithPromises>(
  object: { [key in keyof ObjectWithPromises]: ObjectWithPromises[key] }
): Promise<{ [key in keyof ObjectWithPromises]: Awaited<ObjectWithPromises[key]> }> {
  // So that we can use Promise.all() to resolve every prop in object we first convert
  // object to an array of entries, then we swap each entry with a promise that resolves
  // to the entry. That way we can can use Promise.all() on it to get us back to an array
  // of entries (but now with any promises resolved), then use Object.fromEntry() to
  // re-assemble the entries back into an object.
  const entriesAsPromises = Object.entries(object)
    .map(entry => {
      const [entryKey, entryValue] = entry
      if (entryValue instanceof Promise) {
        return entryValue.then( (resolvedEntryValue: any) => ([entryKey, resolvedEntryValue]) )
      } else {
        return new Promise(resolve => resolve(entry as [any, any]))
      }
    }) as Promise<ObjectEntry<ObjectWithPromises>>[]
  const entriesResolved = await Promise.all(entriesAsPromises)
  return Object.fromEntries(entriesResolved) as { [key in keyof ObjectWithPromises]: Awaited<ObjectWithPromises[key]> }
}
