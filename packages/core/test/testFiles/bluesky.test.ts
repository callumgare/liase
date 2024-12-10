import { expect } from "vitest";
import blueskySource from "@/src/plugins/built-in-sources/bluesky/index.js";
import { createBasicTestsForRequestHandlers } from "../utils/vitest.js";

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
      request: { searchText: "happy" },
      checkResponse: (response) =>
        expect(response.media.length).toBeGreaterThan(5),
      numOfPagesToLoad: 2,
    },
  },
});
