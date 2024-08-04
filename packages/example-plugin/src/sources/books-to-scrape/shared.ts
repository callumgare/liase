import { type Constructor } from "media-finder/dist/schemas/constructor.js";

export const sourceId = "books-to-scrape";
export const rootUrl = "https://books.toscrape.com/";

export const mediaResponseConstructor = [
  {
    _arrayMap: ($) => $().data,
    mediaFinderSource: sourceId,
    id: ($) => $().id,
    title: ($) => $().title,
    url: ($) => $().url,
    dateUploaded: ($) => new Date($().import_datetime + "Z"),
    usernameOfUploader: ($) => $().username,
    files: [
      {
        _arrayMap: ($) => [
          { ...$().images.original, mediaFinderType: "full" },
          { ...$().images.preview, mediaFinderType: "thumbnail" },
        ],
        _setup: ($) => $.set("mediaInfo", $.guessMediaInfoFromUrl($().mp4)),
        type: ($) => $().mediaFinderType,
        url: ($) => $().mp4,
        ext: ($) => $("mediaInfo").ext,
        mimeType: ($) => $("mediaInfo").mimeType,
        image: ($) => $("mediaInfo").image,
        video: ($) => $("mediaInfo").video,
        fileSize: ($) => parseInt($().mp4_size),
        width: ($) => parseInt($().width),
        height: ($) => parseInt($().height),
      },
    ],
  },
] satisfies Constructor;
