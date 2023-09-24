import { createMediaFinderQuery } from "@/src/index.js";
import basicPlugin from "./fixtures/basic-plugin.js";

test("Get media", async () => {
  expect.assertions(2);
  const mediaQuery = createMediaFinderQuery({
    request: {
      source: "Test Site",
      queryType: "Search media",
      searchText: "search text",
      pageNumber: 1
    },
    finderOptions: {
      plugins: [basicPlugin],
    }
  });
  const responseSchema = mediaQuery.getResponseSchema();

  const response = await mediaQuery.getNext();
  responseSchema.parse(response);
  expect(response?.media[0].title).toBeTruthy();
  expect(response?.page?.paginationType === "offset" && response?.page?.pageNumber).toBe(1);
});

test(
  "Use getWebsite shared function",
  async () => {
    expect.assertions(1);
    const mediaQuery = createMediaFinderQuery({
      request: {
        source: "Test Site",
        queryType: "Single media",
        id: "test-getWebpage",
      },
      finderOptions: {
        plugins: [basicPlugin],
      }
    });
    const responseSchema = mediaQuery.getResponseSchema();

    const response = await mediaQuery.getNext();
    responseSchema.parse(response);
    expect(response?.media[0].title).toBe("Example Domain");
  },
  1000 * 10
);
