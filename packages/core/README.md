> :warning: **This package is currently experimental and the API is both poorly document and likely to change**

# Media Finder

Media Finder attempts to provide a consistent API to search for, and pull the metadata of, various types of media (images, video, gifs, etc) from a variety of sites and sources.

## Search

```js
import mediaFinder from 'media-finder';
// Or if you're using CommonJS for modules:
// const MediaFinder = require('media-finder');

// Self-executing async function is used here simply to enable the use of await.
;(async () => {
  // Search and return immediately the first page of results
  const gifs = await mediaFinder({
    source: 'GIPHY',
    searchText: 'cheese',
  }).getNext()
  // Prints the number of results in the first page
  console.log(`Got ${gifs.items.length} gifs`);

  // Alternatively create a query object which can be modified and iterated over
  const mediaQuery = mediaFinder({
    source: 'GIPHY',
    searchText: 'cheese',
    iterateBy: 'media',
  });

  let result = await mediaQuery.getNext()
  console.log(`Title of first result: ${result.title}`)

  result = await mediaQuery.getNext()
  console.log(`Title of first result: ${result.title}`)

  mediaQuery.updateQuery({searchText: 'cake'})

  const media = []

  for await (const result of mediaQuery) {
    media.push(result)
  }

  console.log(`Got ${media.length} results`);
})()
```