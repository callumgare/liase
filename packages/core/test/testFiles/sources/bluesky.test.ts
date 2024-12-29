import { expect } from "vitest";
import blueskySource from "@/src/plugins/built-in-sources/bluesky/index.js";
import { createBasicTestsForRequestHandlers } from "../../utils/vitest.js";

createBasicTestsForRequestHandlers({
  source: blueskySource,
  queries: {
    "single-media": {
      request: {
        id: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jt6walwmos2y#bafkreidf3ystxebv33boyb5hr2ggwmlee5x53vubwelsuvmcw3tq4p36pi",
      },
      checkResponse: (response) => expect(response).toMatchSnapshot(),
    },
    search: {
      request: { searchText: "#photo" },
      checkResponse: (response) =>
        expect(response.media.length).toBeGreaterThan(2),
      numOfPagesToLoad: 1,
      duplicateMediaPossible: true,
    },
    feed: {
      request: {
        feedId:
          "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
      },
      checkResponse: (response) =>
        expect(response.media.length).toBeGreaterThan(2),
      numOfPagesToLoad: 2,
      duplicateMediaPossible: true,
      timeout: 10 * 1000,
    },
  },
});
