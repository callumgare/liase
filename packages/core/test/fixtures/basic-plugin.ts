import {
  getWebpage,
  z,
} from "../../src/sharedSourceFunctions.js";

import {createFileSchema} from "@/src/schemas/file"
import {createMediaSchema} from "@/src/schemas/media"
import {createPageSchema} from "@/src/schemas/page"

const sourceName = "Test Site";

const exampleFileSchema = createFileSchema({
  required: ["url", "ext"],
  optional: []
})

const exampleMediaSchema = createMediaSchema({
  fileSchema: exampleFileSchema,
  required: ["title"],
  optional: [],
});

const examplePageOfMediaSchema = createPageSchema({
  paginationType: "offset",
  itemsSchema: exampleMediaSchema,
  required: ["hasNext"],
  optional: [],
})

const exampleMedia: z.infer<typeof exampleMediaSchema> = {
  meta: {
    type: "media"
  },
  url: "https://example.com",
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
  page: z.number().optional(),
});

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
          pagination: "number",
          run: getPage,
          outputType: examplePageOfMediaSchema,
        },
      ],
    },
  ],
};

function getPage(
  query: z.infer<typeof mediaSearchInputSchema>
): z.infer<typeof examplePageOfMediaSchema> {
  return {
    paginationType: "offset",
    meta: {
      type: "page"
    },
    source: "example plugin",
    items: [exampleMedia],
    number: query.page ?? 0,
    hasNext: false,
  };
}

async function getSingleMedia(
  query: z.infer<typeof singleMediaInputSchema>
): Promise<z.infer<typeof exampleMediaSchema>> {
  if (query.id == "test-getWebpage") {
    const $ = await getWebpage("http://example.com/");
    return {
      ...exampleMedia,
      title: $("h1").text(),
    };
  } else {
    return exampleMedia;
  }
}
