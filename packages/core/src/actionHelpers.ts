import mimeTypes from "mime-types";

export function guessMediaInfoFromUrl(
  url: string,
  additionalValues: Record<string, any> = {},
) {
  let ext = additionalValues?.ext || url.match(/\.(\w+)(?:\?[^?]*)?$/)?.[1];
  let mimeType = additionalValues?.mimeType;
  if (!mimeType && ext && typeof ext === "string") {
    mimeType = mimeTypes.lookup(ext) || "";
  } else if (!ext && mimeType && typeof mimeType === "string") {
    ext = mimeTypes.extension(mimeType) || "";
  }
  if (!ext || !mimeType) {
    console.info(`url: ${url}\next: ${ext}\nmimeType: ${mimeType}`);
    throw new Error("Couldn't derive file type");
  }
  let video, image;
  if (
    mimeType.match(/^video\//) ||
    ext.match(/^gif$/i) ||
    mimeType === "application/vnd.apple.mpegurl"
  ) {
    video = true;
    image = false;
  } else if (mimeType.match(/^image\//)) {
    video = false;
    image = true;
  } else {
    throw new Error(`Media type not valid: ${mimeType}`);
  }
  return {
    url,
    ext,
    mimeType,
    video,
    image,
    ...additionalValues,
  };
}
