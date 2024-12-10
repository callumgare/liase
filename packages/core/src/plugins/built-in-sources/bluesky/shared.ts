import { Constructor } from "@/src/schemas/constructor.js";

export const sourceId = "bluesky";

export const postsToMediaResponseConstructor = [
  {
    _arrayMap: ($) =>
      postsToMedia(
        $().posts ?? $().feed?.map((item: any) => item.post) ?? [],
      ).filter((bskyMedia) =>
        $.request.id ? bskyMedia.id === $.request.id : true,
      ),
    mediaFinderSource: sourceId,
    id: ($) => $().id,
    contentHash: ($) => $().fileCid,
    title: ($) => $().postTextContents,
    url: ($) => $().postUrl,
    dateUploaded: ($) => new Date($().createdAt),
    usernameOfUploader: ($) => $().author.handle,
    nameOfUploader: ($) => $().author.displayName,
    files: [
      {
        _arrayMap: ($) => [
          ...($().fullsizeUrl
            ? [{ ...$(), url: $().fullsizeUrl, mediaFinderType: "full" }]
            : []),
          ...($().playlistUrl
            ? [{ ...$(), url: $().playlistUrl, mediaFinderType: "full" }]
            : []),
          ...($().thumbnailUrl
            ? [{ url: $().thumbnailUrl, mediaFinderType: "thumbnail" }]
            : []),
        ],
        _setup: ($) =>
          $.set(
            "mediaInfo",
            $.guessMediaInfoFromUrl(
              $().url.replace(
                /@(\w+)$/,
                (_: string, match: string) => `.${match}`,
              ),
            ),
          ),
        type: ($) => $().mediaFinderType,
        url: ($) => $().url,
        ext: ($) => $("mediaInfo").ext,
        mimeType: ($) => $("mediaInfo").mimeType,
        image: ($) => $("mediaInfo").image,
        video: ($) => $("mediaInfo").video,
        fileSize: ($) => $().filesize,
        aspectRatio: ($) => $().aspectRatio,
      },
    ],
  },
] satisfies Constructor;

type BlueskyMedia = {
  id: string;
  postCid: string;
  postUri: string;
  postUrl: string;
  postTextContents: string;
  fileCid: string;
  altText: string;
  mimeType: string;
  filesize: number;
  playlistUrl?: string;
  thumbnailUrl: string;
  fullsizeUrl?: string;
  aspectRatio: {
    width: number;
    height: number;
  };
  author: {
    did: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
    createdAt: string;
  };
  languages: string[];
  createdAt: string;
};

function postsToMedia(posts: any): BlueskyMedia[] {
  const mediaPosts: BlueskyMedia[][] = [];
  for (const post of posts) {
    const media: BlueskyMedia[] = [];
    const postUrl = `https://bsky.app/profile/${post.uri.split("/").at(2)}/post/${post.uri.split("/").at(-1)}`;
    if (post.record.embed?.images) {
      if (post.record.embed.images.length !== post.embed.images.length) {
        throw Error();
      }
      for (let i = 0; i < post.embed.images.length; i++) {
        const fileCid = post.record.embed.images[i].image.ref.toString();
        media.push({
          id: `${post.uri}#${fileCid}`,
          languages: post.record.langs,
          createdAt: post.record.createdAt,
          author: {
            did: post.author.did,
            handle: post.author.handle,
            displayName: post.author.displayName,
            avatarUrl: post.author.avatar,
            createdAt: post.author.createdAt,
          },
          altText: post.embed.images[i].alt,
          fileCid,
          postCid: post.cid,
          postUri: post.uri,
          postTextContents: post.record.text,
          mimeType: post.record.embed.images[i].image.mimeType,
          filesize: post.record.embed.images[i].image.size,
          fullsizeUrl: post.embed.images[i].fullsize,
          thumbnailUrl: post.embed.images[i].thumb,
          aspectRatio: post.embed.images[i].aspectRatio && {
            width: post.embed.images[i].aspectRatio.width,
            height: post.embed.images[i].aspectRatio.height,
          },
          postUrl,
        });
      }
    } else if (post.record.embed?.video) {
      const fileCid = post.record.embed.video.ref.toString();
      media.push({
        id: `${post.uri}#${fileCid}`,
        languages: post.record.langs,
        createdAt: post.record.createdAt,

        fileCid,
        postCid: post.cid,
        postUri: post.uri,
        postTextContents: post.record.text,
        mimeType: post.record.embed.video.mimeType,
        filesize: post.record.embed.video.size,
        playlistUrl: post.embed?.playlist,
        thumbnailUrl: post.embed?.thumbnail,
        aspectRatio: post.embed?.aspectRatio && {
          width: post.embed?.aspectRatio.width,
          height: post.embed?.aspectRatio.height,
        },
        author: {
          did: post.author.did,
          handle: post.author.handle,
          displayName: post.author.displayName,
          avatarUrl: post.author.avatar,
          createdAt: post.author.createdAt,
        },
        altText: post.embed?.alt,
        postUrl,
      });
    }
    mediaPosts.push(media);
  }
  return mediaPosts.flat();
}
