import { Source } from '@/src/schemas/source.js'
import { expect, test, inject } from 'vitest'
import { GenericResponse, createMediaFinderQuery } from "@/src/index.js";
import { FinderOptionsInput } from '@/src/schemas/finderOptions.js';
import { getOrdinal, hasNoDuplicates } from '@/src/utils.js';
import { QueryOptionsInput } from '@/src/schemas/queryOptions.js';
import deepmerge from "deepmerge"


export function createBasicTestsForRequestHandlers<
  S extends Source,
  HandlerIds extends S["requestHandlers"][number]["id"],
  Query extends {
    request?: Record<string, any>,
    secrets?: Record<string, any>,
    checkResponse?: (response: any, other: {pageLoadNum: number, message: string}) => void | number,
    numOfPagesToLoad?: number,
    numOfPagesToExpect?: number,
    queryOptions?: QueryOptionsInput,
    finderOptions?: FinderOptionsInput,
    duplicateMediaPossible?: boolean
  },
  Queries extends {[Key in HandlerIds]: Query},
  QueriesShared extends Query,
>(options: {source: S, queries: Queries, queriesShared?: QueriesShared}) {
  const {source, queries, queriesShared} = options
  for (const requestHandler of source.requestHandlers) {
    test(`Can successfully get response from request handler "${requestHandler.id}" of source "${source.id}"`, async () => {
      if (!(requestHandler.id in queries)) {
        throw Error(`No query provided for request handler ${requestHandler.id}`)
      }
      const query = queries[requestHandler.id as HandlerIds]
      const numOfPagesToLoad = (query.numOfPagesToLoad ?? 1)
      const numOfPagesToExpect = (query.numOfPagesToExpect ?? numOfPagesToLoad)
      const isPlainObject = (value: any) => value?.constructor === Object;
      const deepMergeOptions = {
        isMergeableObject: isPlainObject
      }
      const mediaQuery = await createMediaFinderQuery({
        request: {
          source: source.id,
          queryType: requestHandler.id,
          ...query?.request,
          ...queriesShared?.request,
        },
        queryOptions: deepmerge.all([
          queriesShared?.queryOptions || {},
          query?.queryOptions || {},
          {cachingProxyPort: inject('cachingProxyPort')},
          {
            secrets: {
              ...queriesShared?.secrets,
              ...query?.secrets,
            }
          }
        ], deepMergeOptions),
        finderOptions: deepmerge(
          queriesShared?.finderOptions || {},
          query?.finderOptions || {},
          deepMergeOptions
        ),
      })

      const responses: any[] = []
      let customResponseTestExpectedAssertions = 0


      for (let i = 0; i < numOfPagesToLoad; i++) {
        const response = await mediaQuery.getNext();
        responses.push(response)

        if (i < numOfPagesToExpect) {
          expect(response, `Expected a response for the ${getOrdinal(i+1)} request but response was null`).not.toBe(null)
        } else {
          expect(response, `Expected null as the response for the ${getOrdinal(i+1)} request`).toBe(null)
        }

        if ('checkResponse' in query) {
          const result = query.checkResponse?.(response, {
            message: `The response for the ${getOrdinal(i+1)} request was not what was expected`,
            pageLoadNum: i
          })
          customResponseTestExpectedAssertions += typeof result === "number" ? result : 1
        }
      }

      if (!query.duplicateMediaPossible) {
        const idsOfMedia = responses.map((response: GenericResponse | null) => response?.media || [])
          .flat()
          .filter(media => media)
          .map((media: any) => media.id)

        expect(idsOfMedia).toSatisfy(hasNoDuplicates, "Media with the same ID appears in multiple responses")
      }
      expect.assertions(
        numOfPagesToLoad + (query.duplicateMediaPossible ? 0 : 1) + customResponseTestExpectedAssertions
      );
    })
  }
}
