import { sourceId } from "./shared.js";
import singleMediaReqHandler from "./requestHandlers/singleMedia.js";
import mediaSearchReqHandler from "./requestHandlers/mediaSearch.js";
import { Source } from "@/src/schemas/source.js";

export default {
  id: sourceId,
  displayName: "GIPHY",
  description: "giphy.com is a large database of gifs",
  requestHandlers: [singleMediaReqHandler, mediaSearchReqHandler],
} satisfies Source
