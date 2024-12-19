import pluralize from "pluralize";
import {
  z,
  ZodFirstPartySchemaTypes,
  Primitive,
  ZodFirstPartyTypeKind,
} from "zod";
import chalk from "chalk";
import util from "node:util";
import { capitaliseType, formatObjectPath } from "./utils.js";

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
  ZodArray: z.ZodArray<any, any>;
  ZodObject: z.ZodObject<any, any, any>;
  ZodUnion: z.ZodUnion<any>;
  ZodDiscriminatedUnion: z.ZodDiscriminatedUnion<any, any>;
  ZodIntersection: z.ZodIntersection<any, any>;
  ZodTuple: z.ZodTuple<any, any>;
  ZodRecord: z.ZodRecord<any, any>;
  ZodMap: z.ZodMap<any>;
  ZodSet: z.ZodSet<any>;
  ZodFunction: z.ZodFunction<any, any>;
  ZodLazy: z.ZodLazy<any>;
  ZodLiteral: z.ZodLiteral<any>;
  ZodEnum: z.ZodEnum<any>;
  ZodEffects: z.ZodEffects<any, any, any>;
  ZodNativeEnum: z.ZodNativeEnum<any>;
  ZodOptional: z.ZodOptional<any>;
  ZodNullable: z.ZodNullable<any>;
  ZodDefault: z.ZodDefault<any>;
  ZodCatch: z.ZodCatch<any>;
  ZodPromise: z.ZodPromise<any>;
  ZodBranded: z.ZodBranded<any, any>;
  ZodPipeline: z.ZodPipeline<any, any>;
  ZodReadonly: z.ZodReadonly<any>;
  ZodSymbol: z.ZodSymbol;
};

function isZodType<T extends keyof ZodFirstPartySchemaTypesNameMap>(
  zodSchema: ZodFirstPartySchemaTypesNameMap[keyof ZodFirstPartySchemaTypesNameMap],
  type: T,
): zodSchema is ZodFirstPartySchemaTypesNameMap[T] {
  return zodSchema?.constructor?.name === type;
}

