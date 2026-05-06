import giphySource from "@/src/plugins/built-in-sources/giphy/index.js";
import { expect } from "vitest";
import {
  createBasicTestsForRequestHandlers,
  normaliseResponse,
} from "../../utils/vitest.js";

createBasicTestsForRequestHandlers({
  source: giphySource,
  queries: {
    "single-media": {
      request: { id: "YsTs5ltWtEhnq" },
      skip: !process.env.GIPHY_API_KEY
        ? "Skipping: GIPHY_API_KEY not set"
        : false,
      checkResponse: (response) =>
        expect(normaliseResponse(response)).toMatchSnapshot(),
    },
    search: {
      request: { searchText: "happy" },
      skip: !process.env.GIPHY_API_KEY
        ? "Skipping: GIPHY_API_KEY not set"
        : false,
      checkResponse: (response) =>
        expect(response.media.length).toBeGreaterThan(5),
      numOfPagesToLoad: 2,
    },
  },
});
