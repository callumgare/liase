import assert from "node:assert";
import { GenericResponse, genericResponseSchema } from "./schemas/response.js";
import { executeConstructor, executeActions } from "./constructorExecution.js";
import { FriendlyZodError, zodParseOrThrow } from "./lib/zod.js";
import { ConstructorExecutionContext } from "./types.js";
import { ActionContext } from "./ActionContext.js";
import { GenericRequest } from "./schemas/request.js";
import {
  RequestHandler,
  requestHandlerSchema,
} from "./schemas/requestHandler.js";
import { z } from "zod";

export async function generateResponse(
  constructorContext: ConstructorExecutionContext,
): Promise<GenericResponse> {
  // If the requestHandler's requestSchema sets any defaults add them to the request
  constructorContext = {
    ...constructorContext,
    request: requestWithDefaults(
      constructorContext.request,
      constructorContext.requestHandler.requestSchema,
    ),
  };
  Error.stackTraceLimit = 50;
  const rootActionContext = new ActionContext({
    constructorContext,
    executeActions,
    path: [],
  });
  const res = await executeConstructor(
    constructorContext.responseDetails.constructor,
    rootActionContext,
  );
  return await validateResponse(res, constructorContext, rootActionContext);
}

async function validateResponse(
  response: any,
  constructorContext: ConstructorExecutionContext,
  rootActionContext: ActionContext,
): Promise<GenericResponse> {
  const errorMessage = `The response returned from the request handler "${constructorContext.requestHandler.id}" of the source "${constructorContext.sourceId}" is invalid`;
  const parsedResponse = zodParseOrThrow(genericResponseSchema, response, {
    errorMessage,
    context: rootActionContext,
  });
  zodParseOrThrow(constructorContext.responseDetails.schema, response, {
    errorMessage,
    context: rootActionContext,
  });

  assert.deepEqual(constructorContext.request, parsedResponse.request);

  for (const [index, media] of Object.entries(parsedResponse.media)) {
    if (media.mediaFinderSource !== constructorContext.sourceId) {
      throw Error(
        `Request was for source ${constructorContext.sourceId} but media number ${index} ` +
          `has source set to ${media.mediaFinderSource}`,
      );
    }
  }

  if (constructorContext.requestHandler.paginationType !== "none") {
    if (!parsedResponse.page) {
      throw Error(
        `Request was for a ${constructorContext.requestHandler.paginationType} page but response has no page`,
      );
    }

    if (
      constructorContext.requestHandler.paginationType !==
      parsedResponse.page?.paginationType
    ) {
      throw Error(
        `Request was for a ${constructorContext.requestHandler.paginationType} page but response page type was ${parsedResponse.page.paginationType}`,
      );
    }

    assert.equal(
      constructorContext.pageFetchLimitReached,
      parsedResponse.page.pageFetchLimitReached,
    );
  } else {
    if (parsedResponse.page) {
      throw Error(`has page`);
    }
  }

  return parsedResponse;
}

export function getResponseDetailsBasedOnRequest(
  responses: RequestHandler["responses"],
  request: GenericRequest,
) {
  const response = responses.find((response) => {
    if (response.requestMatcher) {
      const { success } = response.requestMatcher.safeParse(request);
      if (success) {
        return response;
      } else {
        return undefined;
      }
    } else {
      return response;
    }
  });
  if (!response) {
    throw Error("Could not find matching response details");
  }
  return response;
}

export function requestWithDefaults(
  request: GenericRequest,
  requestSchema: z.infer<typeof requestHandlerSchema.shape.requestSchema>,
): GenericRequest {
  try {
    return requestSchema.parse(request);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new FriendlyZodError(err, {
        message: "Request is invalid",
        inputData: request,
      });
      throw error;
    }
    throw err;
  }
}
