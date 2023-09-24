import { GIFObject } from "giphy-api";

import { createFileFromURL } from "@/src/sharedSourceFunctions.js";
import {
  GiphyFile,
  GiphyMedia,
} from "./types.js";
import { sourceName } from "./constants.js";

export function getMediaFromGifItem(giphyItem: GIFObject): GiphyMedia {
  return {
    source: sourceName,
    id: giphyItem.id,
    title: giphyItem.title,
    url: giphyItem.url,
    dateUploaded: new Date(giphyItem.import_datetime + "Z"),
    usernameOfUploader: giphyItem.username,
    files: filesFromGiphyItemFiles(giphyItem),
  };
}

function filesFromGiphyItemFiles(giphyItem: GIFObject): GiphyFile[] {
  return [
    createFileFromURL(giphyItem.images.original.mp4, "full", {
      fileSize: parseInt(giphyItem.images.original.mp4_size),
      width: parseInt(giphyItem.images.original.width),
      height: parseInt(giphyItem.images.original.height),
    }),
    createFileFromURL(giphyItem.images.preview.mp4, "thumbnail", {
      fileSize: parseInt(giphyItem.images.preview.mp4_size),
      width: parseInt(giphyItem.images.preview.width),
      height: parseInt(giphyItem.images.preview.height),
    }),
  ];
}
