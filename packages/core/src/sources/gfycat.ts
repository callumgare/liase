import fetch from 'node-fetch'

import {
  createFileFromURL,
  mediaSchema,
  fileSchema,
  getPageSchema,
  z
} from '../sharedSourceFunctions.js'

const rootUrlApi = 'https://api.gfycat.com/v1'
const rootUrlSite = 'https://gfycat.com'
const sourceName = 'Gfycat'

const gfycatFileSchema = fileSchema.pick({
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
}).partial({
  fileSize: true,
  width: true,
  height: true
})

const gfycatMediaSchema = mediaSchema.pick({
  source: true,
  type: true,
  id: true,
  url: true,
  usernameOfUploader: true,
  views: true,
  numberOfLikes: true,
  dateUploaded: true,
  tags: true
}).extend({
  files: z.array(gfycatFileSchema)
})

const gfycatPageOfMediaSchema = getPageSchema(gfycatMediaSchema).pick({
  source: true,
  type: true,
  cursor: true,
  url: true,
  items: true,
  totalItems: true,
  isNext: true
}).extend({
  cursor: z.string().describe('')
})

const singleMediaInputSchema = z.object({
  id: z.string()
})

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  cursor: z.string().optional()
})

export default {
  name: sourceName,
  capabilities: [
    {
      name: 'Single media',
      inputType: singleMediaInputSchema,
      run: getSingleMedia,
      outputType: gfycatMediaSchema
    },
    {
      name: 'Media search',
      inputType: mediaSearchInputSchema,
      pagination: 'cursor',
      run: getSearch,
      outputType: gfycatPageOfMediaSchema
    }
  ]
}

async function getSingleMedia (query: z.infer<typeof singleMediaInputSchema>) {
  const url = `${rootUrlApi}/gfycats/${query.id}`
  const res = await fetch(url).then(res => res.json())
  return getMediaFromGfyItem(res.gfyItem)
}

async function getSearch (query: z.infer<typeof mediaSearchInputSchema>): Promise<z.infer<typeof gfycatPageOfMediaSchema>> {
  const url = `${rootUrlApi}/gfycats/search?search_text=${query.searchText}${query.cursor ? `&cursor=${query.cursor}` : ''}&count=10&order=trending&type=g`
  const res = await fetch(url).then(res => res.json())

  return {
    source: sourceName,
    type: 'page',
    url,
    items: res.gfycats.map(gfyItem => getMediaFromGfyItem(gfyItem)),
    cursor: res.cursor,
    totalItems: res.found,
    isNext: Boolean(res.cursor)
  }
}

function getMediaFromGfyItem (gfyItem): z.infer<typeof gfycatMediaSchema> {
  return {
    source: sourceName,
    type: 'media',
    id: gfyItem.gfyId,
    views: gfyItem.views,
    numberOfLikes: parseInt(gfyItem.likes),
    url: `${rootUrlSite}/${gfyItem.gfyId}`,
    dateUploaded: new Date(gfyItem.createDate * 1000),
    usernameOfUploader: gfyItem.userData?.username || gfyItem.username || gfyItem.userName,
    tags: gfyItem.tags || [],
    files: filesFromGfyItemFiles(gfyItem)
  }
}

function filesFromGfyItemFiles (gfyItem): z.infer<typeof gfycatFileSchema>[] {
  return [
    createFileFromURL(gfyItem.mp4Url, 'full', {
      fileSize: gfyItem.mp4Size,
      width: gfyItem.width,
      height: gfyItem.height
    }),
    createFileFromURL(gfyItem.miniUrl, 'thumbnail')
  ]
}
