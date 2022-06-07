import {
  getWebpage,
  mediaSchema,
  getPageSchema,
  z
} from '../../src/sharedSourceFunctions';

const sourceName = 'Test Site'

const exampleMedia = {
  source: sourceName,
  type: 'media',
  id: '1234',
  title: 'Media Title',
} as const;

const exampleMediaSchema = mediaSchema.pick({
  source: true,
  type: true,
  id: true,
  title: true,
});

const examplePageOfMediaSchema = getPageSchema(exampleMediaSchema).pick({
  source: true,
  type: true,
  number: true,
  items: true,
  isNext: true,
})

const singleMediaInputSchema = z.object({
  id: z.string()
})

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  page: z.number().optional()
})

export default {
  sources: [
    {
      name: sourceName,
      capabilities: [
        {
          name: "Single media",
          inputType: singleMediaInputSchema,
          run: getSingleMedia,
          outputType: exampleMediaSchema,
        },
        {
          name: "Search media",
          inputType: mediaSearchInputSchema,
          pagination: 'number',
          run: getPage,
          outputType: examplePageOfMediaSchema,
        }
      ]
    }
  ]
}

function getPage(query: z.infer<typeof mediaSearchInputSchema>): z.infer<typeof examplePageOfMediaSchema> {
  return {
    source: 'example plugin',
    type: 'page',
    items: [exampleMedia],
    number: query.page,
    isNext: false,
  }
}

async function getSingleMedia(query: z.infer<typeof singleMediaInputSchema>): Promise<z.infer<typeof exampleMediaSchema>> {
  if (query.id == 'test-getWebpage') {
    const $ = await getWebpage('http://example.com/')
    return {
      ...exampleMedia,
      title: $('h1').text()
    }
  } else {
    return exampleMedia
  }
}
