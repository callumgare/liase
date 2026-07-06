import type { Source } from "@liase/core";
import { sourceId } from "./shared.js";

import searchReqHandler from "./requestHandlers/search.js";
import singleMediaReqHandler from "./requestHandlers/singleMedia.js";

const source: Source = {
  id: sourceId,
  displayName: "Books to Scrape",
  description: "Example source based on https://books.toscrape.com/",
  requestHandlers: [singleMediaReqHandler, searchReqHandler],
};

export default source;
