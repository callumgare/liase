import type { DomSelector } from "./DomSelection.js";
import { DomSelection } from "./DomSelection.js";
import type { RenderedDomNode } from "./RenderedDomNode.js";

export abstract class RenderedDomSelection extends DomSelection {
  // Selects descendants and preserves rendered capabilities.
  abstract get(selector: string | number | DomSelector): RenderedDomSelection;

  // Selects descendants and returns only the first rendered match.
  abstract getFirst(
    selector: string | number | DomSelector,
  ): RenderedDomNode | null;

  // Filters the current selection while preserving rendered capabilities.
  abstract filter(selector: DomSelector): RenderedDomSelection;

  // Returns each selected node as an individual rendered node.
  abstract get nodes(): RenderedDomNode[];

  // Maps over each selected node as an individual rendered node.
  map<T>(mapFunction: (node: RenderedDomNode, index: number) => T): T[] {
    return this.nodes.map(mapFunction);
  }

  // Returns the first rendered node in the current selection, optionally after filtering.
  abstract first(selector?: DomSelector): RenderedDomNode | null;

  // Returns the last rendered node in the current selection, optionally after filtering.
  abstract last(selector?: DomSelector): RenderedDomNode | null;
}
