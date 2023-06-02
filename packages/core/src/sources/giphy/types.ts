import {z} from "zod"

import { createFileSchema } from "@/src/schemas/file";
import { createMediaSchema } from "@/src/schemas/media";
import { createPageSchema } from "@/src/schemas/page";

export const giphyFileSchema = createFileSchema({
  required: ["url", "ext", "mimeType", "video", "image"],
  optional: ["fileSize", "width", "height"],
});

export const giphyMediaSchema = createMediaSchema({
  fileSchema: giphyFileSchema,
  required: [
    "title",
    "usernameOfUploader",
    "dateUploaded",
  ],
  optional: []
})

export const giphyPageOfMediaSchema = createPageSchema({
  paginationType: "cursor",
  itemsSchema: giphyMediaSchema,
  required: ["url", "totalItems", "hasNext"],
  optional: []
});

export type GiphyPageOfMedia = z.infer<typeof giphyPageOfMediaSchema>
