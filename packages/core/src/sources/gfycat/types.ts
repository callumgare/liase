import { z } from "zod";

export const gfycatFileSchema = z.object({
  type: z.enum(["full", "thumbnail"]),
  url: z.string().url(),
  ext: z.string().regex(/^\w+$/),
  mimeType: z.string(),
  image: z.boolean(),
  video: z.boolean(),
  fileSize: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
}).strict();

export type GfycatFile = z.infer<typeof gfycatFileSchema>

export const gfycatMediaSchema = z.object({
  source: z.string(),
  id: z.string(),
  files: z.array(gfycatFileSchema),
  views: z.number().int(),
  numberOfLikes: z.number().int(),
  url: z.string().url(),
  dateUploaded: z.date(),
  usernameOfUploader: z.string(),
  tags: z.array(z.string()),
}).strict();

export type GfycatMedia = z.infer<typeof gfycatMediaSchema>

export const gfycatResponseSchema = z.object({
  page: z.object({
    paginationType: z.literal("cursor"),
    url: z.string(),
    cursor: z.union([z.string(), z.null()]),
    nextCursor: z.union([z.string(), z.null()]),
    totalMedia: z.number().int(),
    isLastPage: z.boolean(),
  }).strict(),
  media: z.array(gfycatMediaSchema)
}).strict();

export type GfycatResponse = z.infer<typeof gfycatResponseSchema>

export const gfycatRawAPIContentUrlSchema = z.object({
  url: z.string().url(),
  size: z.number().int().optional(),
  height: z.number().int(),
  width: z.number().int(),
}).passthrough();

export const gfycatRawAPIMediaSchema = z.object({
  max2mbGif: z.string(),
  userData: z.object({
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
  }).passthrough().optional(),
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
  gfySlug: z.string().optional(),
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
  content_urls: z.object({
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
  }).passthrough()
}).passthrough();

export const gfycatRawAPISearchPageSchema = z.object({
  cursor: z.string(),
  related: z.array(z.string()),
  found: z.number().int(),
  gfycats: z.array(gfycatRawAPIMediaSchema),
}).passthrough();

export const gfycatRawAPISingleGfycatSchema = z
  .object({
    gfyItem: gfycatRawAPIMediaSchema,
  })
  .passthrough();