function isZodError(error: unknown): error is z.ZodError {
  return error?.constructor?.name === "ZodError";
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
    let valueType;
    if (typeof value === "string") {
      valueType = "string" as const;
    } else if (typeof value === "number" || typeof value === "bigint") {
      valueType = "number" as const;
    } else if (typeof value === "boolean") {
      valueType = "boolean" as const;
    } else if (value === null) {
      valueType = "null" as const;
    } else {
      valueType = "other" as const;
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

export function zodParseOrThrow<Output, Def extends z.ZodTypeDef, Input>(
  zodSchema: z.ZodType<Output, Def, Input>,
  input: any,
  options: { errorMessage?: string } = {},
): Output {
  try {
    return zodSchema.parse(input);
  } catch (error) {
    // We might be passing a zodSchema from a plugin with a different instance of the Zod library
    // and thus if that gives an error it might not be an instance of the ZodError from the exact Zod library
    // we're using. Thus we match using the constructor name to be safe.
    if (isZodError(error)) {
      const friendlyError = new FriendlyZodError(error, {
        message: options.errorMessage,
        inputData: input,
      });
      throw friendlyError;
    }
    throw error;
  }
}

type ValueType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function"
  | "array";

export const getType = (value: unknown): ValueType => {
  if (Array.isArray(value)) {
    return "array";
  } else {
    return typeof value;
  }
};

function getPathInfo(
  inputData: unknown,
  path: (string | number)[],
): {
  exists: boolean;
  value: unknown;
  type: ValueType;
  longestExistingPath: (string | number)[];
  typeAtLongestExistingPath: ValueType;
} {
  return path.reduce<any>(
    (accumulator: any, currentArrayValue: string | number) => {
      const exists =
        typeof accumulator.value !== "undefined" &&
        currentArrayValue in accumulator.value;
      const value = accumulator.value?.[currentArrayValue];
      const type = getType(value);
      return {
        exists,
        value,
        type,
        longestExistingPath: exists
          ? [...accumulator.longestExistingPath, currentArrayValue]
          : accumulator.longestExistingPath,
        typeAtLongestExistingPath: exists
          ? type
          : accumulator.typeAtLongestExistingPath,
      };
    },
    {
      exists: true,
      value: inputData,
      longestExistingPath: [],
      typeAtLongestExistingPath: getType(inputData),
    },
  );
}

type FriendlyZodErrorOptions = {
  message?: string;
  inputData?: unknown;
};

type FriendlyZodErrorIssue = {
  zodIssue: z.ZodIssue;
  depth: number;
  formattedMessage: string;
};
type FriendlyZodErrorIssuesTree = {
  issues: FriendlyZodErrorIssue[];
  children: Record<string | number, FriendlyZodErrorIssuesTree>;
};
export class FriendlyZodError extends Error {
  #inputData;
  cause: z.ZodError;

  constructor(
    error: z.ZodError,
    { message, inputData }: FriendlyZodErrorOptions = {},
  ) {
    super(message ?? error?.message ?? "Error when validating data", {
      cause: error,
    });
    this.cause = error;

    this.#inputData = inputData;

    Object.setPrototypeOf(this, FriendlyZodError.prototype);
  }

  formatZodIssue(issue: z.ZodIssue, includePath = true): string {
    const { path, ...detailWithoutPath } = issue;
    const formattedPath = formatObjectPath(path);
    let pathInfo = getPathInfo(this.#inputData, path);
    let issueMessage: string;

    if (issue.code === "invalid_type") {
      if (pathInfo.exists) {
        const includeValue = ["string", "number"].includes(pathInfo.type);
        issueMessage =
          `Expected ${includePath ? formattedPath + " to be an" : ""}${issue.expected} but ` +
          (includeValue
            ? `the received value ${JSON.stringify(pathInfo.value)} was`
            : "received") +
          ` a ${issue.received}.`;
      } else {
        const keyOrIndex = path.at(-1);
        const parentPath = formatObjectPath(path.slice(0, -1));
        const isIndex =
          pathInfo.typeAtLongestExistingPath === "array" &&
          typeof keyOrIndex === "number";
        issueMessage =
          `Missing ${isIndex ? "element" : "key"} "${keyOrIndex}" at ${parentPath},` +
          ` expected to receive a ${issue.expected}.`;
      }
    } else if (issue.code === "unrecognized_keys") {
      const keys = issue.keys.map((key) => {
        pathInfo = getPathInfo(this.#inputData, [...path, key]);
        const includeValue = ["string", "number"].includes(pathInfo.type);
        const formattedValue = includeValue
          ? JSON.stringify(pathInfo.value)
          : `is a ${pathInfo.type}`;
        return `"${key}" (value ${formattedValue})`;
      });
      issueMessage = `Unexpected ${pluralize("key", keys.length)} found${includePath ? " at " + formattedPath : ""}: ${keys.join(", ")}`;
    } else if (issue.code === "invalid_string") {
      issueMessage = `${includePath ? formattedPath + " failed" : "Failed"} ${issue.validation} validation, received ${JSON.stringify(pathInfo.value)}`;
    } else if (issue.code === "too_small" || issue.code === "too_big") {
      let condition, threshold;
      if (issue.code === "too_small") {
        threshold = issue.minimum;
        if (issue.exact) {
          condition = "";
        } else if (issue.inclusive) {
          condition = "a minimum of";
        } else {
          condition = "more than";
        }
      } else if (issue.code === "too_big") {
        threshold = issue.maximum;
        if (issue.exact) {
          condition = "";
        } else if (issue.inclusive) {
          condition = "a maximum of";
        } else {
          condition = "less than";
        }
      }

      if (
        issue.type === "number" ||
        issue.type === "bigint" ||
        issue.type === "date"
      ) {
        const capitalisedType = capitaliseType(issue.type);
        issueMessage =
          `${capitalisedType} ${includePath ? "at " + formattedPath + " " : ""}must be ${condition}` +
          ` ${threshold} but was ${pathInfo.value}.`;
      } else {
        const nameForTypeElement = {
          string: "character",
          array: "element",
          set: "element",
        }[issue.type];
        const capitalisedType = capitaliseType(issue.type);
        const length = (pathInfo.value as Array<unknown>).length;
        issueMessage =
          `${capitalisedType} ${includePath ? " at " + formattedPath + " " : ""}must have ${condition}` +
          ` ${threshold} ${nameForTypeElement}(s) but the received ${issue.type} had ${length}.`;
      }
    } else if (issue.code === "invalid_date") {
      issueMessage = `Expected date ${includePath ? "at " + formattedPath + " " : ""}but received value ${JSON.stringify(pathInfo.value)} is not a valid date.`;
    } else {
      pathInfo = getPathInfo(this.#inputData, path);
      issueMessage = `Issue with${includePath ? " " + formattedPath : ""}: ${JSON.stringify(detailWithoutPath)} - ${JSON.stringify(pathInfo.value)}`;
    }
    return `${issueMessage}`;
  }

  formatZodErrorIssues(
    error: z.ZodError = this.cause,
    depth = 0,
    includePath = true,
  ): FriendlyZodErrorIssue[] {
    const indentSize = 2;
    const formattedIssues: FriendlyZodErrorIssue[] = [];
    for (const issue of error.issues) {
      if (issue.code === "invalid_union") {
        formattedIssues.push({
          formattedMessage: " ".repeat(depth * indentSize) + "Invalid union:",
          zodIssue: issue,
          depth,
        });
        for (const error of issue.unionErrors) {
          formattedIssues.push(
            ...this.formatZodErrorIssues(error, depth + 1, includePath),
          );
        }
      } else if (issue.code === "invalid_arguments") {
        formattedIssues.push({
          formattedMessage:
            " ".repeat(depth * indentSize) + "Invalid arguments:",
          zodIssue: issue,
          depth,
        });
        formattedIssues.push(
          ...this.formatZodErrorIssues(
            issue.argumentsError,
            depth + 1,
            includePath,
          ),
        );
      } else if (issue.code === "invalid_return_type") {
        formattedIssues.push({
          formattedMessage:
            " ".repeat(depth * indentSize) + "Invalid return type:",
          zodIssue: issue,
          depth,
        });
        formattedIssues.push(
          ...this.formatZodErrorIssues(
            issue.returnTypeError,
            depth + 1,
            includePath,
          ),
        );
      } else {
        formattedIssues.push({
          formattedMessage:
            " ".repeat(depth * indentSize) +
            this.formatZodIssue(issue, includePath),
          zodIssue: issue,
          depth,
        });
      }
    }
    return formattedIssues;
  }

  formatZodErrorIssuesAsDotPoints(
    error: z.ZodError = this.cause,
    depth = 0,
    indentSize = 2,
  ): string {
    return this.formatZodErrorIssues(error)
      .map(
        (friendlyZodIssue) =>
          `${" ".repeat((depth + friendlyZodIssue.depth) * indentSize)}- ${friendlyZodIssue.formattedMessage}`,
      )
      .join("\n");
  }

  formatZodErrorIssuesAsTree(
    error: z.ZodError = this.cause,
  ): FriendlyZodErrorIssuesTree {
    const issuesTree: FriendlyZodErrorIssuesTree = {
      issues: [],
      children: {},
    };
    for (const friendlyZodIssue of this.formatZodErrorIssues(error, 0, false)) {
      let issueSubtree = issuesTree;
      const path = friendlyZodIssue.zodIssue.path.reduce<string[]>(
        (segments, segment) => {
          if (typeof segment === "number") {
            const formattedSegment = `[${segment}]`;
            if (segments.length) {
              segments[segments.length - 1] += formattedSegment;
            } else {
              segments.push(formattedSegment);
            }
          } else {
            segments.push(segment);
          }
          return segments;
        },
        [],
      );
      for (const pathSegment of path) {
        if (!(pathSegment in issueSubtree.children)) {
          issueSubtree.children[pathSegment] = {
            issues: [],
            children: {},
          };
        }
        issueSubtree = issueSubtree.children[pathSegment];
      }
      issueSubtree.issues.push(friendlyZodIssue);
    }
    return issuesTree;
  }

  formatZodErrorIssuesAsTreeString(
    error: z.ZodError = this.cause,
    depth = 0,
    indentSize = 2,
  ): string {
    function formatSubtree(
      issuesTree: FriendlyZodErrorIssuesTree,
      depth: number,
    ) {
      const lines: string[] = [];
      const baseIndentation = " ".repeat(depth * indentSize);
      for (const friendlyZodIssue of issuesTree.issues) {
        const indentation =
          baseIndentation + " ".repeat(friendlyZodIssue.depth * indentSize);
        lines.push(
          indentation +
            "- " +
            friendlyZodIssue.formattedMessage.replace(/^\s+/, ""),
        );
      }
      for (const [index, key] of Object.keys(issuesTree.children).entries()) {
        const issuesSubtree = issuesTree.children[key];
        if (index) {
          lines.push("");
        }
        lines.push(baseIndentation + chalk.bold(key));
        const subtreeLines = formatSubtree(issuesSubtree, depth + 1);
        if (subtreeLines.length) {
          lines.push(formatSubtree(issuesSubtree, depth + 1));
        }
      }
      return lines.join("\n");
    }

    const issuesTree = this.formatZodErrorIssuesAsTree(error);
    return formatSubtree(issuesTree, depth);
  }

  get formattedErrorInfo(): string {
    return [
      this.message,
      ...(this.#inputData
        ? [
            `Input data: \n${util.inspect(this.#inputData, { depth: null, colors: true })}`,
          ]
        : []),
      "",
      `The following ${this.cause.issues.length > 1 ? "issues were" : "issue was"} found:`,
      this.formatZodErrorIssuesAsTreeString(this.cause, 1),
    ].join("\n");
  }

  [util.inspect.custom]() {
    return this.formattedErrorInfo;
  }
}
