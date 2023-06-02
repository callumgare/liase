import { z } from "zod";
import { createFileFromURL } from "@/src/sharedSourceFunctions";
import {
  gfycatFileSchema,
  gfycatMediaSchema,
  gfycatRawAPIMediaSchema,
} from "./types";
import { rootUrlSite, sourceName } from "./constants";

export function getMediaFromGfyItem(
  gfyItem: z.infer<typeof gfycatRawAPIMediaSchema>
): z.infer<typeof gfycatMediaSchema> {
  return gfycatMediaSchema.parse({
    source: sourceName,
    meta: {
      type: "media",
    },
    id: gfyItem.gfyId,
    views: gfyItem.views,
    numberOfLikes: parseInt(gfyItem.likes.toString()),
    url: `${rootUrlSite}/${gfyItem.gfyId}`,
    dateUploaded: new Date(gfyItem.createDate * 1000),
    usernameOfUploader:
      gfyItem.userData?.username || gfyItem.username || gfyItem.userName,
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
