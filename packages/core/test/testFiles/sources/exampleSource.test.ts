import { expect } from "vitest";
import { createBasicTestsForRequestHandlers } from "../../utils/vitest.js";
import exampleSource from "../../fixtures/exampleSource.js";

createBasicTestsForRequestHandlers({
  source: exampleSource,
  queries: {
    "single-media": {
      request: { id: "test-getWebpage" },
      checkResponse: (response) => expect(response).toMatchSnapshot(),
    },
    "search-media": {
      request: { searchText: "search text" },
      checkResponse: (response) => expect(response).toMatchSnapshot(),
      numOfPagesToLoad: 3,
      numOfPagesToExpect: 2,
    },
  },
  queriesShared: {
    finderOptions: {
      plugins: [
        {
          sources: [exampleSource],
        },
      ],
    },
  },
});
