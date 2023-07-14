import mediaFinder from "../src/MediaFinder.js";
import basicPlugin from "./fixtures/basic-plugin.js";

test("Get media", async () => {
  expect.assertions(2);
  const mediaQuery = mediaFinder(
    {
      source: "Test Site",
      searchText: "search text",
    },
    {
      plugins: [basicPlugin],
    }
  );
  const outputType = mediaQuery.getReturnType();

  let page = await mediaQuery.getNext();
  outputType.parse(page);
  expect(page.items[0].title).toBeTruthy();
  expect(page.number).toBe(1);
});

test(
  "Use getWebsite shared function",
  async () => {
    expect.assertions(1);
    const mediaQuery = mediaFinder(
      {
        source: "Test Site",
        id: "test-getWebpage",
      },
      {
        plugins: [basicPlugin],
      }
    );
    const outputType = mediaQuery.getReturnType();

    let media = await mediaQuery.getNext();
    outputType.parse(media);
    expect(media.title).toBe("Example Domain");
  },
  1000 * 10
);
