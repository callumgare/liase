import type { DomSelection, DomSelector } from "./DomSelection.js";

export abstract class DomNode {
  // Selects descendants from the current single node.
  abstract get(selector: string | number | DomSelector): DomSelection;

  // Selects descendants and returns only the first match.
  abstract getFirst(selector: string | number | DomSelector): DomNode | null;

  // Checks whether the current node matches a selector.
  abstract matches(selector: string | DomSelector): boolean;

  // Finds the closest ancestor matching a selector.
  abstract closest(selector: string | DomSelector): DomNode | null;

  // Checks whether the node has the provided class.
  abstract hasClass(className: string): boolean;

  // Reads a single attribute from this node.
  abstract attr(attr: string): string | undefined;

  // Reads all attributes from this node.
  abstract get attrs(): Record<string, string>;

  // Tests whether at least one descendant matches the selector.
  abstract exists(selector: string): boolean;

  // Returns text content for this node.
  abstract get text(): string | Promise<string>;

  // Returns HTML for this node.
  abstract get html(): string | Promise<string>;

  // Returns the direct parent node.
  abstract get parent(): DomNode | null;

  // Returns all ancestor nodes.
  abstract get parents(): DomSelection;

  // Returns direct children.
  abstract get children(): DomSelection;

  // Returns sibling nodes.
  abstract get siblings(): DomSelection;

  // Returns all siblings that appear before this node.
  abstract get previousSiblings(): DomSelection;

  // Returns all siblings that appear after this node.
  abstract get nextSiblings(): DomSelection;

  // Returns the previous sibling node.
  abstract get previousSibling(): DomNode | null;

  // Returns the next sibling node.
  abstract get nextSibling(): DomNode | null;

  // Returns data-* attributes parsed by the adapter.
  abstract get data(): Record<string, unknown>;

  // Returns form value(s) for this node.
  abstract get value(): string | undefined | string[];
}
