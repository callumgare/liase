import { createEnvoySession } from "@liase/envoy";
import { copy } from "copy-anything";
import deepmerge from "deepmerge";
import { expect, test } from "vitest";
import { ActionContext } from "../ActionContext.js";
import { executeActions } from "../constructorExecution.js";
import { type GenericResponse, createLiaseQuery } from "../index.js";
import { getDuplicates, getOrdinal, hasNoDuplicates } from "../lib/utils.js";
import type { LiaseOptionsInput } from "../schemas/liaseOptions.js";
import type { QueryOptionsInput } from "../schemas/queryOptions.js";
import {
  type GenericRequest,
  genericRequestSchema,
} from "../schemas/request.js";
import type { RequestHandler } from "../schemas/requestHandler.js";
import { genericResponseSchema } from "../schemas/response.js";
import type { Source } from "../schemas/source.js";
import type { ConstructorExecutionContext } from "../types.js";
import { getSecrets } from "./secrets.js";

export async function createExampleActionContext(
  options: {
    request?: Partial<GenericRequest>;
  } = {},
) {
  const request = genericRequestSchema.parse({
    source: "example-source",
    queryType: "example-query",
    ...options.request,
  });

  const requestHandler = {
    id: request.queryType,
    displayName: "Example Request Handler",
    description: "Example request handler for constructor testing",
    requestSchema: genericRequestSchema,
    paginationType: "none",
    responses: [
      {
        description: "Example response details",
        schema: genericResponseSchema,
        constructor: {
          request: ($) => $.request,
          media: [],
        },
      },
    ],
  } as const satisfies RequestHandler;

  const constructorContext: ConstructorExecutionContext = {
    request,
    secrets: {},
    requestHandler,
    responseDetails: requestHandler.responses[0],
    sourceId: request.source,
    hooks: {
      loadUrl: [],
      getFetchClient: [],
    },
  };

  // Create a new envoy session with built-in history tracking
  const envoySession = await createEnvoySession();

  return new ActionContext({
    constructorContext,
    executeActions,
    path: [],
    envoySession,
  });
}

export function createBasicTestsForRequestHandlers<
  S extends Source,
  HandlerIds extends S["requestHandlers"][number]["id"],
  Query extends {
    request?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    checkResponse?: (
      // biome-ignore lint/suspicious/noExplicitAny: response shape varies by plugin/fixture
      response: any,
      other: { pageLoadNum: number; message: string },
      // biome-ignore lint/suspicious/noConfusingVoidType: callbacks can optionally return assertion count
    ) => void | number;
    checkAllResponses?: (
      // biome-ignore lint/suspicious/noExplicitAny: response shape varies by plugin/fixture
      response: any,
      other: { message: string },
      // biome-ignore lint/suspicious/noConfusingVoidType: callbacks can optionally return assertion count
    ) => void | number;
    before?: () => Promise<unknown>;
    numOfPagesToLoad?: number;
    numOfPagesToExpect?: number;
    queryOptions?: QueryOptionsInput;
    liaseOptions?: LiaseOptionsInput;
    duplicateMediaPossible?: boolean;
    timeout?: number;
    testName?: string;
    expectError?: string | RegExp;
    skip?: boolean | string;
  },
  Queries extends { [Key in HandlerIds]: Query | Query[] },
  QueriesShared extends Query,
