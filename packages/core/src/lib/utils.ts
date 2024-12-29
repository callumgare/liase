import { ActionContext } from "../ActionContext.js";
import chalk from "chalk";

export function createCounter() {
  let counter = -1;
  return () => {
    counter = counter === Number.MAX_SAFE_INTEGER ? 0 : counter + 1;
    return counter;
  };
}

// Now that getUniqueId uses a counter to ensure there are no id clashes due to having the same timestamp,
// we don't really need to use a random int but I had fun writing these functions and don't want to get rid
// of them. So until there's a reason to I'm not going to.
export function getRandomIntOfScale(scale = 6) {
  const min = 10 ** (scale - 1);
  const max = 10 ** scale - 1;
  return getRandomIntInRange(min, max);
}

// Both min and max are inclusive
export function getRandomIntInRange(min = 0, max = 999_999) {
  return Math.floor(
    Math.random() * (Math.floor(max) - Math.ceil(min) + 1) + Math.ceil(min),
  );
}

export const getUniqueId = (() => {
  const counter = createCounter();
  return () => `${Date.now()}-${counter()}-${getRandomIntOfScale(6)}`;
})();

// Used to increase readability in some places
export function mergeInUnsetProperties(a: object, b: object) {
  return { ...b, ...a };
}

export const formatObjectPath = (path: (string | number)[]) =>
  "$" +
  path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : `.${segment}`,
    )
    .join("");

export const formatObjectPathAsTree = (
  path: (string | number)[],
  options: {
    lineIndent?: number; // Can't be less than 2
    overallIndent?: number;
    lastNodeExtraInfo?: string;
  },
) => {
  const lineIndent = options.lineIndent ?? 2;
  const overallIndent = options.overallIndent ?? 0;
  const lastNodeExtraInfo = options.lastNodeExtraInfo ?? "";
  if (lineIndent < 2) {
    throw Error(`Line indent can not be less than 2`);
  }
  let formattedTree = path
    .reduce<string[]>((segments, segment) => {
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
    }, [])
    // If segment is a number then wrap square brackets around it to signal that
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : `${segment}`,
    )
    .map((segment) => chalk.bold(segment))
    // Add arrow between segments
    // Indent each segment by lineIndent more than the last + add arrow between segments
    .map(
      (segment, index) =>
        (index ? " ".repeat(index * lineIndent - 2) + chalk.dim("↳ ") : "") +
        segment,
    )
    .join("\n");
  if (lastNodeExtraInfo) {
    formattedTree = `${formattedTree} - ${lastNodeExtraInfo.replace(/\n/, "\n" + " ".repeat((path.length - 1) * lineIndent))}`;
  }
  return formattedTree
    .split("\n")
    .map((line) => " ".repeat(overallIndent) + line)
    .join("\n");
};

const capitalisedFirstLetter = (string: string) =>
  string[0].toUpperCase() + string.substring(1);

const returnType = (v: unknown) => typeof v;
type TypeOfTypes = ReturnType<typeof returnType>;

export const capitaliseType = (
  type: TypeOfTypes | "array" | "set" | "date",
): string => {
  let result;
  switch (type) {
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
      result = capitalisedFirstLetter(type);
      break;
    case "bigint":
      result = "BigInt";
      break;
  }
  return result;
};

type ConstructorExecutionErrorOptions = {
  cause?: Error;
  log: string[];
  message?: string;
  context: ActionContext;
};
export class ConstructorExecutionError extends Error {
  errorOccurredAtPath;
  log;
  context;

  constructor({
    message,
    cause,
    context,
    log,
  }: ConstructorExecutionErrorOptions) {
    super(message ?? cause?.message ?? "Error when executing constructor");

    if (cause) {
      this.stack = cause.stack;
    }

    // Use class name as the name of the error
    ConstructorExecutionError.prototype.name = this.constructor.name;
    this.errorOccurredAtPath = context.path;
    this.log = log;
    this.context = context;

    this.message = this.getFormattedErrorInfo();

    // Explicitly set the prototype to maintain the correct prototype chain is
    // required for "instanceOf" to work as expected
    Object.setPrototypeOf(this, ConstructorExecutionError.prototype);
  }

  getFormattedErrorInfo() {
    const stack =
      this.cause instanceof Error
        ? this.cause.stack?.replace(this.cause.toString() + "\n", "")
        : this.stack;
    const lastConstructorProp =
      this.errorOccurredAtPath[this.errorOccurredAtPath.length - 1];
    const errorLocation = stack
      ?.split("\n")
      .find((line) => line.startsWith(`    at ${lastConstructorProp}`))
      ?.match(/\((.*)\)/)?.[1];
    return [
      "Failed to render the following response constructor property",
      formatObjectPathAsTree(this.errorOccurredAtPath, {
        lineIndent: 3,
        overallIndent: 2,
        lastNodeExtraInfo: `${chalk.bold(this.message)}\n(${chalk.blue(errorLocation)})`,
      }),
      "",
    ].join("\n");
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

export function hasNoDuplicates(array: unknown[]): boolean {
  return new Set(array).size === array.length;
}

export function getDuplicates<T>(array: T[]): T[] {
  const duplicates = new Set<T>();
  for (let i = 0; i < array.length; i++) {
    for (let j = i + 1; j < array.length; j++) {
      if (array[i] === array[j]) {
        duplicates.add(array[i]);
        continue;
      }
    }
  }
  return [...duplicates];
}

export function getOrdinal(number: number) {
  let suffix;
  switch (number % 10) {
    case 1:
      suffix = "st";
      break;
    case 2:
      suffix = "nd";
      break;
    case 3:
      suffix = "rd";
      break;
    default:
      suffix = "th";
  }
  return `${number}${suffix}`;
}

export function getPromiseWithResolvers<Expected = unknown>() {
  let resolve: (value: Expected) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<Expected>((...resolvers) => {
    resolve = resolvers[0];
    reject = resolvers[1];
  });
  // @ts-expect-error The point of this is to make sure the resolvers are defined
  if (typeof resolve === "undefined" || typeof reject === "undefined") {
    throw Error("Resolvers not set yet");
  }
  return {
    promise,
    resolve,
    reject,
  };
}

export type ObjectEntry<BaseType> = [keyof BaseType, BaseType[keyof BaseType]];

// Takes an object and if any property values are promises it will wait until they're resolved.
export async function waitForAllPropertiesToResolve<
  ObjectWithPromises,
>(object: {
  [key in keyof ObjectWithPromises]: ObjectWithPromises[key];
}): Promise<{
  [key in keyof ObjectWithPromises]: Awaited<ObjectWithPromises[key]>;
}> {
  // So that we can use Promise.all() to resolve every prop in object we first convert
  // object to an array of entries, then we swap each entry with a promise that resolves
  // to the entry. That way we can can use Promise.all() on it to get us back to an array
  // of entries (but now with any promises resolved), then use Object.fromEntry() to
  // re-assemble the entries back into an object.
  const entriesAsPromises = Object.entries(object).map((entry) => {
    const [entryKey, entryValue] = entry;
    if (entryValue instanceof Promise) {
      return entryValue.then((resolvedEntryValue: any) => [
        entryKey,
        resolvedEntryValue,
      ]);
    } else {
      return new Promise((resolve) => resolve(entry as [any, any]));
    }
  }) as Promise<ObjectEntry<ObjectWithPromises>>[];
  const entriesResolved = await Promise.all(entriesAsPromises);
  return Object.fromEntries(entriesResolved) as {
    [key in keyof ObjectWithPromises]: Awaited<ObjectWithPromises[key]>;
  };
}
