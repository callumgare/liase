import { ActionContext, excludeFieldSymbol } from "./ActionContext.js";
import {
  Constructor,
  Action,
  ConstructorObject,
} from "./schemas/constructor.js";
import { DomSelection } from "./DomSelection.js";
import {
  ConstructorExecutionError,
  formatObjectPath,
  getType,
  waitForAllPropertiesToResolve,
} from "./lib/utils.js";
import { exportNetworkRequestsHistory } from "./lib/networkRequestsHistory.js";

const log: string[] = [];

export async function executeConstructor(
  constructor: Constructor,
  context: ActionContext,
): Promise<any> {
  try {
    if (
      !Array.isArray(constructor) &&
      typeof constructor === "object" &&
      !(constructor instanceof Date) &&
      constructor !== null
    ) {
      return executeConstructorObject(constructor, context);
    } else if (Array.isArray(constructor)) {
      return executeConstructorArray(constructor, context);
    } else if (typeof constructor === "function") {
      return executeAction(constructor, context)
        .then((context) => context.lastResult())
        .then((result) =>
          result instanceof DomSelection ? result.text : result,
        );
    } else {
      return constructor;
    }
  } catch (error) {
    handleExecutionError(error, context);
  }
}

export async function executeConstructorObject(
  constructor: ConstructorObject,
  context: ActionContext,
): Promise<any> {
  const topLevelPath = context.path;

  if (constructor._arrayMap) {
    handleExecutionError(
      new Error(
        `Constructor with "_arrayMap" used outside of an array context`,
      ),
      context.clone({ appendToPath: ["_arrayMap"] }),
    );
  }

  if (constructor._setup) {
    context = await executeAction(
      constructor._setup,
      context.clone({ path: [...topLevelPath, "_setup"] }),
    );
  }

  const returnObject: { [key: string]: any } = {};

  if (constructor._include) {
    const resultContext = await executeAction(
      constructor._include,
      context.clone({ path: [...topLevelPath, "_include"] }),
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
    context = context.clone({
      data: { ...resultContext.getAll(), "": context.get("") },
    });
  }

  const constructorReturnKeys = Object.fromEntries(
    Object.entries(constructor).filter(
      // Filter out constructor instruction keys
      ([key]) => !key.match(/^_[^_]/),
    ),
  );

  for (const key of Object.keys(constructorReturnKeys)) {
    const value = constructorReturnKeys[key];
    const newKey = key.replace(/^__/, "_"); // Unescape _ if starts with escaped _

    returnObject[newKey] = executeConstructor(
      value,
      context.clone({ path: [...topLevelPath, key] }),
    );
  }

  const awaitedReturnObject = await waitForAllPropertiesToResolve(returnObject);

  // Remove any fields/array elements who's value is the ExcludeField symbol
  for (const key of Object.keys(awaitedReturnObject)) {
    const value = awaitedReturnObject[key];
    if (value === excludeFieldSymbol) {
      delete awaitedReturnObject[key];
    }
  }

  return awaitedReturnObject;
}

export async function executeConstructorArray(
  constructor: Array<Constructor>,
  context: ActionContext,
): Promise<Array<any>> {
  const resultArray = [];
  for (const [i, element] of constructor.entries()) {
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
      let elementsToMap: any[];
      const data = arrayMapContext.get();
      if (Array.isArray(data)) {
        elementsToMap = data;
      } else if (data instanceof DomSelection) {
        elementsToMap = data.selectedNodes;
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
  return awaitedReturnArray.filter((element) => element !== excludeFieldSymbol);
}

async function executeAction(
  action: Action,
  context: ActionContext,
): Promise<ActionContext> {
  log.push(`Executing action for ${formatObjectPath(context.path)}`);
  // Actions can be run in parallel and we don't want the execution of one action to modify the context
  // object and non-deterministically effect the execution of a different action
  context = context.clone();
  try {
    const result = await action(context);
    if (result instanceof ActionContext) {
      // Needed for .chain() to be able to update context by returning cloned context
      context = result;
      context.recordResult(undefined);
    } else {
      context.recordResult(result);
    }
    if (typeof context.lastResult() !== "undefined") {
      context.set("", context.lastResult());
    }
    await context.waitForAllPromisesToResolve();
  } catch (error) {
    handleExecutionError(error, context);
  }
  return context;
}

export async function executeActions(
  actions: Action[],
  context: ActionContext,
): Promise<ActionContext> {
  const parentPath = context.path.slice(0, -1);
  const lastPathSegment = context.path[context.path.length - 1];
  for (const [i, action] of actions.entries()) {
    context = await executeAction(
      action,
      context.clone({
        path: [...parentPath, `${lastPathSegment} (chain step ${i + 1})`],
      }),
    );
  }
  return context;
}

function handleExecutionError(error: unknown, context: ActionContext) {
  if (error instanceof ConstructorExecutionError) {
    throw error;
  }
  exportNetworkRequestsHistory({
    networkRequestsHistory: context.networkRequestsHistory,
  });
  throw new ConstructorExecutionError({
    cause: error instanceof Error ? error : undefined,
    context,
    log,
  });
}
