import {
  guessMediaInfoFromMimeType,
  guessMediaInfoFromUrl,
} from "@/src/actionHelpers.js";
import { expect, test, vi } from "vitest";

let url: string;
let mimeType: string;

url = "http://example.com/path/file.mp4";
test.extend({ url })(`Guess media type from "${url}"`, ({ url }) => {
  const res = guessMediaInfoFromUrl(url);
  expect(res).toStrictEqual({
    url,
    ext: "mp4",
    mimeType: "video/mp4",
    video: true,
    image: false,
    audio: undefined,
  });
});

url = "http://example.com/path/file.mp3";
test.extend({ url })(`Guess media type from "${url}"`, ({ url }) => {
  const res = guessMediaInfoFromUrl(url, { extra: 42 });
  expect(res).toStrictEqual({
    url,
    ext: "mp3",
    mimeType: "audio/mpeg",
    video: false,
    image: false,
    audio: true,
    extra: 42,
  });
});

url = "/path/file.avi";
test.extend({ url })(`Guess media type from "${url}"`, ({ url }) => {
  const res = guessMediaInfoFromUrl(url);
  expect(res).toStrictEqual({
    url,
    ext: "avi",
    mimeType: "video/x-msvideo",
    video: true,
    image: false,
    audio: undefined,
  });
});

url = "/path/file.avi/subpath/final.sub-path";
test.extend({ url })(`Guess media type from "${url}"`, ({ url }) => {
  const res = guessMediaInfoFromUrl(url);
  expect(res).toStrictEqual({
    url,
    ext: "avi",
    mimeType: "video/x-msvideo",
    video: true,
    image: false,
    audio: undefined,
  });
});

url =
  "https://d-cdn77.cdn.tld/c6371/videos/202606/09/51694935/original_51694935.mov/plain/ex:1:no/bg:0:0:0/rs:fit:320:180/vts:4.9?hash=xki2PucwQ5tJ_4fZX9-xv_8aA2M=&validto=1782461954";
test.extend({ url })(`Guess media type from "${url}"`, ({ url }) => {
  const res = guessMediaInfoFromUrl(url);
  expect(res).toStrictEqual({
    url,
    ext: "mov",
    mimeType: "video/quicktime",
    video: true,
    image: false,
    audio: undefined,
  });
});

url = "http://example.com/path/file";
test.extend({ url })(
  `Throw when guessing media type from "${url}"`,
  ({ url }) => {
    expect(() => guessMediaInfoFromUrl(url)).toThrow(
      /Couldn't derive file type/,
    );
  },
);

url = "http://example.com/path/file.invalidext";
test.extend({ url })(
  `Throw when guessing media type from "${url}"`,
  ({ url }) => {
    expect(() => guessMediaInfoFromUrl(url)).toThrow(
      /Couldn't derive file type from/,
    );
  },
);

url = "http://example.com/path/file";
test.extend({ url })(
  `Guess media type from "${url}" with ext as additional value`,
  ({ url }) => {
    const res = guessMediaInfoFromUrl(url, { ext: "avi" });
    expect(res).toStrictEqual({
      url,
      ext: "avi",
      mimeType: "video/x-msvideo",
      video: true,
      image: false,
      audio: undefined,
    });
  },
);

url = "http://example.com/path/file";
test.extend({ url })(
  `Guess media type from "${url}" with mimeType as additional value`,
  ({ url }) => {
    const res = guessMediaInfoFromUrl(url, { mimeType: "video/x-msvideo" });
    expect(res).toStrictEqual({
      url,
      ext: "avi",
      mimeType: "video/x-msvideo",
      video: true,
      image: false,
      audio: undefined,
    });
  },
);

mimeType = "video/mp4";
test.extend({ mimeType })(
  `Guess media type from "${mimeType}"`,
  ({ mimeType }) => {
    const res = guessMediaInfoFromMimeType(mimeType);
    expect(res).toStrictEqual({
      ext: "mp4",
      mimeType: "video/mp4",
      video: true,
      image: false,
      audio: undefined,
    });
  },
);

mimeType = "invalid/mime/type";
test.extend({ mimeType })(
  "Throw when guessing media type from invalid mime type",
  ({ mimeType }) => {
    expect(() => guessMediaInfoFromMimeType(mimeType)).toThrow(
      /Resource does not appear to be media/,
    );
  },
);
