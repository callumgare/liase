import * as coreSources from "./sources/index.js";
import type { Capability, Source } from "@/types/sources.js";
import type { Plugin } from "@/types/plugins.js";

const defaultNumOfPagesToFetch = 10;

type Query = {
  [key: string]: any,
  source: string,
  iterateBy?: "page" | "media",
};

type Options = {
  plugins?: Array<Plugin>
}

class MediaFinder {
  #query?: Query;
  sources: { [sourceName: string]: Source };
  #iterator?: AsyncGenerator<any, void, unknown>;

  constructor(query?: Query, options?: Options) {
    this.sources = {};
    this.loadSources(Object.values(coreSources));
    options?.plugins?.forEach((plugin) => this.loadPlugin(plugin));
    if (query) {
      this.#query = query;
      this.#iterator = this.getIterator();
    }
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
    this.sources[source.name] = source;
  }

  get query(): Query | undefined {
    return this.#query;
  }

  set query(query: Query) {
    this.replaceQuery(query);
  }

  updateQuery(query: Partial<Query>) {
    if (!this.#query) {
      throw Error("Can not update query as none has yet been set")
    }
    const newQuery = Object.assign({}, this.#query, query);
    return this.replaceQuery(newQuery);
  }

  replaceQuery(query: Query) {
    this.rewind();
    this.#query = query;
  }

  async getNext() {
    if (!this.#iterator) {
      throw new Error("No query specified");
    }
    const next = await this.#iterator.next();
    if (next.done) {
      return null;
    }
    return next.value;
  }

  getSource(sourceName: string): Source {
    const source = this.sources[sourceName];
    if (!source) {
      throw new Error(
        `Attempted to query an unknown source. If "${sourceName}" is provided by a plugin please make sure that plugin is loaded first before attempting to query.`
      );
    }
    return source;
  }

  // A user call getNext() and then update the 'iterateBy' value in the query. To ensure this change occurs
  // when the next call getNext() we need to refresh the
  rewind(): void {
    this.#iterator = this.getIterator();
  }

  [Symbol.asyncIterator] = this.getIterator;

  getIterator() {
    if (!this.query) {
      throw new Error("No query specified");
    }
    if (!this.query?.source) {
      throw new Error("No source specified");
    }
    const source = this.getSource(this.query.source);
    const capability = this.findFirstMatchingCapability(source, this.query);
    if (!capability) {
      throw new Error(
        `No matching capability for ${JSON.stringify(this.query)}`
      );
    }
    if (capability.pagination) {
      let iterator;
      if (capability.pagination === "offset") {
        iterator = this.getPagesByNumber(this.query, capability);
      } else if (capability.pagination === "cursor") {
        iterator = this.getPagesByCursor(this.query, capability);
      } else {
        throw new Error(
          `Pagination type "${capability.pagination}" is not recognised`
        );
      }
      if (this.query.iterateBy === "media") {
        return (async function* () {
          for await (const page of iterator) {
            for (const media of page.items) {
              yield media;
            }
          }
        })();
      }
      return iterator;
    } else {
      const query = this.query
      return async function* () {
        yield capability.run(query);
      }.call(this);
    }
  }

  getReturnType() {
    if (!this.query) {
      throw new Error("No query specified");
    }
    const outputType = this.findFirstMatchingCapability(
      this.getSource(this.query.source),
      this.query
    )?.outputType;

    if (!outputType) {
      return null;
    }

    if (this.query.iterateBy === "media") {
      return outputType.shape.items.element;
    }

    return outputType;
  }

  findFirstMatchingCapability(source: Source, query: Query) {
    for (const capability of source.capabilities) {
      if (capability.inputType.safeParse(query).success) {
        return capability;
      }
    }
    return null;
  }

  async *getPagesByNumber(query: Query, capability: Capability) {
    let page = query.page || 1;
    const maxPageToFetch =
      page - 1 + (query.numOfPagesToFetch || defaultNumOfPagesToFetch);

    while (page <= maxPageToFetch) {
      const pageQuery = Object.assign({}, query, { page });
      const results = await capability.run(pageQuery);
      if (page === maxPageToFetch && results.hasNext) {
        results.hasNext = false;
        results.hasNextWithoutLimit = true;
      }

      yield results;

      if (!results.hasNext) {
        break;
      }

      page++;
    }
  }

  async *getPagesByCursor(query: Query, capability: Capability) {
    let cursor;
    let pageCount = 0;
    const maxPageToFetch = query.numOfPagesToFetch || defaultNumOfPagesToFetch;
    while (pageCount <= maxPageToFetch) {
      const pageQuery: Query = Object.assign({}, query, { cursor });
      const results = await capability.run(pageQuery);
      if (pageCount === maxPageToFetch && results.hasNext) {
        results.hasNext = false;
        results.hasNextWithoutLimit = true;
      }

      yield results;

      if (!results.hasNext) {
        break;
      }

      pageCount++;
      cursor = results.cursor;
    }
  }
}

export default function (query?: Query, options?: Options): MediaFinder {
  return new MediaFinder(query, options);
}
