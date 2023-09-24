import { ZodError, z } from "zod";
import deepmerge from "deepmerge";
import { fromZodError } from 'zod-validation-error';

import MediaFinder from "./MediaFinder.js"
import { queryOptionsSchema, QueryOptions } from "@/src/schemas/queryOptions.js";
import { finderOptionsSchema } from "@/src/schemas/finderOptions.js";
import { genericRequestSchema, GenericRequest, GenericRequestInput } from "@/src/schemas/request.js"
import { genericResponseSchema, GenericResponse } from "@/src/schemas/response.js"
import { requestHandlerSchema } from "@/src/schemas/requestHandler.js";


const propsSchema = z.object({
  request: genericRequestSchema,
  queryOptions: queryOptionsSchema.default({}),
  finderOptions: finderOptionsSchema.default({}),
}).strict()
export type MediaFinderQueryProps = z.input<typeof propsSchema>

export default class MediaFinderQuery extends MediaFinder {
  #request: GenericRequest;
  #queryOptions: QueryOptions;
  #iterator: AsyncIterator<GenericResponse>;

  constructor(props: MediaFinderQueryProps) {
    let parsedProps
    try {
      parsedProps = propsSchema.parse(props)
    } catch (err) {
      if (err instanceof ZodError) {
        console.log("MediaFinderQueryProps:", props)
        throw Error(fromZodError(err, {prefix: "MediaFinder argument invalid"}).message);
      }
      throw err
    }
    super(parsedProps.finderOptions)
    this.#request = parsedProps.request;
    this.#queryOptions = parsedProps.queryOptions
    this.#iterator = this.getIterator();
  }

  get request(): GenericRequest {
    return {...this.#request};
  }

  set request(request: GenericRequestInput) {
    this.changeRequest(request);
  }

  changeRequest(request: GenericRequestInput) {
    this.rewind();
    this.#request = genericRequestSchema.parse(request);
  }

  async getNext(): Promise<GenericResponse | null> {
    const next = await this.#iterator.next();
    if (next.done) {
      return null;
    }
    return next.value;
  }

  rewind(): void {
    this.#iterator = this.getIterator();
  }

  [Symbol.asyncIterator] = this.getIterator;

  async *getIterator(): AsyncIterator<GenericResponse> {
    const handler = this.getRequestHandler()
    const handlerRequestSchema = this.getRequestSchema()
    const handlerSecretsSchema = handler.secretsSchema

    try {
      handlerRequestSchema.parse(this.#request)
    } catch (err) {
      if (err instanceof ZodError) {
        console.info("Request:", this.#request)
        throw Error(fromZodError(err, {prefix: "Request is invalid"}).message);
      }
      throw err
    }

    try {
      if (handlerSecretsSchema) {
        handlerSecretsSchema.parse(this.#queryOptions.secrets)
      }
    } catch (err) {
      if (err instanceof ZodError) {
        throw Error(fromZodError(err, {prefix: "Secrets are invalid"}).message);
      }
      throw err
    }

    const validateResponse = (
      responseFromHandler: GenericResponse,
      sourceIndependentReponseDetails: Record<string, unknown>,
    ): GenericResponse => {
      const handlerResponseSchema = handler.responseSchema
    
      let response = deepmerge<GenericResponse>(responseFromHandler, sourceIndependentReponseDetails)
    
      try {
        handlerResponseSchema.parse(response)
      } catch (err) {
        if (err instanceof ZodError) {
          console.info("Response:", response)
          throw Error(fromZodError(err, {prefix: "Response does not match expected result"}).message);
        }
        throw err
      }
    
      try {
        response = genericResponseSchema.parse(response)
      } catch (err) {
        if (err instanceof ZodError) {
          console.info("Response:", response)
          console.info("Media:", response.media?.[0])
          throw Error(fromZodError(err, {prefix: "Response is invalid"}).message);
        }
        throw err
      }
    
      for (const [index, media] of Object.entries(response.media)) {
        if (media.source !== this.#request.source) {
          throw Error(`Request was for source ${this.#request.source} but media number ${index} has source set to ${media.source}`)
        }
      }
    
      return response
    }

    if (handler.paginationType === "none") {
      yield handler.run({request: this.#request, secrets: this.#queryOptions.secrets})
        .then(result => validateResponse(result, {request: this.request}))
    } else {
      let pageFetchedCount = 0;
      const maxPagesToFetch = this.#queryOptions.fetchCountLimit;
      while (pageFetchedCount < maxPagesToFetch) {
        pageFetchedCount++
        const response = validateResponse(
          await handler.run({request: this.#request, secrets: this.#queryOptions.secrets}),
          {
            page: {
              fetchCountLimitHit: pageFetchedCount === maxPagesToFetch
            },
            request: this.request
          },
        )
        if (!response.page) {
          throw Error(`Request was for a ${handler.paginationType} page but response was not a page`)
        }
        if (handler.paginationType !== response.page.paginationType) {
          throw Error(`Request was for a ${handler.paginationType} page but response page type was ${response.page.paginationType}`)
        }
        if (response.page.paginationType === "offset") {
          delete this.#request.cursor
          this.#request.pageNumber = response.page.pageNumber + 1

        } else if (handler.paginationType === "cursor") {
          delete this.#request.pageNumber
          this.#request.cursor = response.page.nextCursor
        }

        yield response;

        if ('isLastPage' in response && response.isLastPage) {
          break;
        }
      }
    }
  }

  getRequestHandler() {
    return super.getRequestHandler(this.#request.source, this.#request.queryType)
  }

  getRequestSchema(): z.infer<typeof requestHandlerSchema.shape.requestSchema> {
    return super.getRequestSchema(this.#request.source, this.#request.queryType)
  }

  getResponseSchema(): z.infer<typeof requestHandlerSchema.shape.responseSchema> {
    return super.getResponseSchema(this.#request.source, this.#request.queryType)
  }
}