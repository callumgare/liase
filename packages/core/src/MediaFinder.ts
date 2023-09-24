import { z } from "zod";

import * as coreSources from "./sources/index.js";
import type { Source } from "@/src/schemas/source.js";
import type { Plugin } from "@/src/schemas/plugin.js";
import { finderOptionsSchema, FinderOptions, FinderOptionsInput } from "@/src/schemas/finderOptions.js";
import { RequestHandler } from "./schemas/requestHandler.js";

export default class MediaFinder {
  sources: { [sourceName: string]: Source } = {};
  _finderOptions: FinderOptions;

  constructor(finderOptions: FinderOptionsInput = {}) {
    this._finderOptions = finderOptionsSchema.parse(finderOptions)
    this.loadSources(Object.values(coreSources));
    this._finderOptions.plugins.forEach((plugin) => this.loadPlugin(plugin));
  }

  loadSources(sources: Source[]) {
    for (const source of sources) {
      this.loadSource(source);
    }
  }

  loadPlugin(plugin: Plugin) {
    if (plugin.sources) {
      this.loadSources(plugin.sources);
    }
  }

  loadSource(source: Source) {
    if (Object.prototype.hasOwnProperty.call(this.sources, source.name)) {
      console.warn(
        `Loading "${source.name}" but a source with the same name has already been loaded. It will be overwritten.`
      );
    }

    // Add source independant properties to handler request and response schema
    const requestHandlers = source.requestHandlers.map(requestHandler => {
      try {
        const requestSchema = requestHandler.requestSchema.extend({
          source: z.string(),
          queryType: z.string(),
        })

        if (requestHandler.paginationType === "offset" && !requestSchema.shape.pageNumber) {
          throw Error(
            `Request handler "${requestHandler.name}" of source "${source.name}" has paginationType ` +
              `${requestHandler.paginationType} but no pageNumber property in the request schema.`
          )
        } else if (requestHandler.paginationType === "cursor" && !requestSchema.shape.cursor) {
          throw Error(
            `Request handler "${requestHandler.name}" of source "${source.name}" has paginationType ` +
              `${requestHandler.paginationType} but no cursor property in the request schema.`
          )
        }

        let responseSchema: z.AnyZodObject = requestHandler.responseSchema.extend({
          request: requestSchema
        })
        if (requestHandler.paginationType !== "none" ) {
          const pageSchema = responseSchema.shape.page
          if (!pageSchema) {
            throw Error(
              `Request handler "${requestHandler.name}" of source "${source.name}" has paginationType ` +
                `${requestHandler.paginationType} but no page property in the response schema.`
            )
          }
          responseSchema = responseSchema.extend({
            page: responseSchema.shape.page.extend({
              fetchCountLimitHit: z.boolean()
            })
          })
        }
        return {
          ...requestHandler,
          requestSchema,
          responseSchema,
        }
      } catch(error) {
        console.error(error)
        throw Error(`Error occured when loading request handler "${requestHandler.name}" of source "${source.name}"`)
      }
    })

    this.sources[source.name] = {
      ...source,
      requestHandlers
    }
  }

  getSource(sourceName: string): Source {
    const source = this.sources[sourceName];
    if (!source) {
      throw new Error(
        `Attempted to query an unknown source. If "${sourceName}" is provided by a plugin please make sure that ` +
          `plugin is loaded first before attempting to query.`
      );
    }
    return source;
  }

  getRequestHandler(sourceName: string, queryType: string): RequestHandler {
    const source = this.getSource(sourceName);
    const handler = source.requestHandlers.find(handler => handler.name === queryType)
    if (!handler) {
      throw new Error(
        `The source "${sourceName}" does not provide a request handler for the query type "${queryType}".`
      );
    }
    return handler
  }

  getRequestSchema(sourceName: string, queryType: string): InstanceType<typeof z.ZodObject> {
    return this.getRequestHandler(sourceName, queryType).requestSchema
  }

  getResponseSchema(sourceName: string, queryType: string): InstanceType<typeof z.ZodObject> {
    return this.getRequestHandler(sourceName, queryType).responseSchema
  }
}