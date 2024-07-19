import { expect } from "vitest";
import giphySource from "@/src/sources/giphy/index.js";
import {
  createBasicTestsForRequestHandlers,
  normaliseResponse,
} from "../testUtils.js";

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
  queriesShared: {
    secrets: {
      apiKey: process.env.GIPHY_API_KEY,
    },
  },
});
