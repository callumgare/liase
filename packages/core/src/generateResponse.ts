
import assert from "node:assert";
import { GenericResponse, genericResponseSchema } from "./schemas/response.js";
import { executeConstructor, executeActions } from "./constructorExecution.js";
import { ConstructorExecutionError, FriendlyZodError, zodParseOrThrow } from "./utils.js";
import { ConstructorExecutionContext } from "./types.js";
import { ActionContext } from "./ActionContext.js";
import { GenericRequest } from "./schemas/request.js";
import { RequestHandler, requestHandlerSchema } from "./schemas/requestHandler.js";
import { z } from "zod";


export async function generateResponse(constructorContext: ConstructorExecutionContext): Promise<GenericResponse> {
  // If the requestHandler's requestSchema sets any defaults add them to the request
  constructorContext = {
    ...constructorContext,
    request: requestWithDefaults(constructorContext.request, constructorContext.requestHandler.requestSchema)
  }
  const actionContext = new ActionContext({constructorContext, executeActions, path: []})
  let res
  try {
    res = await executeConstructor(constructorContext.requestHandler.responseConstructor, actionContext)
  } catch(error) {
    if (error instanceof ConstructorExecutionError) {
      console.error(error.getFormattedErrorInfo())
      process.exit(1)
    } else {
      throw error
    }
  }
  return validateResponse(res, constructorContext)
}

function validateResponse(
  response: any,
  context: ConstructorExecutionContext
): GenericResponse {
  const errorMessage = `The response returned from the request handler "${context.requestHandler.id}" of the source "${context.sourceId}" is invalid`
  const parsedResponse = zodParseOrThrow(genericResponseSchema, response, {errorMessage})
  zodParseOrThrow(context.responseSchema, response, {errorMessage})

  assert.deepEqual(context.request, parsedResponse.request)

  for (const [index, media] of Object.entries(parsedResponse.media)) {
    if (media.mediaFinderSource !== context.sourceId) {
      throw Error(
        `Request was for source ${context.sourceId} but media number ${index} ` +
        `has source set to ${media.mediaFinderSource}`
      )
    }
  }

  if (context.requestHandler.paginationType !== "none") {
    if (!parsedResponse.page) {
      throw Error(`Request was for a ${context.requestHandler.paginationType} page but response has no page`)
    }

    if (context.requestHandler.paginationType !== parsedResponse.page?.paginationType) {
      throw Error(`Request was for a ${context.requestHandler.paginationType} page but response page type was ${parsedResponse.page.paginationType}`)
    }

    assert.equal(context.pageFetchLimitReached, parsedResponse.page.pageFetchLimitReached)
  } else {
    if (parsedResponse.page) {
      throw Error(`has page`)
    }
  }

  return parsedResponse
}

export function getResponseSchemaBasedOnRequest(
  responseSchemaOrResponseSchemaArray: RequestHandler['responseSchema'],
  request: GenericRequest,
) {
  let responseSchema
  if (Array.isArray(responseSchemaOrResponseSchemaArray)) {
    for (const responseSchemaDetails of responseSchemaOrResponseSchemaArray) {
      if (responseSchemaDetails.requestMatcher) {
        const {success} = responseSchemaDetails.requestMatcher.safeParse(request)
        if (success) {
          responseSchema = responseSchemaDetails.schema
          break
        }
      } else {
        responseSchema = responseSchemaDetails.schema
      }
    }
  } else {
    responseSchema = responseSchemaOrResponseSchemaArray
  }
  if (!responseSchema) {
    throw Error("Could not find matching response schema")
  }
  return responseSchema
}

export function requestWithDefaults(
  request: GenericRequest,
  requestSchema: z.infer<typeof requestHandlerSchema.shape.requestSchema>
): GenericRequest {
  try {
    return requestSchema.parse(request)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new FriendlyZodError(err, {message: "Request is invalid", inputData: request})
      console.error(error.formattedErrorInfo)
      process.exit(1)
    }
    throw err
  }
}
