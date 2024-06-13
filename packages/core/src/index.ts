import MediaFinderQuery, { MediaFinderQueryProps } from "./MediaFinderQuery.js";

export {default as MediaFinder} from "./MediaFinder.js";

export function createMediaFinderQuery(props: MediaFinderQueryProps): MediaFinderQuery {
  return new MediaFinderQuery(props);
}

export type {GenericMedia} from "@/src/schemas/media.js";
export type {GenericRequest} from "@/src/schemas/request.js";
export type {GenericResponse} from "@/src/schemas/response.js";
export type {GenericFile} from "@/src/schemas/file.js";
export type {Source} from "@/src/schemas/source.js";
export type {RequestHandler} from "@/src/schemas/requestHandler.js";
