import { expect } from "vitest";
import booksToScrapeSource from "@/src/sources/books-to-scrape/index.js";
import { createBasicTestsForRequestHandlers } from "media-finder/dist/test/utils.js";

createBasicTestsForRequestHandlers({
  source: booksToScrapeSource,
  queries: {
    "single-media": {
      request: { id: "its-only-the-himalayas_981" },
      checkResponse: (response) => expect(response).toMatchSnapshot(),
    },
    search: [
      {
        checkResponse: (response) => expect(response).toMatchSnapshot(),
        numOfPagesToLoad: 2,
      },
      {
        request: { category: "Sequential Art", pageNumber: 4 },
        checkResponse: (response) => expect(response).toMatchSnapshot(),
        numOfPagesToLoad: 2,
        numOfPagesToExpect: 1,
      },
      {
        request: { category: "Sports and Games" },
        checkResponse: (response) => expect(response).toMatchSnapshot(),
      },
    ],
  },
  queriesShared: {
    finderOptions: {
      plugins: [
        {
          sources: [booksToScrapeSource],
        },
      ],
    },
  },
});
