import { createMediaFinderQuery } from "@/src/index.js";

test(
  "Can get a page of gifs",
  async () => {
    expect.assertions(1);
    const gifs = await createMediaFinderQuery({
      request: {
        source: "GIPHY",
        queryType: "Search",
        searchText: "happy",
      },
      queryOptions: {
        secrets: {
          apiKey: process.env.GIPHY_API_KEY,
        }
      }
    }).getNext();
    expect(gifs?.media.length).toBeGreaterThan(3);
  },
  1000 * 20
);

test(
  "Can create a query object which can be modified and iterated over",
  async () => {
    expect.assertions(2);
    const mediaQuery = createMediaFinderQuery({
      request: {
        source: "GIPHY",
        queryType: "Search",
        searchText: "sad",
      },
      queryOptions: {
        secrets: {
          apiKey: process.env.GIPHY_API_KEY,
        }
      }
    });

    const firstPage = await mediaQuery.getNext();
    const responseSchema = mediaQuery.getResponseSchema();
    responseSchema.parse(firstPage);

    const secondPage = await mediaQuery.getNext();
    responseSchema.parse(secondPage);

    expect(firstPage?.page?.paginationType === "cursor" && firstPage.page.cursor)
      .not.toBe(secondPage?.page?.paginationType === "cursor" && secondPage?.page.cursor);

    mediaQuery.request = { ...mediaQuery.request, searchText: "fire" };

    for await (const result of mediaQuery) {
      const responseSchema = mediaQuery.getResponseSchema();
      responseSchema.parse(result);
      expect(result.media.length).toBeGreaterThan(3);
      break;
    }
  },
  1000 * 30
);

test(
  "Can get specific gif",
  async () => {
    expect.assertions(2);
    const mediaQuery = createMediaFinderQuery({
      request: {
        source: "GIPHY",
        queryType: "Single media",
        id: "YsTs5ltWtEhnq",
      },
      queryOptions: {
        secrets: {
          apiKey: process.env.GIPHY_API_KEY,
        }
      }
    });
    let response = await mediaQuery.getNext();
    const responseSchema = mediaQuery.getResponseSchema();
    responseSchema.parse(response);

    expect(response?.media[0].id).toBe("YsTs5ltWtEhnq");
    expect(response?.media[0].title).toBe("Confused Clark Kent GIF");
  },
  1000 * 20
);
