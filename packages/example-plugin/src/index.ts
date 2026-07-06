import type { Plugin } from "@liase/core";
import booksToScrapeSource from "./sources/books-to-scrape/index.js";

const plugin: Plugin = {
  sources: [booksToScrapeSource],
};

export default plugin;
