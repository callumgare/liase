import * as coreSources from './sources/index.js'
import initSource from './initialiseSource.js'

const defaultNumOfPagesToFetch = 10

type Query = {
  iterateBy?: 'page' | 'media',
  [key: string]: any
}

class MediaFinder {
  #query: Query
  sources: Object
  #iterator

  constructor (query, options) {
    this.#query = query
    this.sources = {}
    this.loadSources(Object.values(coreSources))
    options.plugins?.forEach(plugin => this.loadPlugin(plugin))
    this.#iterator = this.getIterator()
  }

  loadSources (sources) {
    for (const source of sources) {
      this.loadSource(source)
    }
  }

  loadPlugin (plugin) {
    if (plugin.sources) {
      this.loadSources(plugin.sources)
    }
  }

  loadSource (source) {
    this.sources[source.name] = initSource(source)
  }

  get query (): Query {
    return this.#query
  }

  set query (query) {
    this.replaceQuery(query)
  }

  updateQuery (query: Query) {
    const newQuery = Object.assign({}, this.#query, query)
    return this.replaceQuery(newQuery)
  }

  replaceQuery (query: Query) {
    this.rewind()
    this.#query = query
  }

  async getNext () {
    const next = await this.#iterator.next()
    if (next.done) {
      return null
    }
    return next.value
  }

  getSource (sourceName) {
    const source = this.sources[sourceName]
    if (!source) {
      throw new Error(`Attempted to query an unknown source. If "${sourceName}" is provided by a plugin please make sure that plugin is loaded first before attempting to query.`)
    }
    return source
  }

  // A user call getNext() and then update the 'iterateBy' value in the query. To ensure this change occurs
  // when the next call getNext() we need to refresh the
  rewind (): void {
    this.#iterator = this.getIterator()
  }

  [Symbol.asyncIterator] = this.getIterator

  getIterator () {
    if (!this.query?.source) {
      throw new Error('No source specified')
    }
    const source = this.getSource(this.query.source)
    const capability = this.findFirstMatchingCapability(source, this.query)
    if (!capability) {
      throw new Error(`No matching capability for ${JSON.stringify(this.query)}`)
    }
    if (capability.pagination) {
      let iterator
      if (capability.pagination === 'number') {
        iterator = this.getPagesByNumber(this.query, capability)
      } else if (capability.pagination === 'cursor') {
        iterator = this.getPagesByCursor(this.query, capability)
      } else {
        throw new Error(`Pagination type "${capability.pagination}" is not recognised`)
      }
      if (this.#query.iterateBy === 'media') {
        return (async function * () {
          for await (const page of iterator) {
            for (const media of page.items) {
              yield media
            }
          }
        })()
      }
      return iterator
    } else {
      return (async function * () {
        yield capability.run(this.query)
      }.call(this))
    }
  }

  getReturnType () {
    const outputType = this.findFirstMatchingCapability(
      this.getSource(this.query.source),
      this.query
    )?.outputType

    if (!outputType) {
      return null
    }

    if (this.#query.iterateBy === 'media') {
      return outputType.shape.items.element
    }

    return outputType
  }

  findFirstMatchingCapability (source, query) {
    for (const capability of source.capabilities) {
      if (capability.inputType.safeParse(query).success) {
        return capability
      }
    }
    return null
  }

  async * getPagesByNumber (query, capability) {
    let page = query.page || 1
    const maxPageToFetch = (page - 1) + (query.numOfPagesToFetch || defaultNumOfPagesToFetch)

    while (page <= maxPageToFetch) {
      const pageQuery = Object.assign({}, query, { page })
      const results = await capability.run(pageQuery)
      if (page === maxPageToFetch && results.isNext) {
        results.isNext = false
        results.isNextWithoutLimit = true
      }

      yield results

      if (!results.isNext) {
        break
      }

      page++
    }
  }

  async * getPagesByCursor (query, capability) {
    let cursor
    let pageCount = 0
    const maxPageToFetch = query.numOfPagesToFetch || defaultNumOfPagesToFetch
    while (pageCount <= maxPageToFetch) {
      const pageQuery = Object.assign({}, query, { cursor })
      const results = await capability.run(pageQuery)
      if (pageCount === maxPageToFetch && results.isNext) {
        results.isNext = false
        results.isNextWithoutLimit = true
      }

      yield results

      if (!results.isNext) {
        break
      }

      pageCount++
      cursor = results.cursor
    }
  }
}

export default function (query, options = {}): MediaFinder {
  return new MediaFinder(query, options)
}
