import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Cheerio, CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import * as xpath from "xpath";
import { CheerioDomNode } from "./CheerioDomNode.js";
import {
  DomSelection,
  type DomSelector,
  normaliseDomSelector,
} from "./DomSelection.js";

export class CheerioDomSelection extends DomSelection {
  #$node;
  #$: CheerioAPI;

  constructor(cheerioAPI: CheerioAPI, cheerioNode?: Cheerio<AnyNode>) {
    super();
    this.#$node = cheerioNode ?? cheerioAPI.root();
    this.#$ = cheerioAPI;
  }

  #normaliseIndex(index: number): number {
    if (index >= 0) {
      return index;
    }

    const length = this.#$node.length;
    if (length === 0) {
      return index;
    }

    return ((index % length) + length) % length;
  }

  #normaliseIndexForLength(index: number, length: number): number {
    if (index >= 0) {
      return index;
    }

    if (length === 0) {
      return index;
    }

    return ((index % length) + length) % length;
  }

  #selectXpath(query: string): CheerioDomSelection {
    const xmlSafeFragment = (fragment: string): string => {
      return fragment.replace(
        /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([^>]*)>/gi,
        "<$1$2 />",
      );
    };

    const fragments = this.#$node
      .toArray()
      .map((node) => this.#$.xml(node) ?? "")
      .filter(Boolean)
      .map((fragment) => fragment.replace(/<!doctype[^>]*>/gi, ""))
      .map(xmlSafeFragment);

    if (fragments.length === 0) {
      const $ = cheerio.load("<liase-root></liase-root>");
      return new CheerioDomSelection($, $("liase-root").children());
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<liase-root>${fragments.join("")}</liase-root>`,
      "text/xml",
    );

    const xpathResult = xpath.select(query, doc as unknown as Node);
    const selectedValues: xpath.SelectedValue[] = Array.isArray(xpathResult)
      ? xpathResult
      : [xpathResult];

    const serializer = new XMLSerializer();
    const resultNodes = selectedValues.flatMap((value) => {
      if (
        typeof value !== "object" ||
        value === null ||
        !("nodeType" in value)
      ) {
        return [];
      }

      return [
        serializer.serializeToString(
          value as unknown as Parameters<XMLSerializer["serializeToString"]>[0],
        ),
      ];
    });

    const $ = cheerio.load(`<liase-root>${resultNodes.join("")}</liase-root>`, {
      xmlMode: true,
    });
    return new CheerioDomSelection($, $("liase-root").children());
  }

  get(selector: string | number | DomSelector): CheerioDomSelection {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      const childNodes = this.#$node.toArray().flatMap((node) => {
        const children = this.#$(node).children().toArray();
        const index = this.#normaliseIndexForLength(
          parsedSelector.query,
          children.length,
        );
        const child = children[index];
        return child ? [child] : [];
      });

      return new CheerioDomSelection(this.#$, this.#$(childNodes));
    }

    if (parsedSelector.type === "xpath") {
      return this.#selectXpath(parsedSelector.query);
    }

    if (parsedSelector.type === "text") {
      return new CheerioDomSelection(
        this.#$,
        this.#$node.find("*").filter((_, node) => {
          const text = this.#$(node).text();
          return text === parsedSelector.query;
        }),
      );
    }

    return new CheerioDomSelection(
      this.#$,
      this.#$node.find(parsedSelector.query),
    );
  }

  getFirst(selector: string | number | DomSelector): CheerioDomNode | null {
    return this.get(selector).first();
  }

  filter(selector: DomSelector): CheerioDomSelection {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      return new CheerioDomSelection(
        this.#$,
        this.#$node.eq(this.#normaliseIndex(parsedSelector.query)),
      );
    }

    if (parsedSelector.type === "xpath") {
      const matchedNodes = new Set(
        this.#selectXpath(parsedSelector.query).nodes.map((node) => node.html),
      );

      return new CheerioDomSelection(
        this.#$,
        this.#$node.filter((_, node) => {
          const html = this.#$.html(node) ?? "";
          return matchedNodes.has(html);
        }),
      );
    }

    if (parsedSelector.type === "text") {
      return new CheerioDomSelection(
        this.#$,
        this.#$node.filter((_, node) => {
          const text = this.#$(node).text();
          return text === parsedSelector.query;
        }),
      );
    }

    return new CheerioDomSelection(
      this.#$,
      this.#$node.filter(parsedSelector.query),
    );
  }

  anyMatches(selector: string | DomSelector): boolean {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      return this.filter(parsedSelector).nodes.length > 0;
    }

    return this.nodes.some((node) => node.matches(parsedSelector));
  }

  allMatches(selector: string | DomSelector): boolean {
    const parsedSelector = normaliseDomSelector(selector);

    if (this.length === 0) {
      return false;
    }

    if (parsedSelector.type === "nth") {
      return this.filter(parsedSelector).length === this.length;
    }

    return this.nodes.every((node) => node.matches(parsedSelector));
  }

  exists = (selector: string) => {
    try {
      return this.get(selector).nodes.length > 0;
    } catch {
      return false;
    }
  };

  map<T>(mapFunction: (node: CheerioDomNode, index: number) => T): T[] {
    return this.nodes.map(mapFunction);
  }

  get nodes(): Array<CheerioDomNode> {
    return this.#$node
      .toArray()
      .map((node: AnyNode) => new CheerioDomNode(this.#$, this.#$(node)));
  }

  first(selector?: DomSelector): CheerioDomNode | null {
    if (selector) {
      return this.filter(selector).first();
    }

    if (this.#$node.length === 0) {
      return null;
    }

    return new CheerioDomNode(this.#$, this.#$node.first());
  }

  last(selector?: DomSelector): CheerioDomNode | null {
    if (selector) {
      return this.filter(selector).last();
    }

    if (this.#$node.length === 0) {
      return null;
    }

    return new CheerioDomNode(this.#$, this.#$node.last());
  }
}
