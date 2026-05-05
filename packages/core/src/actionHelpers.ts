import mimeTypes from "mime-types";

export function guessMediaInfoFromUrl<
  AdditionalValues extends {
    [key: string]: unknown;
    mimeType?: string;
    ext?: string;
    video?: boolean;
    image?: boolean;
    audio?: boolean;
  },
>(
  url: string,
  additionalValues: AdditionalValues = {} as AdditionalValues,
): {
  url: string;
  mimeType: string;
  ext: string;
  video: boolean;
  image: boolean;
  audio?: boolean;
} & AdditionalValues {
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
  const { video, image, audio } = guessBasicMediaType({ mimeType, ext });
  return {
    url,
    ext,
    mimeType,
    video,
    image,
    audio,
    ...(additionalValues || {}),
  };
}

export function guessMediaInfoFromMimeType<
  AdditionalValues extends {
    [key: string]: unknown;
    url?: string;
    ext?: string;
    video?: boolean;
    image?: boolean;
    audio?: boolean;
  },
>(
  mimeType: string,
  additionalValues: AdditionalValues = {} as AdditionalValues,
): {
  mimeType: string;
  ext: string;
  video: boolean;
  image: boolean;
  audio?: boolean;
} & AdditionalValues {
  const ext = mimeTypes.extension(mimeType) || "";
  const { video, image, audio } = guessBasicMediaType({ mimeType, ext });
  return {
    ext,
    mimeType,
    video,
    image,
    audio,
    ...additionalValues,
  };
}

function guessBasicMediaType({
  mimeType,
  ext,
}: {
  mimeType?: string;
  ext?: string;
}) {
  const coreMimeType = mimeType?.split(";")[0].trim().toLowerCase() || "";
  const coreExt = ext?.trim().toLowerCase() || "";
  if (
    coreMimeType.startsWith("video/") ||
    [
      "application/x-mpegurl",
      "application/vnd.apple.mpegurl",
      "application/mp4",
      "application/mpeg4-generic",
      "application/dash+xml",
      "application/dash-patch+xml",
    ].includes(coreMimeType) ||
    coreExt === "gif"
  ) {
    return {
      video: true,
      image: false,
    };
  } else if (coreMimeType.startsWith("image/")) {
    return {
      video: false,
      image: true,
    };
  } else if (coreMimeType.startsWith("audio/")) {
    return {
      video: false,
      image: false,
      audio: true,
    };
  } else if (["application/ogg"].includes(coreMimeType)) {
    throw new Error(`Unable to determine type of media: ${mimeType || ext}`);
  } else {
    throw new Error(`Resource does not appear to be media: ${mimeType || ext}`);
  }
}
