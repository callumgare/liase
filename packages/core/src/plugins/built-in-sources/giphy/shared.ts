import type { Constructor } from "@/src/schemas/constructor.js";

export const sourceId = "giphy";

export const mediaResponseConstructor = [
  {
    _arrayMap: ($) => $().data,
    liaseSource: sourceId,
    id: ($) => $().id,
    title: ($) => $().title,
    url: ($) => $().url,
    dateUploaded: ($) => new Date(`${$().import_datetime}Z`),
    usernameOfUploader: ($) => $().username,
    files: [
      {
        _arrayMap: ($) => [
          { ...$().images.original, liaseType: "full" },
          { ...$().images.preview, liaseType: "thumbnail" },
        ],
        _setup: ($) => $.set("mediaInfo", $.guessMediaInfoFromUrl($().mp4)),
        type: ($) => $().liaseType,
        url: ($) => $().mp4,
        ext: ($) => $("mediaInfo").ext,
        mimeType: ($) => $("mediaInfo").mimeType,
        image: ($) => $("mediaInfo").image,
        video: ($) => $("mediaInfo").video,
        fileSize: ($) => Number.parseInt($().mp4_size),
        width: ($) => Number.parseInt($().width),
        height: ($) => Number.parseInt($().height),
      },
    ],
  },
] satisfies Constructor;
