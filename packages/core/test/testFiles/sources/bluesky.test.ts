import blueskySource from "@/src/plugins/built-in-sources/bluesky/index.js";
import { expect } from "vitest";
import { getSecrets } from "../../utils/general.js";
import { createBasicTestsForRequestHandlers } from "../../utils/vitest.js";

// Search requires Bluesky authentication. Skip when no credentials are present
// (e.g. in CI). Add handle/password for bluesky in .secrets.mjs to run this test.
const blueskySecrets = await getSecrets({
  source: "bluesky",
  queryType: "search",
});
const hasBlueskyCredentials = !!(blueskySecrets as Record<string, unknown>)
  ?.handle;

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
      skip:
        !hasBlueskyCredentials &&
        "Bluesky search requires authentication — add .secrets.mjs with handle/password to run",
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
