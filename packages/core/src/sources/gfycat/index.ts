import { sourceName } from "./constants.js";
import singleMediaRequestHandler from "./requestHandlers/singleMedia.js";
import mediaSearchRequestHandler from "./requestHandlers/mediaSearch.js";
import { Source } from "@/src/schemas/source.js";

const source: Source = {
  name: sourceName,
  requestHandlers: [singleMediaRequestHandler, mediaSearchRequestHandler],
};

export default source;
