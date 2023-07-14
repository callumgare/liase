import { sourceName } from "./constants.js";
import singleMediaCapability from "./capabilities/singleMedia.js";
import mediaSearchCapability from "./capabilities/mediaSearch.js";
import { Source } from "@/types/sources.js";

const source: Source = {
  name: sourceName,
  capabilities: [singleMediaCapability, mediaSearchCapability],
};

export default source;