>(options: { source: S; queries: Queries; queriesShared?: QueriesShared }) {
  const { source, queries, queriesShared } = options;
  for (const requestHandler of source.requestHandlers) {
    if (!(requestHandler.id in queries)) {
      throw Error(`No query provided for request handler ${requestHandler.id}`);
    }
    const handlerQueries = [queries[requestHandler.id as HandlerIds]].flat(1);
    for (const query of handlerQueries) {
      const requestPropsWithoutHandlerDetails = {
        ...query?.request,
        ...queriesShared?.request,
      };
      const request = {
        source: source.id,
        queryType: requestHandler.id,
        ...requestPropsWithoutHandlerDetails,
      };

      const timeout = query.timeout ?? queriesShared?.timeout;
      const formattedQuery = JSON.stringify(
        requestPropsWithoutHandlerDetails,
        null,
        2,
      ).replace(/\n\s*/g, " ");

      const testName =
        query.testName ??
        queriesShared?.testName ??
        `Run query "${requestHandler.displayName}" with: ${formattedQuery}`;
      const expectError = query.expectError ?? queriesShared?.expectError;
      const skip = query.skip ?? queriesShared?.skip;

      if (skip) {
        const message =
          typeof skip === "string"
            ? `SKIPPED: ${testName} — ${skip}`
            : `SKIPPED: ${testName}`;
        console.warn(message);
        test.skip(testName, () => {});
        continue;
      }

      test(
        testName,
        async () => {
          const beforeCallbacks = [query?.before, queriesShared?.before];

          for (const before of beforeCallbacks) {
            await before?.();
          }
          const numOfPagesToLoad = query.numOfPagesToLoad ?? 1;
          const numOfPagesToExpect =
            query.numOfPagesToExpect ?? numOfPagesToLoad;
          // biome-ignore lint/suspicious/noExplicitAny: type narrowing helper needs any for constructor check
          const isPlainObject = (value: any) =>
            value?.constructor === Object || Array.isArray(value);
          const deepMergeOptions = {
            isMergeableObject: isPlainObject,
          };
          const mediaQuery = await createLiaseQuery({
            request,
            queryOptions: deepmerge.all(
              [
                {
                  cacheNetworkRequests: "always",
                },
                queriesShared?.queryOptions || {},
                query?.queryOptions || {},
                {
                  secrets: {
                    ...(await getSecrets(request)),
                    ...queriesShared?.secrets,
                    ...query?.secrets,
                  },
                },
              ],
              deepMergeOptions,
            ),
            liaseOptions: deepmerge.all(
              [queriesShared?.liaseOptions || {}, query?.liaseOptions || {}],
              deepMergeOptions,
            ),
          });

          const responses: (GenericResponse | null)[] = [];
          let customResponseTestExpectedAssertions = 0;

          if (expectError) {
            expect.assertions(1);
            await expect(() => mediaQuery.getNext()).rejects.toSatisfy(
              (err) => {
                // Walk the cause chain so that wrapper errors (e.g. QueryError)
                // don't hide the underlying message we actually want to test.
                let current: unknown = err;
                while (current instanceof Error) {
                  if (
                    typeof expectError === "string"
                      ? current.message.includes(expectError)
                      : expectError.test(current.message)
                  ) {
                    return true;
                  }
                  current = current.cause;
                }
                return false;
              },
            );
            return;
          }

          for (let i = 0; i < numOfPagesToLoad; i++) {
            const response = await mediaQuery.getNext();
            responses.push(response);

            if (i + 1 < numOfPagesToExpect) {
              // If we're expecting more pages then isLastPage should not be "true"
              expect(
                response?.page?.isLastPage,
                `Expected to receive another response after ${getOrdinal(
                  i + 1,
                )} but page.isLastPage is set to "true"`,
              ).not.toBe(true);
            } else if (numOfPagesToExpect < numOfPagesToLoad) {
              // If this is the last expected page of content but we've explicitly requested to load more pages after this
              // assume that this is the last page and thus isLastPage should not be "false"
              expect(
                response?.page?.isLastPage,
                `Expected to not receive another response after ${getOrdinal(
                  i + 1,
                )} but page.isLastPage is set to "false"`,
              ).not.toBe(false);
            } else {
              // It's easy to calculate the number of expected assertions if we include this dummy assertion
              expect(true).toBe(true);
            }

            if (i < numOfPagesToExpect) {
              expect(
                response,
                `Expected a response for the ${getOrdinal(
                  i + 1,
                )} request but response was null`,
              ).not.toBe(null);
            } else {
              expect(
                response,
                `Expected null as the response for the ${getOrdinal(
                  i + 1,
                )} request`,
              ).toBe(null);
            }

            const customResponseChecks = [
              ...(query?.checkResponse ? [query?.checkResponse] : []),
              ...(queriesShared?.checkResponse
                ? [queriesShared?.checkResponse]
                : []),
            ];
            for (const checkResponse of customResponseChecks) {
              const result = checkResponse(response, {
                message: `The response for the ${getOrdinal(
                  i + 1,
                )} request was not what was expected`,
                pageLoadNum: i,
              });
              customResponseTestExpectedAssertions +=
                typeof result === "number" ? result : 1;
            }

            if (!query.duplicateMediaPossible) {
              const idsOfMedia = (response?.media || [])
                .filter((media) => media)
                .map((media) => media.id);

              expect(idsOfMedia).toSatisfy(
                hasNoDuplicates,
                `Media with the same ID appears in single response: ${getDuplicates(idsOfMedia).join(",")}`,
              );
            }
          }

          const customAllResponsesChecks = [
            ...(query?.checkAllResponses ? [query?.checkAllResponses] : []),
            ...(queriesShared?.checkAllResponses
              ? [queriesShared?.checkAllResponses]
              : []),
          ];
          for (const checkAllResponses of customAllResponsesChecks) {
            const result = checkAllResponses(responses, {
              message: "The responses were not as expected",
            });
            customResponseTestExpectedAssertions +=
              typeof result === "number" ? result : 1;
          }

          if (!query.duplicateMediaPossible) {
            const idsOfMedia = responses
              .flatMap(
                (response: GenericResponse | null) => response?.media || [],
              )
              .filter((media) => media)
              .map((media) => media.id);

            expect(idsOfMedia).toSatisfy(
              hasNoDuplicates,
              `Media with the same ID appears in multiple responses: ${getDuplicates(idsOfMedia).join(",")}`,
            );
          }

          expect.assertions(
            numOfPagesToLoad * 2 +
              (query.duplicateMediaPossible ? 0 : numOfPagesToLoad + 1) +
              customResponseTestExpectedAssertions,
          );
        },
        timeout,
      );
    }
  }
}

// Some values in a response may naturally change over time
// or be differ based on other factors like a client's ip.
// This can result in the tests failing due to a response
// not matching its snapshot even though this difference may
// not indicate any problem. To avoid this we first normalise
// any parts of a response which may naturally vary before we
// snapshot it.
export function normaliseResponse(response: GenericResponse) {
  const normaliseStableUrl = (value: string) => {
    const url = new URL(value);
    // Some providers include volatile CDN host numbers and tokenized path segments.
    // Keep only stable URL components so snapshots do not flap.
    const stableHostname = url.hostname.replace(/^media\d+\./, "media.");
    const stablePathname = url.pathname.replace(
      /\/v1\.[^/]+\/([^/]+\/[^/]+)$/,
      "/$1",
    );
    return `${url.protocol}//${stableHostname}${stablePathname}`;
  };

  const clonedResponse = copy(response);
  for (const media of clonedResponse.media || []) {
    if (media.url) {
      media.url = normaliseStableUrl(media.url);
    }

    for (const file of media?.files || []) {
      if (file.url) {
        file.url = normaliseStableUrl(file.url);
      }
    }
  }
  return clonedResponse;
}
