import type { Locator, Page } from "playwright";
import type { CheerioDomNode } from "./CheerioDomNode.js";
import { type DomSelector, normaliseDomSelector } from "./DomSelection.js";
import { PlaywrightDomSelection } from "./PlaywrightDomSelection.js";
import { RenderedDomNode } from "./RenderedDomNode.js";

export class PlaywrightDomNode extends RenderedDomNode {
  #page: Page;
  #locator: Locator;
  #snapshot: CheerioDomNode;

  constructor(args: {
    page: Page;
    locator: Locator;
    snapshot: CheerioDomNode;
  }) {
    super();
    this.#page = args.page;
    this.#locator = args.locator;
    this.#snapshot = args.snapshot;
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

  #nthChildSelector(index: number): string {
    if (index >= 0) {
      return `:scope > :nth-child(${index + 1})`;
    }

    return `:scope > :nth-last-child(${Math.abs(index)})`;
  }

  get(selector: string | number | DomSelector): PlaywrightDomSelection {
    const parsedSelector = normaliseDomSelector(selector);

    if (parsedSelector.type === "nth") {
      const childLength = this.#snapshot.children.length;
      const normalisedIndex = this.#normaliseIndexForLength(
        parsedSelector.query,
        childLength,
      );

      return new PlaywrightDomSelection({
        page: this.#page,
        locator: this.#locator.locator(this.#nthChildSelector(normalisedIndex)),
        snapshot: this.#snapshot.get(parsedSelector),
      });
    }

    if (parsedSelector.type === "xpath") {
      return new PlaywrightDomSelection({
        page: this.#page,
        locator: this.#locator.locator(`xpath=${parsedSelector.query}`),
        snapshot: this.#snapshot.get(parsedSelector),
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

  matches(selector: string | DomSelector): boolean {
    return this.#snapshot.matches(selector);
  }

  closest(selector: string | DomSelector): PlaywrightDomNode | null {
    const snapshotClosest = this.#snapshot.closest(selector);
    if (!snapshotClosest) {
      return null;
    }

    return new PlaywrightDomNode({
      page: this.#page,
      locator: this.#locator,
      snapshot: snapshotClosest,
    });
  }

  hasClass(className: string): boolean {
    return this.#snapshot.hasClass(className);
  }

  attr(attr: string): string | undefined {
    return this.#snapshot.attr(attr);
  }

  get attrs(): Record<string, string> {
    return this.#snapshot.attrs;
  }

  exists(selector: string): boolean {
    return this.#snapshot.exists(selector);
  }

  get text(): string {
    return this.#snapshot.text as string;
  }

  get html(): string {
    return this.#snapshot.html;
  }

  get parent(): PlaywrightDomNode | null {
    const snapshotParent = this.#snapshot.parent;
    if (!snapshotParent) {
      return null;
    }

    return new PlaywrightDomNode({
      page: this.#page,
      locator: this.#locator.locator("xpath=.."),
      snapshot: snapshotParent,
    });
  }

  get parents(): PlaywrightDomSelection {
    return new PlaywrightDomSelection({
      page: this.#page,
      locator: this.#locator.locator("xpath=ancestor::*"),
      snapshot: this.#snapshot.parents,
    });
  }

  get children(): PlaywrightDomSelection {
    return new PlaywrightDomSelection({
      page: this.#page,
      locator: this.#locator.locator("xpath=./*"),
      snapshot: this.#snapshot.children,
    });
  }

  get siblings(): PlaywrightDomSelection {
    return new PlaywrightDomSelection({
      page: this.#page,
      locator: this.#locator.locator("xpath=../*"),
      snapshot: this.#snapshot.siblings,
    });
  }

  get previousSibling(): PlaywrightDomNode | null {
    const snapshotPreviousSibling = this.#snapshot.previousSibling;
    if (!snapshotPreviousSibling) {
      return null;
    }

    return new PlaywrightDomNode({
      page: this.#page,
      locator: this.#locator.locator("xpath=preceding-sibling::*[1]"),
      snapshot: snapshotPreviousSibling,
    });
  }

  get nextSibling(): PlaywrightDomNode | null {
    const snapshotNextSibling = this.#snapshot.nextSibling;
    if (!snapshotNextSibling) {
      return null;
    }

    return new PlaywrightDomNode({
      page: this.#page,
      locator: this.#locator.locator("xpath=following-sibling::*[1]"),
      snapshot: snapshotNextSibling,
    });
  }

  get data(): Record<string, unknown> {
    return this.#snapshot.data;
  }

  get value(): string | undefined | string[] {
    return this.#snapshot.value;
  }

  async click(options?: {
    button?: "left" | "right" | "middle";
    clickCount?: number;
    timeout?: number;
  }): Promise<void> {
    await this.#locator.click(options);
  }

  async dblclick(options?: {
    button?: "left" | "right" | "middle";
    timeout?: number;
  }): Promise<void> {
    await this.#locator.dblclick(options);
  }

  async type(text: string, options?: { delay?: number }): Promise<void> {
    await this.#locator.type(text, options);
  }

  async clear(options?: { timeout?: number }): Promise<void> {
    await this.#locator.clear(options);
  }

  async fill(value: string, options?: { timeout?: number }): Promise<void> {
    await this.#locator.fill(value, options);
  }

  async press(key: string, options?: { timeout?: number }): Promise<void> {
    await this.#locator.press(key, options);
  }

  async pressSequentially(
    text: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    await this.#locator.pressSequentially(text, options);
  }

  async selectOption(
    value:
      | string
      | string[]
      | {
          value?: string;
          label?: string;
          index?: number;
        }
      | Array<{
          value?: string;
          label?: string;
          index?: number;
        }>,
    options?: { timeout?: number },
  ): Promise<string[]> {
    return this.#locator.selectOption(value, options);
  }

  async scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void> {
    await this.#locator.scrollIntoViewIfNeeded(options);
  }

  async focus(): Promise<void> {
    await this.#locator.focus();
  }

  async blur(): Promise<void> {
    await this.#locator.blur();
  }

  async hover(options?: { timeout?: number }): Promise<void> {
    await this.#locator.hover(options);
  }

  async waitFor(options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  }): Promise<void> {
    await this.#locator.waitFor(options);
  }

  async getAttribute(name: string): Promise<string | null> {
    return this.#locator.getAttribute(name);
  }

  async textContent(): Promise<string | null> {
    return this.#locator.textContent();
  }

  async innerText(): Promise<string> {
    return this.#locator.innerText();
  }

  async innerHtml(): Promise<string> {
    return this.#locator.innerHTML();
  }

  async inputValue(): Promise<string> {
    return this.#locator.inputValue();
  }

  async isVisible(): Promise<boolean> {
    return this.#locator.isVisible();
  }

  async isHidden(): Promise<boolean> {
    return this.#locator.isHidden();
  }

  async isEnabled(): Promise<boolean> {
    return this.#locator.isEnabled();
  }

  async isDisabled(): Promise<boolean> {
    return this.#locator.isDisabled();
  }

  async isEditable(): Promise<boolean> {
    return this.#locator.isEditable();
  }

  async isChecked(): Promise<boolean> {
    return this.#locator.isChecked();
  }
}
