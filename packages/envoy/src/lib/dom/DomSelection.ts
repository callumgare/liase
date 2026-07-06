import type { DomNode } from "./DomNode.js";

export type DomSelector =
  | {
      type: "css" | "xpath" | "text";
      query: string;
    }
  | {
      type: "nth";
      query: number;
    };

export function normaliseDomSelector(
  selector: string | number | DomSelector,
): DomSelector {
  if (typeof selector === "number") {
    return { type: "nth", query: selector };
  }

  if (typeof selector !== "string") {
    return selector;
  }

  if (selector.startsWith("css=")) {
    return { type: "css", query: selector.slice(4) };
  }

  if (selector.startsWith("xpath=")) {
    return { type: "xpath", query: selector.slice(6) };
  }

  if (selector.startsWith("text=")) {
    return { type: "text", query: selector.slice(5) };
  }

  return { type: "css", query: selector };
}

export abstract class DomSelection {
  // Selects descendants from the current selection.
  abstract get(selector: string | number | DomSelector): DomSelection;

  // Selects descendants and returns only the first match.
  abstract getFirst(selector: string | number | DomSelector): DomNode | null;

  // Filters the current selection by the provided selector.
  abstract filter(selector: DomSelector): DomSelection;

  // Checks whether any selected node matches a selector.
  abstract anyMatches(selector: string | DomSelector): boolean;

  // Checks whether all selected nodes match a selector.
  abstract allMatches(selector: string | DomSelector): boolean;

  // Tests whether at least one descendant matches the selector.
  abstract exists(selector: string): boolean;

  // Returns each selected node as an individual selection.
  abstract get nodes(): DomNode[];

  // Returns the first node in the current selection, optionally after filtering.
  abstract first(selector?: DomSelector): DomNode | null;

  // Returns the last node in the current selection, optionally after filtering.
  abstract last(selector?: DomSelector): DomNode | null;

  // Maps over each selected node as an individual selection.
  map<T>(mapFunction: (node: DomNode, index: number) => T): T[] {
    return this.nodes.map(mapFunction);
  }

  // Number of nodes in the current selection.
  get length(): number {
    return this.nodes.length;
  }
}
