import { DomNode, DomSelection } from "@liase/envoy";
import { ActionContext, excludeFieldMarker } from "./ActionContext.js";
import {
  ConstructorExecutionError,
  formatObjectPath,
  getType,
  waitForAllPropertiesToResolve,
} from "./lib/utils.js";
import type {
  Action,
  Constructor,
  ConstructorObject,
} from "./schemas/constructor.js";

const log: string[] = [];

export async function executeConstructor(
  constructorDef: Constructor,
  context: ActionContext,
): Promise<unknown> {
  try {
    if (
      !Array.isArray(constructorDef) &&
      typeof constructorDef === "object" &&
      !(constructorDef instanceof Date) &&
      constructorDef !== null
    ) {
      return executeConstructorObject(constructorDef, context);
    }
    if (Array.isArray(constructorDef)) {
      return executeConstructorArray(constructorDef, context);
    }
    if (typeof constructorDef === "function") {
      return executeAction(constructorDef, context)
        .then((context) => context.lastResult())
        .then((result) => {
          if (result instanceof DomNode) {
            return result.text;
          }
          if (result instanceof DomSelection) {
            return result.map((node) => node.text).join(" ");
          }
          return result;
        });
    }
    return constructorDef;
  } catch (error) {
    handleExecutionError(error, context);
  }
}

export async function executeConstructorObject(
  constructorDef: ConstructorObject,
  context: ActionContext,
): Promise<unknown> {
  let currentContext = context;
  const topLevelPath = currentContext.path;

  if (constructorDef._arrayMap) {
    handleExecutionError(
      new Error(
        `Constructor with "_arrayMap" used outside of an array context`,
      ),
      currentContext.clone({ appendToPath: ["_arrayMap"] }),
    );
  }

  if (constructorDef._setup) {
    currentContext = await executeAction(
      constructorDef._setup,
      currentContext.clone({ path: [...topLevelPath, "_setup"] }),
    );
  }

  const returnObject: { [key: string]: unknown } = {};

  if (constructorDef._include) {
    const resultContext = await executeAction(
      constructorDef._include,
      currentContext.clone({ path: [...topLevelPath, "_include"] }),
    );
    const resultValue = resultContext.get("");

    if (resultValue.constructor !== Object) {
      throw handleExecutionError(
        Error(
          `_include must return a plain object but instead received: ${getType(
            resultValue,
          )}`,
        ),
        resultContext,
      );
    }

    Object.assign(returnObject, resultValue);

    // We don't want _include to override any value _setup has written to $.get('') but we do
    // want to keep any values it has written to other non-'' keys.
    currentContext = currentContext.clone({
      data: { ...resultContext.getAll(), "": currentContext.get("") },
    });
  }

  const constructorReturnKeys = Object.fromEntries(
    Object.entries(constructorDef).filter(
      // Filter out constructor instruction keys
      ([key]) => !key.match(/^_[^_]/),
    ),
  );

  for (const key of Object.keys(constructorReturnKeys)) {
    const value = constructorReturnKeys[key];
    const newKey = key.replace(/^__/, "_"); // Unescape _ if starts with escaped _

    returnObject[newKey] = executeConstructor(
      value,
      currentContext.clone({ path: [...topLevelPath, key] }),
    );
  }

  const awaitedReturnObject = await waitForAllPropertiesToResolve(returnObject);

  // Remove any fields/array elements who's value is the ExcludeField symbol
  for (const key of Object.keys(awaitedReturnObject)) {
    const value = awaitedReturnObject[key];
    if (value === excludeFieldMarker) {
      delete awaitedReturnObject[key];
    }
  }

  return awaitedReturnObject;
}

export async function executeConstructorArray(
  constructorDef: Array<Constructor>,
  context: ActionContext,
): Promise<Array<unknown>> {
  const resultArray = [];
  for (const [i, element] of constructorDef.entries()) {
    const elementContext = context.clone({ appendToPath: [i] });

    // If valueElement is a constructor with a _arrayMap property, get the array returned by _arrayMap and
    // loop over each element
    if (
      !Array.isArray(element) &&
      typeof element === "object" &&
      !(element instanceof Date) &&
      element !== null &&
      element._arrayMap
    ) {
      const { _arrayMap, ...constructorWithoutArrayMap } = element;
      const arrayMapContext = await executeAction(
        _arrayMap,
        elementContext.clone({ appendToPath: ["_arrayMap"] }),
      );
      let elementsToMap: unknown[];
      const data = arrayMapContext.get();
      if (Array.isArray(data)) {
        elementsToMap = data;
      } else if (data instanceof DomSelection) {
        elementsToMap = data.nodes;
      } else {
        throw handleExecutionError(
          new Error(
            `_arrayMap must return either an array or a DomSelection but instead returned:\n${data}`,
          ),
          arrayMapContext,
        );
      }
      for (const elementToMap of elementsToMap) {
        resultArray.push(
          executeConstructorObject(
            constructorWithoutArrayMap,
            elementContext.clone().set("", elementToMap),
          ),
        );
      }
    } else {
      resultArray.push(executeConstructor(element, elementContext));
    }
  }

  const awaitedReturnArray = await Promise.all(resultArray);
  // Remove any array elements who's value is the ExcludeField symbol
  return awaitedReturnArray.filter((element) => element !== excludeFieldMarker);
}

async function executeAction(
  action: Action,
  context: ActionContext,
): Promise<ActionContext> {
  log.push(`Executing action for ${formatObjectPath(context.path)}`);
  // Actions can be run in parallel and we don't want the execution of one action to modify the context
  // object and non-deterministically effect the execution of a different action
  let currentContext = context.clone();
  try {
    const result = await action(currentContext);
    if (result instanceof ActionContext) {
      // Needed for .chain() to be able to update context by returning cloned context
      currentContext = result;
      currentContext.recordResult(undefined);
    } else {
      currentContext.recordResult(result);
    }
    if (typeof currentContext.lastResult() !== "undefined") {
      currentContext.set("", currentContext.lastResult());
    }
    await currentContext.waitForAllPromisesToResolve();
  } catch (error) {
    handleExecutionError(error, currentContext);
  }
  return currentContext;
}

export async function executeActions(
  actions: Action[],
  context: ActionContext,
): Promise<ActionContext> {
  const parentPath = context.path.slice(0, -1);
  const lastPathSegment = context.path[context.path.length - 1];
  let currentContext = context;
  for (const [i, action] of actions.entries()) {
    currentContext = await executeAction(
      action,
      currentContext.clone({
        path: [...parentPath, `${lastPathSegment} (chain step ${i + 1})`],
      }),
    );
  }
  return currentContext;
}

function handleExecutionError(error: unknown, actionContext: ActionContext) {
  if (error instanceof ConstructorExecutionError) {
    throw error;
  }
  throw new ConstructorExecutionError({
    cause: error instanceof Error ? error : undefined,
    actionContext,
    log,
  });
}
