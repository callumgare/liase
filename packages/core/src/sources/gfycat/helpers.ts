import { z } from "zod";
import { createFileFromURL } from "@/src/sharedSourceFunctions.js";
import {
  gfycatFileSchema,
  GfycatMedia,
  gfycatRawAPIMediaSchema,
} from "./types.js";
import { rootUrlSite, sourceName } from "./constants.js";

export function getMediaFromGfyItem(
  gfyItem: z.infer<typeof gfycatRawAPIMediaSchema>
): GfycatMedia {
  return ({
    source: sourceName,
    id: gfyItem.gfyId,
    views: gfyItem.views,
    numberOfLikes: parseInt(gfyItem.likes.toString()),
    url: `${rootUrlSite}/${gfyItem.gfyId}`,
    dateUploaded: new Date(gfyItem.createDate * 1000),
    usernameOfUploader:
      (gfyItem.userData?.username || gfyItem.username || gfyItem.userName) as string,
    tags: gfyItem.tags || [],
    files: filesFromGfyItemFiles(gfyItem),
  });
}

function filesFromGfyItemFiles(
  gfyItem: z.infer<typeof gfycatRawAPIMediaSchema>
): z.infer<typeof gfycatFileSchema>[] {
  return [
    createFileFromURL(gfyItem.mp4Url, "full", {
      fileSize: gfyItem.mp4Size,
      width: gfyItem.width,
      height: gfyItem.height,
    }),
    createFileFromURL(gfyItem.miniUrl, "thumbnail"),
  ];
}
