import { z } from "zod";
import { createFileSchema } from "@/src/schemas/file";
import { createMediaSchema } from "@/src/schemas/media";
import { createPageSchema } from "@/src/schemas/page";

const fileSchema = createFileSchema ({
  required: ["url", "ext", "mimeType", "video", "image"],
  optional: ["fileSize", "width", "height"],
});

export const mediaSchema = createMediaSchema({
  fileSchema: fileSchema,
  required: [
    "usernameOfUploader",
    "views",
    "numberOfLikes",
    "dateUploaded",
    "tags",
  ],
  optional: [],
});

export const cursorPageOfMediaSchema = createPageSchema({
  paginationType: "cursor",
  itemsSchema: mediaSchema,
  required: ["url", "totalItems", "hasNext"],
  optional: [],
  extend: {
    extraProp: z.string(),
  },
});

const media: z.infer<typeof mediaSchema> = {
  url: "string",
  usernameOfUploader: "string",
  views: 42,
  numberOfLikes: 42,
  dateUploaded: new Date(),
  tags: ["string"],
  meta: {
    type: "media",
  },
  source: "string",
  id: "string",
  files: [
    {
      type: "file",
      kind: "full",
      url: "blar",
      ext: "blar",
      mimeType: "string",
      video: true,
      image: true,
      fileSize: 42
    }
  ],
}

const cursorPage: z.infer<typeof cursorPageOfMediaSchema> = {
  cursor: 42,
  paginationType: "cursor",
  url: "string",
  meta: {
      type: "page",
  },
  source: "string",
  totalItems: 1,
  hasNext: true,
  items: [
    media
  ],
  extraProp: "string",
}

// @ts-expect-error
const cursorPageWithoutExtraProp: z.infer<typeof cursorPageOfMediaSchema> = {
  cursor: 42,
  paginationType: "cursor",
  url: "string",
  meta: {
      type: "page",
  },
  source: "string",
  totalItems: 1,
  hasNext: true,
  items: [
    media
  ]
}

export const offsetPageOfMediaSchema = createPageSchema({
  paginationType: "offset",
  itemsSchema: mediaSchema,
  required: ["url", "totalItems", "hasNext"],
  optional: [],
});

const offsetPage: z.infer<typeof offsetPageOfMediaSchema> = {
  number: 42,
  paginationType: "offset",
  url: "string",
  meta: {
      type: "page",
  },
  source: "string",
  totalItems: 1,
  hasNext: true,
  items: [
    media
  ]
}

const offsetPageWithCursorProp: z.infer<typeof offsetPageOfMediaSchema> = {
  paginationType: "offset",
  url: "string",
  meta: {
      type: "page",
  },
  source: "string",
  totalItems: 1,
  hasNext: true,
  // @ts-expect-error
  cursor: "string",
  items: [
    media
  ]
}


const offsetPageWithCursorPageData: z.infer<typeof offsetPageOfMediaSchema> = {
  // @ts-expect-error
  paginationType: "cursor",
  cursor: "string",
  url: "string",
  meta: {
      type: "page",
  },
  source: "string",
  totalItems: 1,
  hasNext: true,
  items: [
    media
  ]
}
