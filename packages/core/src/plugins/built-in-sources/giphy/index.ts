import type { Source } from "@/src/schemas/source.js";
import mediaSearchReqHandler from "./requestHandlers/mediaSearch.js";
import singleMediaReqHandler from "./requestHandlers/singleMedia.js";
import { sourceId } from "./shared.js";

export default {
  id: sourceId,
  displayName: "GIPHY",
  description: "giphy.com is a large database of gifs",
  requestHandlers: [singleMediaReqHandler, mediaSearchReqHandler],
} satisfies Source;
