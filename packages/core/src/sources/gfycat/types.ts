import { z } from "zod";
import { createFileSchema } from "@/src/schemas/file.js";
import { createMediaSchema } from "@/src/schemas/media.js";
import { createPageSchema } from "@/src/schemas/page.js";

export const gfycatFileSchema = createFileSchema({
  required: ["url", "ext", "mimeType", "video", "image"],
  optional: ["fileSize", "width", "height"],
});

export const gfycatMediaSchema = createMediaSchema({
  fileSchema: gfycatFileSchema,
  required: [
    "usernameOfUploader",
    "views",
    "numberOfLikes",
    "dateUploaded",
    "tags",
  ],
  optional: [],
});

export const gfycatPageOfMediaSchema = createPageSchema({
  paginationType: "cursor",
  itemsSchema: gfycatMediaSchema,
  required: ["url", "totalItems", "hasNext"],
  optional: [],
  extend: {
    cursor: z.string(),
  },
});

export type GfycatPageOfMedia = z.infer<typeof gfycatPageOfMediaSchema>

export const gfycatRawAPIContentUrlSchema = z
  .object({
    url: z.string().url(),
    size: z.number().int().optional(),
    height: z.number().int(),
    width: z.number().int(),
  })
  .strict();

export const gfycatRawAPIMediaSchema = z
  .object({
    max2mbGif: z.string(),
    userData: z
      .object({
        name: z.string(),
        profileImageUrl: z.string(),
        url: z.string(),
        username: z.string(),
        followers: z.number().int(),
        subscription: z.number().int(),
        following: z.number().int(),
        profileUrl: z.string(),
        views: z.number().int(),
        verified: z.boolean(),
      })
      .strict()
      .optional(),
    username: z.string().optional(),
    userName: z.string().optional(),
    rating: z.string(),
    source: z.number().optional(),
    frameRate: z.number(),
    sitename: z.string().optional(),
    likes: z.union([z.number(), z.string()]),
    height: z.number(),
    userProfileImageUrl: z.string().optional(),
    avgColor: z.string(),
    dislikes: z.union([z.number(), z.string()]).optional(),
    published: z.number(),
    gif100px: z.string().url(),
    thumb100PosterUrl: z.string().url(),
    tags: z.array(z.string()),
    gifUrl: z.string().url(),
    gfyNumber: z.union([z.number(), z.string()]),
    mp4Size: z.number(),
    languageCategories: z.array(z.string()),
    max5mbGif: z.string().url(),
    gfySlug: z.string(),
    description: z.string(),
    webpUrl: z.string().url(),
    title: z.string(),
    domainWhitelist: z.array(z.string()).optional(),
    gatekeeper: z.number(),
    hasTransparency: z.boolean(),
    posterUrl: z.string().url(),
    mobilePosterUrl: z.string().url(),
    webmSize: z.number(),
    mobileUrl: z.string().url(),
    gfyName: z.string(),
    views: z.number(),
    createDate: z.number(),
    webmUrl: z.string().url(),
    hasAudio: z.boolean(),
    extraLemmas: z.string().optional(),
    nsfw: z.union([z.number(), z.string()]),
    languageText2: z.string().optional(),
    userDisplayName: z.string().optional(),
    miniUrl: z.string().url(),
    max1mbGif: z.string().url(),
    gfyId: z.string(),
    url: z.string().url().optional(),
    numFrames: z.number(),
    gifSize: z.number().optional(),
    curated: z.number().optional(),
    miniPosterUrl: z.string().url(),
    width: z.number(),
    mp4Url: z.string().url(),
    md5: z.string().optional(),
    pngPosterUrl: z.string().optional(),
    sar: z.number().optional(),
    extraTitle: z.string().optional(),
    isSticker: z.boolean().optional(),
    content_urls: z
      .object({
        max2mbGif: gfycatRawAPIContentUrlSchema,
        webp: gfycatRawAPIContentUrlSchema.optional(),
        max1mbGif: gfycatRawAPIContentUrlSchema.optional(),
        squareWebp: gfycatRawAPIContentUrlSchema.optional(),
        mobilePoster: gfycatRawAPIContentUrlSchema.optional(),
        mp4: gfycatRawAPIContentUrlSchema.optional(),
        webm: gfycatRawAPIContentUrlSchema.optional(),
        max5mbGif: gfycatRawAPIContentUrlSchema,
        mobile: gfycatRawAPIContentUrlSchema.optional(),
        largeGif: gfycatRawAPIContentUrlSchema
          .extend({ url: z.string().url().optional() })
          .optional(),
        "100pxGif": gfycatRawAPIContentUrlSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const gfycatRawAPISearchPageSchema = z
  .object({
    cursor: z.string(),
    related: z.array(z.string()),
    found: z.number().int(),
    gfycats: z.array(gfycatRawAPIMediaSchema),
  })
  .strict();

export const gfycatRawAPISingleGfycatSchema = z
  .object({
    gfyItem: gfycatRawAPIMediaSchema,
  })
  .strict();
