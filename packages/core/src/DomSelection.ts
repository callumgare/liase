import { AnyNode, Cheerio, load } from "cheerio"

export abstract class DomSelection {
  // eslint-disable-next-line no-use-before-define -- We have to use DomSelection before it's defined because it's recursive
  abstract select: (selector: string) => DomSelection
  abstract attr: (attr: string) => string | undefined
  abstract exists: (selector: string) => boolean
  abstract get text(): Promise<string>
  abstract get nativeSelector(): Cheerio<AnyNode>
  abstract get selectedNodes(): DomSelection[]
  abstract get jsonLd(): Record<string, unknown>
}

export class CheerioDomSelection extends DomSelection {
  #nativeSelector

  constructor(cheerioNode: Cheerio<AnyNode>) {
    if (cheerioNode?.cheerio !== "[cheerio object]"){
      console.error("Value:", cheerioNode)
      throw Error(`Trying to convert non-cheerio value`)
    }
    super()
    this.#nativeSelector = cheerioNode
  }

  select = (selector: string) => new CheerioDomSelection( this.nativeSelector.find(selector) )
  attr = (attr: string) => this.#nativeSelector.attr(attr)
  exists = (selector: string) => Boolean(this.#nativeSelector.find(selector).length)

  get nativeSelector() {
    return this.#nativeSelector
  }

  get text () {
    return new Promise<string>(resolve => resolve(this.#nativeSelector.text()))
  }

  get selectedNodes () {
    return this.#nativeSelector.toArray().map(element => new CheerioDomSelection(load(element).root()))
  }

  get jsonLd (): Record<string, unknown> {
    const jsonLdText = this.#nativeSelector.find('script[type="application/ld+json"]').text()
    let jsonLdJson
    try {
      jsonLdJson = JSON.parse(jsonLdText)
    } catch(error) {
      console.error("Text is not valid JSON:", jsonLdText)
      throw error
    }
    return jsonLdJson
  }
}
