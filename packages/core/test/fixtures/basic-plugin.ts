import {
  getWebpage,
  z,
} from "../../src/sharedSourceFunctions.js";

import { Plugin } from "@/src/schemas/plugin.js";

const sourceName = "Test Site";

const exampleFileSchema = z.object({
  type: z.literal("full"),
  url: z.string().url(),
  ext: z.string().regex(/^\w+$/),
})

const exampleMediaSchema = z.object({
  source: z.literal(sourceName),
  id: z.string(),
  title: z.string(),
  files: z.array(exampleFileSchema)
});

const exampleResponseSchema = z.object({
  page: z.object({
    paginationType: z.literal("offset"),
    pageNumber: z.number().int(),
    isLastPage: z.boolean(),
  }),
  media: z.array(exampleMediaSchema)
})

type ExampleResponse = z.infer<typeof exampleResponseSchema>

const exampleMedia: z.infer<typeof exampleMediaSchema> = {
  source: sourceName,
  id: "1234",
  title: "Media Title",
  files: []
};

const singleMediaInputSchema = z.object({
  id: z.string(),
});

const mediaSearchInputSchema = z.object({
  searchText: z.string(),
  pageNumber: z.number().optional(),
});

const basicPlugin: Plugin = {
  sources: [
    {
      name: sourceName,
      requestHandlers: [
        {
          name: "Single media",
          requestSchema: singleMediaInputSchema,
          responseSchema: exampleResponseSchema.omit({page: true}),
          paginationType: "none",
          run: getSingleMedia,
        },
        {
          name: "Search media",
          requestSchema: mediaSearchInputSchema,
          responseSchema: exampleResponseSchema,
          paginationType: "offset",
          run: getPage,
        },
      ],
    },
  ],
};

export default basicPlugin

function getPage(
  {request}: {request: z.infer<typeof mediaSearchInputSchema>}
): Promise<ExampleResponse> {
  return new Promise(resolve => resolve({
    page: {
      paginationType: "offset",
      pageNumber: request.pageNumber ?? 0,
      isLastPage: true,
    },
    media: [exampleMedia],
  }));
}

async function getSingleMedia(
  {request}: {request: z.infer<typeof singleMediaInputSchema>}
): Promise<Omit<ExampleResponse, "page">> {
  if (request.id == "test-getWebpage") {
    const $ = await getWebpage("http://example.com/");
    return {
      media: [{...exampleMedia, title: $("h1").text()}],
    }
  } else {
    return {
      media: [exampleMedia],
    };
  }
}
