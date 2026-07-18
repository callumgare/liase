import assert from "node:assert";
import { createEnvoySession } from "@liase/envoy";
import { z } from "zod";
import { ActionContext } from "./ActionContext.js";
import { executeActions, executeConstructor } from "./constructorExecution.js";
import { FriendlyZodError, zodParseOrThrow } from "./lib/zod.js";
import type { GenericRequest } from "./schemas/request.js";
import type {
  RequestHandler,
  requestHandlerSchema,
} from "./schemas/requestHandler.js";
import {
  type GenericResponse,
  genericResponseSchema,
} from "./schemas/response.js";
import type { ConstructorExecutionContext } from "./types.js";

export async function generateResponse(
  constructorContext: ConstructorExecutionContext,
): Promise<GenericResponse> {
  // If the requestHandler's requestSchema sets any defaults add them to the request
  const resolvedContext = {
    ...constructorContext,
    request: requestWithDefaults(
      constructorContext.request,
      constructorContext.requestHandler.requestSchema,
    ),
  };
  Error.stackTraceLimit = 50;

  const envoySession = await createEnvoySession({
    cachedResponseStrategy: resolvedContext.cachedResponseStrategy,
  });

  try {
    const rootActionContext = new ActionContext({
      constructorContext: resolvedContext,
      executeActions,
      path: [],
      envoySession,
    });

    const res = await executeConstructor(
      resolvedContext.responseDetails.constructor,
      rootActionContext,
    );
    return await validateResponse(res, resolvedContext, rootActionContext);
  } finally {
    await envoySession.close();
  }
}

async function validateResponse(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic response object validated by zod
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
    if (media.liaseSource !== constructorContext.sourceId) {
      throw Error(
        `Request was for source ${constructorContext.sourceId} but media number ${index} ` +
          `has source set to ${media.liaseSource}`,
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
      throw Error(
        'Response has a page property but the request handler paginationType is "none"',
      );
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
      }
      return undefined;
    }
    return response;
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
    return requestSchema.parse(request) as GenericRequest;
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
