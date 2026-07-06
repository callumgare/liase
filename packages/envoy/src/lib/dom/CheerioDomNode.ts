import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { CheerioDomSelection } from "./CheerioDomSelection.js";
import { DomNode } from "./DomNode.js";
import { type DomSelector, normaliseDomSelector } from "./DomSelection.js";

export class CheerioDomNode extends DomNode {
  #$node;
  #$: CheerioAPI;

  constructor(cheerioAPI: CheerioAPI, cheerioNode: Cheerio<AnyNode>) {
    super();
    this.#$ = cheerioAPI;
    this.#$node = cheerioNode.first();
  }

  get(selector: string | number | DomSelector): CheerioDomSelection {
    return new CheerioDomSelection(this.#$, this.#$node).get(selector);
  }

  getFirst(selector: string | number | DomSelector): CheerioDomNode | null {
    return this.get(selector).first();
  }

  matches(selector: string | DomSelector): boolean {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      return parsedSelector.query === 0 || parsedSelector.query === -1;
    }

    if (parsedSelector.type === "xpath") {
      return this.get(parsedSelector).length > 0;
    }

    return this.#$node.is(parsedSelector.query);
  }

  closest(selector: string | DomSelector): CheerioDomNode | null {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      return this.get(parsedSelector).first();
    }

    if (parsedSelector.type === "xpath") {
      return this.getFirst(parsedSelector);
    }

    const closestNode = this.#$node.closest(parsedSelector.query).first();
    if (closestNode.length === 0) {
      return null;
    }

    return new CheerioDomNode(this.#$, closestNode);
  }

  hasClass(className: string): boolean {
    return this.#$node.hasClass(className);
  }

  attr(attr: string): string | undefined {
    return this.#$node.attr(attr);
  }

  get attrs(): Record<string, string> {
    return this.#$node.attr() ?? {};
  }

  exists(selector: string): boolean {
    try {
      return this.get(selector).nodes.length > 0;
    } catch {
      return false;
    }
  }

  get text(): string {
    return this.#$node.text();
  }

  get html(): string {
    return this.#$node.html() ?? "";
  }

  get parent(): CheerioDomNode | null {
    const parent = this.#$node.parent().first();
    if (parent.length === 0) {
      return null;
    }

    return new CheerioDomNode(this.#$, parent);
  }

  get parents(): CheerioDomSelection {
    return new CheerioDomSelection(this.#$, this.#$node.parents());
  }

  get children(): CheerioDomSelection {
    return new CheerioDomSelection(this.#$, this.#$node.children());
  }

  get siblings(): CheerioDomSelection {
    return new CheerioDomSelection(this.#$, this.#$node.siblings());
  }

  get previousSibling(): CheerioDomNode | null {
    const previousSibling = this.#$node.prev().first();
    if (previousSibling.length === 0) {
      return null;
    }

    return new CheerioDomNode(this.#$, previousSibling);
  }

  get nextSibling(): CheerioDomNode | null {
    const nextSibling = this.#$node.next().first();
    if (nextSibling.length === 0) {
      return null;
    }

    return new CheerioDomNode(this.#$, nextSibling);
  }

  get data(): Record<string, unknown> {
    return this.#$node.data();
  }

  get value(): string | undefined | string[] {
    return this.#$node.val();
  }
}
