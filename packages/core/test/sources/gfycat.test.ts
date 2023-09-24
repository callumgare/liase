import { createMediaFinderQuery } from "@/src/index.js";

test(
  "Can get a page of gifs",
  async () => {
    expect.assertions(1);
    const gifs = await createMediaFinderQuery({
      request: {
        source: "Gfycat",
        queryType: "Search",
        searchText: "happy",
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
        source: "Gfycat",
        queryType: "Search",
        searchText: "sad",
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
    expect.assertions(3);
    const mediaQuery = createMediaFinderQuery({
      request: {
        source: "Gfycat",
        queryType: "Single media",
        id: "DetailedFearfulBangeltiger",
      }
    });
    let response = await mediaQuery.getNext();
    const responseSchema = mediaQuery.getResponseSchema();
    responseSchema.parse(response);

    expect(response?.media[0].id).toBe("detailedfearfulbangeltiger");
    expect(response?.media[0].usernameOfUploader).toBe("anonymous");
    expect(response?.media[0].views).toBeGreaterThan(100000);
  },
  1000 * 20
);
