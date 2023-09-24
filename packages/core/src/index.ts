import MediaFinderQuery, { MediaFinderQueryProps } from "./MediaFinderQuery.js";
export {default as MediaFinder} from "./MediaFinder.js";

export function createMediaFinderQuery(props: MediaFinderQueryProps): MediaFinderQuery {
  return new MediaFinderQuery(props);
}
