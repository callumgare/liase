import { ActionContext } from "./ActionContext.js";
import {Constructor, Action} from "./schemas/constructor.js"
import { DomSelection } from "./DomSelection.js";
import { ConstructorExecutionError, formatObjectPath } from "./utils.js";

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

  const constructorReturnKeys = Object.fromEntries(
    Object.entries(constructor).filter(
      // Filter out constructor instruction keys
      ([key]) => !key.match(/^_[^_]/)
    )
  )
  const returnObject: {[key: string]: any} = {}

  for (const key of Object.keys(constructorReturnKeys)) {
    const value = constructorReturnKeys[key]
    const newKey = key.replace(/^__/, "_") // Unescape _ if starts with escaped _

    if (Array.isArray(value)) {
      returnObject[newKey] = Promise.all(
        value.map((constructor, i) =>
          executeConstructor(constructor, context, [...pathInContainingConstructor, newKey, i])
            .catch(error => handleExecutionError(error, context, [...pathInContainingConstructor, newKey, i]))
        )
      )
    } else if (typeof value === "object" && !(value instanceof Date) && value !== null) {
      returnObject[newKey] = executeConstructor(value, context, [...pathInContainingConstructor, newKey])
        .catch(error => handleExecutionError(error, context, [...pathInContainingConstructor, newKey]))
    } else if (typeof value === "function") {
      returnObject[newKey] = executeAction(value, context, [...pathInContainingConstructor, newKey])
        .then(context => context.lastResult())
        .then(result => (result instanceof DomSelection) ? result.text : result)
        .catch(error => handleExecutionError(error, context, [...pathInContainingConstructor, newKey]))
    } else {
      // We return value wrapped in a promise to match all the other cases above which
      // return a promise. By having all returns be promises it's easier later on to
      // go though and resolve all at once.
      returnObject[newKey] = Promise.resolve(value)
    }
  }

  return Promise.all(
    Object.entries(returnObject)
      // Return value of returnObject prop which is a promise so that
      // Promise.all() can wait on it, but add a .then() to promise to
      // make the promise actually return the entry of returnObject prop
      // so that we can reassemble it back into an object using Object.fromEntry()
      // after all promises have resolved
      .map( entry => entry[1].then((value: any) => ([entry[0],value])) )
  ).then(entries => Object.fromEntries(entries))
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
