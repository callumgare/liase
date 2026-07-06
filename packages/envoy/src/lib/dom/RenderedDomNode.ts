import { DomNode } from "./DomNode.js";
import type { DomSelector } from "./DomSelection.js";
import type { RenderedDomSelection } from "./RenderedDomSelection.js";

export abstract class RenderedDomNode extends DomNode {
  // Selects descendants and preserves rendered capabilities.
  abstract get(selector: string | number | DomSelector): RenderedDomSelection;

  // Selects descendants and returns only the first rendered match.
  abstract getFirst(
    selector: string | number | DomSelector,
  ): RenderedDomNode | null;

  // Returns the direct parent node with rendered capabilities.
  abstract get parent(): RenderedDomNode | null;

  // Returns all ancestor nodes with rendered capabilities.
  abstract get parents(): RenderedDomSelection;

  // Returns direct children with rendered capabilities.
  abstract get children(): RenderedDomSelection;

  // Returns siblings with rendered capabilities.
  abstract get siblings(): RenderedDomSelection;

  // Returns the previous sibling with rendered capabilities.
  abstract get previousSibling(): RenderedDomNode | null;

  // Returns the next sibling with rendered capabilities.
  abstract get nextSibling(): RenderedDomNode | null;

  // Finds the closest ancestor matching a selector.
  abstract closest(selector: string | DomSelector): RenderedDomNode | null;

  // Clicks the element.
  abstract click(options?: {
    button?: "left" | "right" | "middle";
    clickCount?: number;
    timeout?: number;
  }): Promise<void>;

  // Double-clicks the element.
  abstract dblclick(options?: {
    button?: "left" | "right" | "middle";
    timeout?: number;
  }): Promise<void>;

  // Types text into the element.
  abstract type(text: string, options?: { delay?: number }): Promise<void>;

  // Clears editable content.
  abstract clear(options?: { timeout?: number }): Promise<void>;

  // Replaces editable content with value.
  abstract fill(value: string, options?: { timeout?: number }): Promise<void>;

  // Presses a keyboard key while focused.
  abstract press(key: string, options?: { timeout?: number }): Promise<void>;

  // Types characters one-by-one using keyboard events.
  abstract pressSequentially(
    text: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void>;

  // Selects one or more options from a select element.
  abstract selectOption(
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
  ): Promise<string[]>;

  // Scrolls the element into view when needed.
  abstract scrollIntoViewIfNeeded(options?: {
    timeout?: number;
  }): Promise<void>;

  // Focuses the element.
  abstract focus(): Promise<void>;

  // Blurs the element.
  abstract blur(): Promise<void>;

  // Hovers over the element.
  abstract hover(options?: { timeout?: number }): Promise<void>;

  // Waits for a target element state.
  abstract waitFor(options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  }): Promise<void>;

  // Reads an attribute value from the element.
  abstract getAttribute(name: string): Promise<string | null>;

  // Reads textContent from the element.
  abstract textContent(): Promise<string | null>;

  // Reads rendered innerText from the element.
  abstract innerText(): Promise<string>;

  // Reads inner HTML from the element.
  abstract innerHtml(): Promise<string>;

  // Reads the current input value.
  abstract inputValue(): Promise<string>;

  // Checks whether the element is visible.
  abstract isVisible(): Promise<boolean>;

  // Checks whether the element is hidden.
  abstract isHidden(): Promise<boolean>;

  // Checks whether the element is enabled.
  abstract isEnabled(): Promise<boolean>;

  // Checks whether the element is disabled.
  abstract isDisabled(): Promise<boolean>;

  // Checks whether the element is editable.
  abstract isEditable(): Promise<boolean>;

  // Checks whether the element is checked.
  abstract isChecked(): Promise<boolean>;
}
