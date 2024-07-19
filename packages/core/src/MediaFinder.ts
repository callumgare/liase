import * as coreSources from "./sources/index.js";
import type { Source } from "@/src/schemas/source.js";
import type { Plugin } from "@/src/schemas/plugin.js";
import {
  finderOptionsSchema,
  FinderOptions,
  FinderOptionsInput,
} from "@/src/schemas/finderOptions.js";
import {
  RequestHandler,
  requestHandlerSchema,
} from "./schemas/requestHandler.js";
import { zodParseOrThrow } from "./utils.js";

export default class MediaFinder {
  protected sourceMap: { [sourceName: string]: Source } = {};
  get sources(): Source[] {
    return Object.values(this.sourceMap);
  }

  _finderOptions: FinderOptions;

  constructor(finderOptions: FinderOptionsInput = {}) {
    this._finderOptions = finderOptionsSchema.parse(finderOptions);
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
    if (Object.prototype.hasOwnProperty.call(this.sourceMap, source.id)) {
      console.warn(
        `Loading "${source.id}" but a source with the same id has already been loaded. The ` +
          `existing source will be overwritten.`,
      );
    }

    // Validate request handlers
    for (const requestHandler of source.requestHandlers) {
      const { paginationType, requestSchema, responses } = requestHandler;

      const errorMessage = `Could not load source "${source.id}" as the request handler "${requestHandler.id}" is invalid`;
      zodParseOrThrow(requestHandlerSchema, requestHandler, { errorMessage });

      const paginationInvalidRequestError = (
        issue: "missing" | "has",
        property: string,
      ) =>
        new Error(
          `Request handler "${requestHandler.id}" of source "${source.id}" has paginationType ` +
            `${paginationType} but ${
              issue === "missing" ? "is missing" : "includes"
            } ${property} ` +
            `in the request schema.`,
        );

      if (paginationType === "offset") {
        if (!requestSchema.shape.pageNumber) {
          throw paginationInvalidRequestError("missing", "pageNumber");
        }
        if (requestSchema.shape.cursor) {
          throw paginationInvalidRequestError("has", "cursor");
        }
      } else if (paginationType === "cursor") {
        if (!requestSchema.shape.cursor) {
          throw paginationInvalidRequestError("missing", "cursor");
        }
        if (requestSchema.shape.pageNumber) {
          throw paginationInvalidRequestError("has", "pageNumber");
        }
      } else if (paginationType === "none") {
        if (requestSchema.shape.pageNumber) {
          throw paginationInvalidRequestError("has", "pageNumber");
        }
        if (requestSchema.shape.cursor) {
          throw paginationInvalidRequestError("has", "cursor");
        }
      } else {
        throw new Error(
          `Request handler "${requestHandler.id}" of source "${source.id}" has unsupported paginationType ` +
            `${paginationType}`,
        );
      }

      const nonDefaultResponseDetails = responses.slice(0, -1);
      if (
        nonDefaultResponseDetails.some(
          (responseDetails) => !responseDetails.requestMatcher,
        )
      ) {
        throw Error(
          `Some response schema elements are missing "requestMatcher" field for request handler ` +
            `"${requestHandler.id}" of source "${source.id}". ("requestMatcher" is mandatory in all ` +
            `except the last response schema element.`,
        );
      }
    }

    this.sourceMap[source.id] = source;
  }

  getSource(sourceId: string): Source {
    const source = this.sourceMap[sourceId];
    if (!source) {
      throw new Error(
        `Attempted to query an unknown source. If "${sourceId}" is provided by a plugin please make sure that ` +
          `plugin is loaded first before attempting to query.`,
      );
    }
    return source;
  }

  getRequestHandler(sourceId: string, queryType: string): RequestHandler {
    const source = this.getSource(sourceId);
    const handler = source.requestHandlers.find(
      (handler) => handler.id === queryType,
    );
    if (!handler) {
      throw new Error(
        `The source "${sourceId}" does not provide a request handler for the query type "${queryType}".`,
      );
    }
    return handler;
  }

  getRequestSchema(sourceId: string, queryType: string) {
    return this.getRequestHandler(sourceId, queryType).requestSchema;
  }
}
