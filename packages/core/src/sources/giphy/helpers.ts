import { z } from "zod";

import { createFileFromURL } from "@/src/sharedSourceFunctions";
import {
  giphyFileSchema,
  giphyMediaSchema,
} from "./types";
import { sourceName } from "./constants";

export function getMediaFromGifItem(giphyItem): z.infer<typeof giphyMediaSchema> {
  return {
    source: sourceName,
    meta: {
      type: "media",
    },
    id: giphyItem.id,
    title: giphyItem.title,
    url: giphyItem.url,
    dateUploaded: new Date(giphyItem.import_datetime + "Z"),
    usernameOfUploader: giphyItem.username,
    files: filesFromGiphyItemFiles(giphyItem),
  };
}

function filesFromGiphyItemFiles(giphyItem): z.infer<typeof giphyFileSchema>[] {
  return [
    createFileFromURL(giphyItem.images.original_mp4.mp4, "full", {
      fileSize: parseInt(giphyItem.images.original_mp4.mp4_size),
      width: parseInt(giphyItem.images.original_mp4.width),
      height: parseInt(giphyItem.images.original_mp4.height),
    }),
    createFileFromURL(giphyItem.images.preview.mp4, "thumbnail", {
      fileSize: parseInt(giphyItem.images.preview.mp4_size),
      width: parseInt(giphyItem.images.preview.width),
      height: parseInt(giphyItem.images.preview.height),
    }),
  ];
}
