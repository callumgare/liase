import { ActionContext, excludeFieldSymbol } from "./ActionContext.js";
import {Constructor, Action} from "./schemas/constructor.js"
import { DomSelection } from "./DomSelection.js";
import { ConstructorExecutionError, formatObjectPath, getType, waitForAllPropertiesToResolve } from "./utils.js";

const log: string[] = []

export async function executeConstructor(
  constructor: Constructor,
  context: ActionContext,
  pathInContainingConstructor: (string | number)[] = []
): Promise<any> {
  const {_arrayMap, ...constructorWithoutArrayMap} = constructor
  if (_arrayMap) {
    context = await executeAction(_arrayMap, context, [...pathInContainingConstructor, "_arrayMap"])
    let elementsToMap: any[]
    const data = context.get()
    if (Array.isArray(data)) {
      elementsToMap = data
    } else if (data instanceof DomSelection) {
      elementsToMap = data.selectedNodes
    } else {
      throw Error(`_arrayMap must return either an array or a DomSelection but instead returned:\n${data}`)
    }

    return Promise.all(
      elementsToMap.map((data, i) =>
        executeConstructor(constructorWithoutArrayMap, context.clone().set('', data), [...pathInContainingConstructor, i])
          .catch(error => handleExecutionError(error, context, [...pathInContainingConstructor, i]))
      )
    )
  }

  if (constructor._setup) {
    context = await executeAction(constructor._setup, context, [...pathInContainingConstructor, "_setup"])
  }

  const returnObject: {[key: string]: any} = {}

  if (constructor._include) {
    const resultContext = await executeAction(constructor._include, context, [...pathInContainingConstructor, "_include"])
    const resultValue = resultContext.get('')

    if (resultValue.constructor !== Object) {
      throw handleExecutionError(
        Error(`_include must return a plain object but instead received: ${getType(resultValue)}`),
        context,
        pathInContainingConstructor,
      )
    }

    Object.assign(returnObject, resultValue)

    // We don't want _include to override any value _setup has written to $.get('') but we do
    // want to keep any values it has written to other non-'' keys.
    const contextState = resultContext.getAll()
    if ('' in contextState) {
      delete contextState['']
    }
    if (context.has('')) {
      contextState[''] = context.get('')
    }

    context = context.clone({
      data: contextState
    })
  }

  const constructorReturnKeys = Object.fromEntries(
    Object.entries(constructor).filter(
      // Filter out constructor instruction keys
      ([key]) => !key.match(/^_[^_]/)
    )
  )

  for (const key of Object.keys(constructorReturnKeys)) {
    const value = constructorReturnKeys[key]
    const newKey = key.replace(/^__/, "_") // Unescape _ if starts with escaped _

    // Value may or may not be an array so it's easier to normalise to an array, process each
    // element, then return the whole array if it was originally an array or just the first element
    // if was originally a non-array value.
    const valueAsAnArray = [value].flat(1)

    const valueAsAnArrayOfPromises = valueAsAnArray.map((valueElement, i) => {
      // For we only care about recording the index if the value is actually an array
      // rather than a non-array that we normalised to an array earlier
      const newPathInContainingConstructor = Array.isArray(value)
        ? [...pathInContainingConstructor, newKey, i]
        : [...pathInContainingConstructor, newKey]

      if (typeof valueElement === "object" && !(valueElement instanceof Date) && valueElement !== null) {
        return executeConstructor(valueElement, context, newPathInContainingConstructor)
          .catch(error => handleExecutionError(error, context, newPathInContainingConstructor))
      } else if (typeof valueElement === "function") {
        return executeAction(valueElement, context, newPathInContainingConstructor)
          .then(context => context.lastResult())
          .then(result => (result instanceof DomSelection) ? result.text : result)
          .catch(error => handleExecutionError(error, context, newPathInContainingConstructor))
      } else {
        // We return valueElement wrapped in a promise to match all the other cases above which
        // return a promise. By having all returns be promises we can later use Promise.all() to
        // resolve all elements.
        return Promise.resolve(valueElement)
      }
    })

    if (Array.isArray(value)) {
      returnObject[newKey] = Promise.all(valueAsAnArrayOfPromises)
    } else {
      returnObject[newKey] = valueAsAnArrayOfPromises[0]
    }
  }

  const awaitedReturnObject = await waitForAllPropertiesToResolve(returnObject)

  // Remove any fields/array elements who's value is the ExcludeField symbol
  for (const key of Object.keys(awaitedReturnObject)) {
    const value = awaitedReturnObject[key]
    if (Array.isArray(value)) {
      awaitedReturnObject[key] = value.filter(element => element !== excludeFieldSymbol)
    } else if (value === excludeFieldSymbol) {
      delete awaitedReturnObject[key]
    }
  }

  return awaitedReturnObject
}

async function executeAction(action: Action, context: ActionContext, pathInContainingConstructor: (string | number)[]): Promise<ActionContext> {
  log.push(`Executing action for ${formatObjectPath(pathInContainingConstructor)}`)
  // Actions can be run in parallel and we don't want the execution of one action to modify the context
  // object and non-deterministically effect the execution of a different action
  context = context.clone({path: pathInContainingConstructor})
  try {
    const result = await action(context)
    if (result instanceof ActionContext) { // Needed for .chain() to be able to update context by returning cloned context
      context = result
      context.recordResult(undefined)
    } else {
      context.recordResult(result)
    }
    if (typeof context.lastResult() !== "undefined") {
      context.set('', context.lastResult())
    }
    await context.waitForAllPromisesToResolve()
  } catch(error) {
    handleExecutionError(error, context, pathInContainingConstructor)
  }
  return context
}

export async function executeActions(actions: Action[], context: ActionContext, path: (string | number)[]): Promise<ActionContext> {
  const parentPath = path.slice(0, -1)
  const lastPathSegment = path[path.length - 1]
  for (const [i, action] of actions.entries()) {
    context = await executeAction(action, context, [...parentPath, `${lastPathSegment} (chain step ${i + 1})`])
  }
  return context
}

function handleExecutionError(error: unknown, context: ActionContext, pathInContainingConstructor: (string | number)[]) {
  if (error instanceof ConstructorExecutionError) {
    throw error
  }
  throw new ConstructorExecutionError({
    cause: (error instanceof Error) ? error : undefined,
    errorOccurredAtPath: pathInContainingConstructor,
    context,
    log
  })
}
