import { sourceId } from "./shared.js";

import singleMediaReqHandler from "./requestHandlers/singleMedia.js";
import searchReqHandler from "./requestHandlers/search.js";

export default {
  id: sourceId,
  displayName: "Books to Scrape",
  description: "Example source based on https://books.toscrape.com/",
  requestHandlers: [singleMediaReqHandler, searchReqHandler],
};
