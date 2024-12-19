import pluralize from "pluralize";
import { z } from "zod";
import chalk from "chalk";
import util from "node:util";
import { capitaliseType, formatObjectPath } from "./utils.js";

function isZodError(error: unknown): error is z.ZodError {
  return error?.constructor?.name === "ZodError";
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
