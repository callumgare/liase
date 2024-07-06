import { ActionContext, excludeFieldSymbol } from "./ActionContext.js";
import {Constructor, Action, ConstructorObject} from "./schemas/constructor.js"
import { DomSelection } from "./DomSelection.js";
import { ConstructorExecutionError, formatObjectPath, getType, waitForAllPropertiesToResolve } from "./utils.js";

const log: string[] = []

export async function executeConstructor(
  constructor: Constructor,
  context: ActionContext,
  pathInContainingConstructor: (string | number)[] = []
): Promise<any> {
  try {
    if (!Array.isArray(constructor) && typeof constructor === "object" && !(constructor instanceof Date) && constructor !== null) {
      return executeConstructorObject(constructor, context, pathInContainingConstructor)

    } else if (Array.isArray(constructor)) {
      return executeConstructorArray(constructor, context, pathInContainingConstructor)

    } else if (typeof constructor === "function") {
      return executeAction(constructor, context, pathInContainingConstructor)
        .then(context => context.lastResult())
        .then(result => (result instanceof DomSelection) ? result.text : result)

    } else {
      return constructor
    }
  } catch(error) {
    handleExecutionError(error, context, pathInContainingConstructor)
  }
}


export async function executeConstructorObject(
  constructor: ConstructorObject,
  context: ActionContext,
  pathInContainingConstructor: (string | number)[] = []
): Promise<any> {
  if (constructor._arrayMap) {
    handleExecutionError(
      new Error(`Constuctor with "_arrayMap" used outside of an array context`),
      context,
      [...pathInContainingConstructor, "_arrayMap"]
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
        [...pathInContainingConstructor, "_include"],
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

    returnObject[newKey] = executeConstructor(value, context, [...pathInContainingConstructor, key])
  }



  const awaitedReturnObject = await waitForAllPropertiesToResolve(returnObject)

  // Remove any fields/array elements who's value is the ExcludeField symbol
  for (const key of Object.keys(awaitedReturnObject)) {
    const value = awaitedReturnObject[key]
    if (value === excludeFieldSymbol) {
      delete awaitedReturnObject[key]
    }
  }

  return awaitedReturnObject
}

export async function executeConstructorArray(
  constructor: Array<Constructor>,
  context: ActionContext,
  pathInContainingConstructor: (string | number)[] = []
): Promise<Array<any>> {
  const resultArray = []
  for(const [i, element] of constructor.entries()) {
    const arrayElementPathInContainingConstructor = [...pathInContainingConstructor, i]
    // If valueElement is a constructor with a _arrayMap property, get the array returned by _arrayMap and
    // loop over each element
    if (!Array.isArray(element) && typeof element === "object" && !(element instanceof Date) && element !== null && element._arrayMap) {
      const {_arrayMap, ...constructorWithoutArrayMap} = element
      context = await executeAction(_arrayMap, context, [...arrayElementPathInContainingConstructor, "_arrayMap"])
      let elementsToMap: any[]
      const data = context.get()
      if (Array.isArray(data)) {
        elementsToMap = data
      } else if (data instanceof DomSelection) {
        elementsToMap = data.selectedNodes
      } else {
        throw handleExecutionError(
          new Error(`_arrayMap must return either an array or a DomSelection but instead returned:\n${data}`),
          context,
          [...pathInContainingConstructor, "_arrayMap"]
        )
      }
      for (const elementToMap of elementsToMap) {
        resultArray.push(
          executeConstructorObject(
            constructorWithoutArrayMap,
            context.clone().set('', elementToMap),
            arrayElementPathInContainingConstructor
          )
        )
      }
    } else {
      resultArray.push(
        executeConstructor(element, context, arrayElementPathInContainingConstructor)
      )
    }
  }

  const awaitedReturnArray = await Promise.all(resultArray)
  // Remove any array elements who's value is the ExcludeField symbol
  return awaitedReturnArray.filter(element => element !== excludeFieldSymbol)
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
