import rawMimeDb from "mime-db";
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
  urlOrPath: string,
  additionalValues: AdditionalValues = {} as AdditionalValues,
): {
  url: string;
  mimeType: string;
  ext: string;
  video: boolean;
  image: boolean;
  audio?: boolean;
} & AdditionalValues {
  let url = null;
  let path: string;
  try {
    const fallbackDomain = "fallback:/";
    const urlObj = new URL(urlOrPath, fallbackDomain);
    path = urlObj.pathname;
    if (!urlObj.href.startsWith(fallbackDomain)) {
      url = urlObj.href;
    }
  } catch (error) {
    throw new Error(`Invalid URL/path: ${urlOrPath}`);
  }

  // If not given the file extension try to extract from the url/path.
  let ext = additionalValues?.ext;
  if (!ext) {
    for (const pathSegment of path.split("/").reverse()) {
      const possibleExt = pathSegment.match(/.+\.([a-zA-Z0-9]+)$/)?.[1];
      if (possibleExt && getValidMediaExtentions().includes(possibleExt)) {
        ext = possibleExt;
        break;
      }
    }
  }

  // If not given the mime type try to derive from the file extension.
  let mimeType = additionalValues?.mimeType;
  if (!mimeType && ext && typeof ext === "string") {
    mimeType = mimeTypes.lookup(ext) || "";
    if (!mimeType) {
      throw new Error(
        `Couldn't derive mime type from extension "${ext}" (url/path: ${urlOrPath})`,
      );
    }
  } else if (!ext && mimeType && typeof mimeType === "string") {
    // Incase we couldn't get the file extension from the url/path but we were given the mime type, try to derive it
    // from the mime type.
    ext = mimeTypes.extension(mimeType) || "";
    if (!ext) {
      throw new Error(
        `Couldn't derive file extension from mime type "${mimeType}" (url/path: ${urlOrPath})`,
      );
    }
  }
  if (!ext || !mimeType) {
    throw new Error(`Couldn't derive file type from url/path "${urlOrPath}"`);
  }
  const { video, image, audio } = guessBasicMediaType({ mimeType, ext });
  return {
    url: urlOrPath, // we return as `url` for backwards compatibility
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
  }
  if (coreMimeType.startsWith("image/")) {
    return {
      video: false,
      image: true,
    };
  }
  if (coreMimeType.startsWith("audio/")) {
    return {
      video: false,
      image: false,
      audio: true,
    };
  }
  if (["application/ogg"].includes(coreMimeType)) {
    throw new Error(`Unable to determine type of media: ${mimeType || ext}`);
  }
  throw new Error(`Resource does not appear to be media: ${mimeType || ext}`);
}

let _validMediaExtensions: string[] | null = null;
function getValidMediaExtentions() {
  if (!_validMediaExtensions) {
    const validMediaExtensions = [];
    for (const [mimeType, mimeInfo] of Object.entries(rawMimeDb)) {
      try {
        guessBasicMediaType({ mimeType: mimeType });
      } catch (e) {
        // Skip any mime types that don't appear to be media
        continue;
      }
      if (mimeInfo.extensions) {
        validMediaExtensions.push(...mimeInfo.extensions);
      }
    }
    _validMediaExtensions = validMediaExtensions;
  }
  return _validMediaExtensions;
}
