import type { DomNode } from "./lib/dom/DomNode.js";
import type { DomSelection } from "./lib/dom/DomSelection.js";
import type { RenderedDomNode } from "./lib/dom/RenderedDomNode.js";
import type { RenderedDomSelection } from "./lib/dom/RenderedDomSelection.js";

export type UrlResType = "text" | "json" | "dom" | "rendered dom";

export type UrlRes<TType extends UrlResType = UrlResType> = {
  type: TType;
  statusCode: number;
  headers: Record<string, string>;
  cached: boolean;
  cachedOn: Date | null;
  request: {
    headers: Record<string, string>;
  };
};

export type UrlResText = UrlRes<"text"> & {
  data: string;
};

export type UrlResJson = UrlRes<"json"> & {
  data: unknown;
};

export type UrlResDom = UrlRes<"dom"> & {
  requestedUrl: string;
  finalUrl: string;
  dom: DomSelection;
  root: DomNode;
  jsonLD: Array<Record<string, unknown>>;
  firstJsonLD: Record<string, unknown>;
  canonicalUrl: string | undefined;
  title: string;
  html: string;
  refetch(): Promise<void>;
};

export type UrlResRenderedDom = Omit<
  UrlResDom,
  | "type"
  | "dom"
  | "root"
  | "jsonLD"
  | "firstJsonLD"
  | "canonicalUrl"
  | "title"
  | "html"
> & {
  type: "rendered dom";
  dom: Promise<RenderedDomSelection>;
  root: Promise<RenderedDomNode>;
  jsonLD: Promise<Array<Record<string, unknown>>>;
  firstJsonLD: Promise<Record<string, unknown>>;
  canonicalUrl: Promise<string | undefined>;
  title: Promise<string>;
  html: Promise<string>;
  refresh(): Promise<void>;
  screenshot(): Promise<Buffer>;
  waitForUrl(): Promise<void>;
  close(): Promise<void>;
};

export type UrlResAny = UrlResDom | UrlResJson | UrlResText | UrlResRenderedDom;
