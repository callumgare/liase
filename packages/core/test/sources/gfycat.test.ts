import mediaFinder from '../../src/MediaFinder';

test('Can get a page of gifs', async () => {
  expect.assertions(1);
  const gifs = await mediaFinder({
    searchText: 'happy',
    source: 'Gfycat',
  }).getNext()
  expect(gifs.items.length).toBeGreaterThan(3);
}, 1000 * 20);

test('Can create a query object which can be modified and iterated over', async () => {
  expect.assertions(2);
  const mediaQuery = mediaFinder({
    searchText: 'sad',
    source: 'Gfycat',
    iterateBy: 'media'
  });
  
  const firstMedia = await mediaQuery.getNext()
  const outputType = mediaQuery.getReturnType()
  outputType.parse(firstMedia)

  const secondMedia = await mediaQuery.getNext()
  outputType.parse(secondMedia)

  expect(firstMedia.id).not.toBe(secondMedia.id);
  
  mediaQuery.updateQuery({searchText: 'fire', iterateBy: 'page'})
  
  for await (const result of mediaQuery) {
    const outputType = mediaQuery.getReturnType()
    outputType.parse(result)
    expect(result.items.length).toBeGreaterThan(3);
    break;
  }
}, 1000 * 30);

test('Can get specific gif', async () => {
  expect.assertions(3);
  const mediaQuery = mediaFinder({
    id: 'DetailedFearfulBangeltiger',
    source: 'Gfycat',
  })
  let media = await mediaQuery.getNext()
  const outputType = mediaQuery.getReturnType()
  outputType.parse(media)

  expect(media.id).toBe('detailedfearfulbangeltiger');
  expect(media.usernameOfUploader).toBe('anonymous');
  expect(media.views).toBeGreaterThan(100000)
}, 1000 * 20);