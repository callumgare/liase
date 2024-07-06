import { AnyNode, Cheerio, CheerioAPI } from "cheerio"

export abstract class DomSelection {
  // eslint-disable-next-line no-use-before-define -- We have to use DomSelection before it's defined because it's recursive
  abstract select: (selector: string) => DomSelection
  abstract attr: (attr: string) => string | undefined
  abstract exists: (selector: string) => boolean
  abstract get text(): string | Promise<string>
  abstract get nativeSelector(): Cheerio<AnyNode>
  abstract get selectedNodes(): DomSelection[]
  abstract get firstJsonLd(): Record<string, any>
  abstract get jsonLd(): Array<Record<string, any>>
}

export class CheerioDomSelection extends DomSelection {
  #nativeSelector
  #cachedJsonLdArray: Array<Record<string, any>> | undefined
  #$: CheerioAPI

  constructor(cheerioAPI: CheerioAPI, cheerioNode?: Cheerio<AnyNode>) {
    super()
    this.#nativeSelector = cheerioNode ?? cheerioAPI.root()
    this.#$ = cheerioAPI
  }

  select = (selector: string) => new CheerioDomSelection(this.#$, this.nativeSelector.find(selector))
  attr = (attr: string) => this.#nativeSelector.attr(attr)
  exists = (selector: string) => Boolean(this.#nativeSelector.find(selector).length)

  get nativeSelector() {
    return this.#nativeSelector
  }

  get text () {
    return this.#nativeSelector.text()
  }

  map(mapFunction: (node: CheerioDomSelection, index: number) => any) {
    return this.selectedNodes.map(mapFunction)
  }

  get selectedNodes(): Array<CheerioDomSelection> {
    return this.#nativeSelector.toArray().map((node: any) => new CheerioDomSelection(this.#$, this.#$(node)))
  }

  get firstJsonLd (): Record<string, unknown> {
    return this.jsonLd[0]
  }

  get canonicalUrl(): string | undefined {
    return this.select('link[rel=canonical]').attr('href')
  }

  get jsonLd(): Array<Record<string, unknown>> {
    if (!this.#cachedJsonLdArray) {
      this.#cachedJsonLdArray = this.select('script[type="application/ld+json"]')
        .map(ldJsonElm => ldJsonElm.text)
        .map(ldJsonText => {
          try {
            return JSON.parse(ldJsonText)
          } catch(error) {
            console.error("Text is not valid JSON:", ldJsonText)
            throw error
          }
        })
    }

    return this.#cachedJsonLdArray
  }

  get data(): string {
    return this.#nativeSelector.data()
  }

  get value (): string {
    return this.#nativeSelector.val()
  }
}
