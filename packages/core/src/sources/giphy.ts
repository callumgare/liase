import Giphy from 'giphy-api'
import {
  createFileFromURL,
  mediaSchema,
  fileSchema,
  getPageSchema,
  z
} from '../sharedSourceFunctions.js'

const sourceName = 'GIPHY'

const giphyFileSchema = fileSchema.pick({
  type: true,
  url: true,
  ext: true,
  mimeType: true,
  kind: true,
  video: true,
  image: true,
  fileSize: true,
  width: true,
  height: true
})

const giphyMediaSchema = mediaSchema.pick({
  source: true,
  type: true,
  id: true,
  title: true,
  url: true,
  usernameOfUploader: true,
  dateUploaded: true
}).extend({
  files: z.array(giphyFileSchema)
})

const giphyPageOfMediaSchema = getPageSchema(giphyMediaSchema).pick({
  source: true,
  type: true,
  cursor: true,
  items: true,
  totalItems: true,
  isNext: true
})

const singleMediaInputSchema = z.object({
  id: z.string(),
  apiKey: z.string().optional()
})

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  apiKey: z.string().optional(),
  cursor: z.number().optional()
})

export default {
  name: sourceName,
  capabilities: [
    {
      name: 'Single media',
      inputType: singleMediaInputSchema,
      run: getSingleMedia,
      outputType: giphyMediaSchema
    },
    {
      name: 'Media search',
      inputType: mediaSearchInputSchema,
      pagination: 'cursor',
      run: getSearch,
      outputType: giphyPageOfMediaSchema
    }
  ]
}

async function getSingleMedia (query: z.infer<typeof singleMediaInputSchema>) {
  if (!query.apiKey) {
    throw new Error('API key needed to search Giphy')
  }
  const giphy = Giphy(query.apiKey)
  const res = await giphy.id(query.id)
  return getMediaFromGifItem(res.data[0])
}

async function getSearch (query: z.infer<typeof mediaSearchInputSchema>): Promise<z.infer<typeof giphyPageOfMediaSchema>> {
  if (!query.apiKey) {
    throw new Error('API key needed to search Giphy')
  }
  const giphy = Giphy(query.apiKey)
  const res = await giphy.search({
    q: query.searchText,
    limit: 10,
    rating: 'g',
    offset: query.cursor
  })

  return {
    source: sourceName,
    type: 'page',
    items: res.data.map(gif => getMediaFromGifItem(gif)),
    cursor: res.pagination.offset + res.pagination.count,
    totalItems: res.pagination.total_count,
    isNext: (res.pagination.count + res.pagination.offset) < res.pagination.total_count
  }
}

function getMediaFromGifItem (giphyItem): z.infer<typeof giphyMediaSchema> {
  return {
    source: sourceName,
    type: 'media',
    id: giphyItem.id,
    title: giphyItem.title,
    url: giphyItem.url,
    dateUploaded: new Date(giphyItem.import_datetime + 'Z'),
    usernameOfUploader: giphyItem.username,
    files: filesFromGiphyItemFiles(giphyItem)
  }
}

function filesFromGiphyItemFiles (giphyItem): z.infer<typeof giphyFileSchema>[] {
  return [
    createFileFromURL(giphyItem.images.original_mp4.mp4, 'full', {
      fileSize: parseInt(giphyItem.images.original_mp4.mp4_size),
      width: parseInt(giphyItem.images.original_mp4.width),
      height: parseInt(giphyItem.images.original_mp4.height)
    }),
    createFileFromURL(giphyItem.images.preview.mp4, 'thumbnail', {
      fileSize: parseInt(giphyItem.images.preview.mp4_size),
      width: parseInt(giphyItem.images.preview.width),
      height: parseInt(giphyItem.images.preview.height)
    })
  ]
}
