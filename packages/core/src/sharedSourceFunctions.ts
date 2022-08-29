import Cheerio from 'cheerio'
import fetch from 'node-fetch'
import mimeTypes from 'mime-types'
import { z } from 'zod'
export { z }

export async function getWebpage (url) {
  return getWebpageWithFetch(url)
}

export function createFileFromURL (url: string, kind: string, additionalValues?: any) {
  let ext = additionalValues?.ext || url.match(/\.(\w+)(?:\?[^?]*)?$/)?.[1]
  let mimeType = additionalValues?.mimeType
  if (ext && !mimeType) {
    mimeType = mimeTypes.lookup(ext)
  } else if (mimeType && !ext) {
    ext = mimeTypes.extension(mimeType)
  }
  if (!ext || !mimeType) {
    console.info(`url: ${url}\next: ${ext}\nmimeType: ${mimeType}`)
    throw new Error('Couldn\'t derive file type')
  }
  let video, image
  if (mimeType.match(/^video\//) || ext.match(/^gif$/i) || mimeType === 'application/vnd.apple.mpegurl') {
    video = true
    image = false
  } else if (mimeType.match(/^image\//)) {
    video = false
    image = true
  } else {
    throw new Error(`Media type not valid: ${mimeType}`)
  }
  return {
    type: 'file',
    url,
    ext,
    mimeType,
    kind,
    video,
    image,
    ...additionalValues
  }
}

async function getWebpageWithFetch (url) {
  try {
    const body = await fetch(url).then(res => res.text())
    return Cheerio.load(body)
  } catch (error) {
    console.error('Failed when trying to load: ' + url)
    throw error
  }
}

export const fileSchema = z.object({
  type: z.literal('file')
    .describe(''),
  url: z.string().url()
    .describe(''),
  ext: z.string().regex(/^\w+$/)
    .describe(''),
  mimeType: z.string()
    .describe(''),
  kind: z.enum(['full', 'thumbnail'])
    .describe(''),
  image: z.boolean(),
  video: z.boolean(),
  audio: z.boolean(),
  fileSize: z.number().int(),
  width: z.number().int(),
  height: z.number().int()
})

export const mediaSchema = z.object({
  source: z.string()
    .describe('The name of the source where the media was found'),
  type: z.literal('media')
    .describe('The type of this returned object'),
  id: z.string()
    .describe('The ID value used to identify a media. This value will be unique amount the other media available from the source but two media from different sources could possibly share the same id.'),
  url: z.string().url()
    .describe(''),
  usernameOfUploader: z.string()
    .describe('The username of the account which uploaded the media to the source (not necessarily the same as the person who created the media).'),
  usernameOfCreator: z.string()
    .describe('The username of the account responsible for creating the media to the source (not necessarily the same as the person who uploaded the media to the source).'),
  title: z.string()
    .describe('The title of the media'),
  tags: z.array(z.string())
    .describe(''),
  views: z.number().int()
    .describe('The number times this media has been viewed'),
  numberOfLikes: z.number().int()
    .describe('The number of times this media has been liked.'),
  numberOfDislikes: z.number().int()
    .describe(''),
  percentOfLikes: z.number()
    .describe('The percentage of likes to dislikes that this media has received'),
  dateUploaded: z.date()
    .describe('The date that the media was uploaded'),
  relativeDateUploaded: z.string()
    .describe('The relative time since the media was uploaded. e.g. "Two weeks ago"'),
  description: z.string()
    .describe('A description supplied with the media'),
  duration: z.number()
    .describe('The play time of the media in seconds'),
  files: z.array(fileSchema)
})

export const getPageSchema = (objectType) => z.object({
  source: z.string()
    .describe('The name of the source where the media was found'),
  type: z.literal('page')
    .describe('The type of this returned object'),
  page: z.number().int(),
  totalPages: z.number().int(),
  cursor: z.number().int()
    .describe(''),
  number: z.number().int()
    .describe(''),
  url: z.string().url(),
  items: z.array(objectType),
  totalItems: z.number().int()
    .describe('Total items found not just on this page but the sum of items from all pages.'),
  hasNext: z.boolean()
})
