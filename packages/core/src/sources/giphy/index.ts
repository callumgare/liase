import { sourceName } from "./constants.js";
import singleMediaCapability from "./requestHandlers/singleMedia.js";
import mediaSearchCapability from "./requestHandlers/mediaSearch.js";
import { Source } from "@/src/schemas/source.js";

const source: Source = {
  name: sourceName,
  requestHandlers: [singleMediaCapability, mediaSearchCapability],
};

export default source;
