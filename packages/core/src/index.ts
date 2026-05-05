import LiasonQuery, { type LiasonQueryProps } from "./LiasonQuery.js";

export { default as Liason } from "./Liason.js";
export { default as LiasonQuery } from "./LiasonQuery.js";

export function createLiasonQuery(props: LiasonQueryProps): LiasonQuery {
  return new LiasonQuery(props);
}

export type { GenericMedia } from "@/src/schemas/media.js";
export type { GenericRequest } from "@/src/schemas/request.js";
export type { GenericResponse } from "@/src/schemas/response.js";
export type { GenericFile } from "@/src/schemas/file.js";
export type { Source } from "@/src/schemas/source.js";
export type { Plugin } from "@/src/schemas/plugin.js";
export type { RequestHandler } from "@/src/schemas/requestHandler.js";
export type { Constructor } from "@/src/schemas/constructor.js";
