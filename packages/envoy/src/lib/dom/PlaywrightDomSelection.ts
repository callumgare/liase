import * as cheerio from "cheerio";
import type { Locator, Page } from "playwright";
import type { CheerioDomNode } from "./CheerioDomNode.js";
import { CheerioDomSelection } from "./CheerioDomSelection.js";
import { type DomSelector, normaliseDomSelector } from "./DomSelection.js";
import { PlaywrightDomNode } from "./PlaywrightDomNode.js";
import type { RenderedDomNode } from "./RenderedDomNode.js";
import { RenderedDomSelection } from "./RenderedDomSelection.js";

export class PlaywrightDomSelection extends RenderedDomSelection {
  #page: Page;
  #locator: Locator;
  #snapshot: CheerioDomSelection;

  constructor(args: {
    page: Page;
    locator: Locator;
    snapshot: CheerioDomSelection;
  }) {
    super();
    this.#page = args.page;
    this.#locator = args.locator;
    this.#snapshot = args.snapshot;
  }

  static async fromPage(page: Page): Promise<PlaywrightDomSelection> {
    const html = await page.content();
    const snapshot = new CheerioDomSelection(cheerio.load(html));
    return new PlaywrightDomSelection({
      page,
      locator: page.locator("html"),
      snapshot,
    });
  }

  #normaliseIndex(index: number): number {
    if (index >= 0) {
      return index;
    }

    const length = this.#snapshot.length;
    if (length === 0) {
      return index;
    }

    return ((index % length) + length) % length;
  }

  #nthChildSelector(index: number): string {
    if (index >= 0) {
      return `:scope > :nth-child(${index + 1})`;
    }

    return `:scope > :nth-last-child(${Math.abs(index)})`;
  }

  get(selector: string | number | DomSelector): PlaywrightDomSelection {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      return new PlaywrightDomSelection({
        page: this.#page,
        locator: this.#locator.locator(
          this.#nthChildSelector(parsedSelector.query),
        ),
        snapshot: this.#snapshot.get(parsedSelector),
      });
    }

    if (parsedSelector.type === "xpath") {
      return new PlaywrightDomSelection({
        page: this.#page,
        locator: this.#locator.locator(`xpath=${parsedSelector.query}`),
        // Snapshot-based traversal cannot resolve xpath; keep prior snapshot.
        snapshot: this.#snapshot,
      });
    }

    return new PlaywrightDomSelection({
      page: this.#page,
      locator: this.#locator.locator(parsedSelector.query),
      snapshot: this.#snapshot.get(parsedSelector.query),
    });
  }

  getFirst(selector: string | number | DomSelector): PlaywrightDomNode | null {
    return this.get(selector).first();
  }

  filter(selector: DomSelector): PlaywrightDomSelection {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      const index = this.#normaliseIndex(parsedSelector.query);
      return new PlaywrightDomSelection({
        page: this.#page,
        locator: this.#locator.nth(index),
        snapshot: this.#snapshot.filter(parsedSelector),
      });
    }

    if (parsedSelector.type === "xpath") {
      return new PlaywrightDomSelection({
        page: this.#page,
        locator: this.#locator.and(
          this.#page.locator(`xpath=${parsedSelector.query}`),
        ),
        snapshot: this.#snapshot.filter(parsedSelector),
      });
    }

    return new PlaywrightDomSelection({
      page: this.#page,
      locator: this.#locator.and(this.#page.locator(parsedSelector.query)),
      snapshot: this.#snapshot.filter(parsedSelector),
    });
  }

  anyMatches(selector: string | DomSelector): boolean {
    return this.#snapshot.anyMatches(selector);
  }

  allMatches(selector: string | DomSelector): boolean {
    return this.#snapshot.allMatches(selector);
  }

  exists(selector: string): boolean {
    return this.#snapshot.exists(selector);
  }

  get nodes(): PlaywrightDomNode[] {
    return this.#snapshot.nodes
      .map((_, i) => this.filter({ type: "nth", query: i }).first())
      .filter((node): node is PlaywrightDomNode => Boolean(node));
  }

  map<T>(mapFunction: (node: RenderedDomNode, index: number) => T): T[] {
    return this.nodes.map(mapFunction);
  }

  first(selector?: DomSelector): PlaywrightDomNode | null {
    if (selector) {
      return this.filter(selector).first();
    }

    const snapshotFirst = this.#snapshot.first();
    if (!snapshotFirst) {
      return null;
    }

    return new PlaywrightDomNode({
      page: this.#page,
      locator: this.#locator.first(),
      snapshot: snapshotFirst,
    });
  }

  last(selector?: DomSelector): PlaywrightDomNode | null {
    if (selector) {
      return this.filter(selector).last();
    }

    const snapshotLast = this.#snapshot.last();
    if (!snapshotLast) {
      return null;
    }

    return new PlaywrightDomNode({
      page: this.#page,
      locator: this.#locator.last(),
      snapshot: snapshotLast,
    });
  }
}
