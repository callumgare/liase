import { sourceId } from "./shared.js";

import searchReqHandler from "./requestHandlers/search.js";
import singleMediaReqHandler from "./requestHandlers/singleMedia.js";

export default {
  id: sourceId,
  displayName: "Books to Scrape",
  description: "Example source based on https://books.toscrape.com/",
  requestHandlers: [singleMediaReqHandler, searchReqHandler],
};
