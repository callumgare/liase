import mediaFinder from 'media-finder';
import examplePlugin from '../../src/index.js'

const sourceName = 'JSONPlaceholder'

test('Can get a page of gifs', async () => {
  expect.assertions(1);
  const media = await mediaFinder({
    searchText: 'vero',
    source: sourceName,
  }, {
    plugins: [examplePlugin]
  }).getNext()
  expect(media.items.length).toBeGreaterThan(3);
}, 1000 * 20);

test('Can create a query object which can be modified and iterated over', async () => {
  expect.assertions(2);
  const mediaQuery = mediaFinder({
    searchText: 'totam',
    source: sourceName,
    iterateBy: 'media'
  }, {
    plugins: [examplePlugin]
  });
  
  const firstMedia = await mediaQuery.getNext()
  const outputType = mediaQuery.getReturnType()
  outputType.parse(firstMedia)

  const secondMedia = await mediaQuery.getNext()
  outputType.parse(secondMedia)

  expect(firstMedia.id).not.toBe(secondMedia.id);
  
  mediaQuery.updateQuery({searchText: 'est', iterateBy: 'page'})
  
  for await (const result of mediaQuery) {
    const outputType = mediaQuery.getReturnType()
    outputType.parse(result)
    expect(result.items.length).toBeGreaterThan(3);
    break;
  }
}, 1000 * 30);

test('Can get specific gif', async () => {
  expect.assertions(2);
  const mediaQuery = mediaFinder({
    id: '34',
    source: sourceName,
  }, {
    plugins: [examplePlugin]
  })
  let media = await mediaQuery.getNext()
  const outputType = mediaQuery.getReturnType()
  outputType.parse(media)

  expect(media.id).toBe('34');
  expect(media.title).toBe(	"vitae est facere quia itaque adipisci perferendis id maiores");
}, 1000 * 20);