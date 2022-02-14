import {
  fetchJSON,
  mediaSchema,
  fileSchema,
  getPageSchema,
  z
} from 'media-finder/dist/sharedSourceFunctions.js'

const rootUrlApi = 'https://jsonplaceholder.typicode.com'
const sourceName = 'JSONPlaceholder'

const gfycatFileSchema = fileSchema.pick({
  type: true,
  url: true,
  kind: true,
  video: true,
  image: true
})

const jsonPlaceholderMediaSchema = mediaSchema.pick({
  source: true,
  type: true,
  id: true,
  title: true
}).extend({
  files: z.array(gfycatFileSchema)
})

const jsonPlaceholderPageOfMediaSchema = getPageSchema(jsonPlaceholderMediaSchema).pick({
  source: true,
  type: true,
  url: true,
  items: true,
  isNext: true
})

const singleMediaInputSchema = z.object({
  id: z.string()
})

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  page: z.string().optional()
})

export default {
  name: sourceName,
  capabilities: [
    {
      name: 'Single media',
      inputType: singleMediaInputSchema,
      run: getSingleMedia,
      outputType: jsonPlaceholderMediaSchema
    },
    {
      name: 'Media search',
      inputType: mediaSearchInputSchema,
      pagination: 'number',
      run: getSearch,
      outputType: jsonPlaceholderPageOfMediaSchema
    }
  ]
}

async function getSingleMedia (query: z.infer<typeof singleMediaInputSchema>) {
  const url = `${rootUrlApi}/photos/${query.id}`
  const res = await fetchJSON(url)
  return getMediaFromPhoto(res.data)
}

async function getSearch (query: z.infer<typeof mediaSearchInputSchema>): Promise<z.infer<typeof jsonPlaceholderPageOfMediaSchema>> {
  const url = `${rootUrlApi}/photos?q=${query.searchText}&_page=${query.page}&_limit=10`
  const res = await fetchJSON(url)

  let link
  if (res.headers.link) {
    link = Object.fromEntries(
      res.headers.link.split(',').map(linkLink => [
        linkLink.match(/rel="(\w+)"/)?.[1],
        linkLink.match(/_page=(\d+)/)?.[1]
      ])
    )
  }

  return {
    source: sourceName,
    type: 'page',
    url,
    items: res.data.map(photo => getMediaFromPhoto(photo)),
    isNext: Boolean(link?.next)
  }
}

function getMediaFromPhoto (photo): z.infer<typeof jsonPlaceholderMediaSchema> {
  return {
    source: sourceName,
    type: 'media',
    id: String(photo.id),
    title: photo.title,
    files: filesFromPhoto(photo)
  }
}

function filesFromPhoto (photo): z.infer<typeof gfycatFileSchema>[] {
  return [
    {
      type: 'file',
      url: photo.url,
      kind: 'full',
      video: false,
      image: true
    },
    {
      type: 'file',
      url: photo.thumbnailUrl,
      kind: 'thumbnail',
      video: false,
      image: true
    }
  ]
}
