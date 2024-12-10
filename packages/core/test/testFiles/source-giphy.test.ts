import { expect } from "vitest";
import giphySource from "@/src/plugins/built-in-sources/giphy/index.js";
import {
  createBasicTestsForRequestHandlers,
  normaliseResponse,
} from "../utils/vitest.js";

createBasicTestsForRequestHandlers({
  source: giphySource,
  queries: {
    "single-media": {
      request: { id: "YsTs5ltWtEhnq" },
      checkResponse: (response) =>
        expect(normaliseResponse(response)).toMatchSnapshot(),
    },
    search: {
      request: { searchText: "happy" },
      checkResponse: (response) =>
        expect(response.media.length).toBeGreaterThan(5),
      numOfPagesToLoad: 2,
    },
  },
});
