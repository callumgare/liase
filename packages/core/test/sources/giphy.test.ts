import mediaFinder from "@/src/MediaFinder";

test(
  "Can get a page of gifs",
  async () => {
    expect.assertions(1);
    const gifs = await mediaFinder({
      searchText: "happy",
      source: "GIPHY",
      apiKey: process.env.GIPHY_API_KEY,
    }).getNext();
    expect(gifs.items.length).toBeGreaterThan(3);
  },
  1000 * 20
);

test(
  "Can create a query object which can be modified and iterated over",
  async () => {
    expect.assertions(2);
    const mediaQuery = mediaFinder({
      searchText: "sad",
      source: "GIPHY",
      apiKey: process.env.GIPHY_API_KEY,
      iterateBy: "media",
    });

    const firstMedia = await mediaQuery.getNext();
    const outputType = mediaQuery.getReturnType();
    outputType.parse(firstMedia);

    const secondMedia = await mediaQuery.getNext();
    outputType.parse(secondMedia);

    expect(firstMedia.id).not.toBe(secondMedia.id);

    mediaQuery.updateQuery({
      searchText: "fire",
      iterateBy: "page",
    });

    for await (const result of mediaQuery) {
      const outputType = mediaQuery.getReturnType();
      outputType.parse(result);
      expect(result.items.length).toBeGreaterThan(3);
      break;
    }
  },
  1000 * 30
);

test(
  "Can get specific gif",
  async () => {
    expect.assertions(2);
    const mediaQuery = mediaFinder({
      id: "YsTs5ltWtEhnq",
      source: "GIPHY",
      apiKey: process.env.GIPHY_API_KEY,
    });
    let media = await mediaQuery.getNext();
    const outputType = mediaQuery.getReturnType();
    outputType.parse(media);

    expect(media.id).toBe("YsTs5ltWtEhnq");
    expect(media.title).toBe("Confused Clark Kent GIF");
  },
  1000 * 20
);
