import { sourceName } from "./constants";
import singleMediaCapability from "./capabilities/singleMedia";
import mediaSearchCapability from "./capabilities/mediaSearch";
import { Source } from "@/types/sources";

const source: Source = {
  name: sourceName,
  capabilities: [singleMediaCapability, mediaSearchCapability],
};

export default source;
