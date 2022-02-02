import mediaFinder from '../src/MediaFinder';
import basicPlugin from './fixtures/basic-plugin'

test('Get media', async () => {
  expect.assertions(2);
  const mediaQuery = mediaFinder({});
  mediaQuery.loadPlugin(basicPlugin);
  mediaQuery.query = {
    source: 'Test Site',
    searchText: 'search text'
  }
  const outputType = mediaQuery.getReturnType()

  let page = await mediaQuery.getNext()
  outputType.parse(page)
  expect(page.items[0].title).toBeTruthy();
  expect(page.number).toBe(1);
});

test('Use getWebsite shared function', async () => {
  expect.assertions(1);
  const mediaQuery = mediaFinder({});
  mediaQuery.loadPlugin(basicPlugin);
  mediaQuery.query = {
    source: 'Test Site',
    id: 'test-getWebpage'
  }
  const outputType = mediaQuery.getReturnType()
  
  let media = await mediaQuery.getNext()
  outputType.parse(media)
  expect(media.title).toBe('Example Domain');
}, 1000 * 10);