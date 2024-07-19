import { z } from "zod";
import { genericFileSchema } from "./file.js";

export const genericMediaSchema = z
  .object({
    mediaFinderSource: z
      .string()
      .regex(/^[a-z-]+$/)
      .describe("The id of the media-finder source which found the media"),
    id: z
      .string()
      .describe(
        "The ID value used to identify a media. This value will be unique amount the other media available from the " +
          "source but two media from different sources could possibly share the same id.",
      ),
    files: z.array(genericFileSchema),
    url: z.string().url().optional().describe(""),
    nameOfUploader: z
      .string()
      .optional()
      .describe(
        "The name of the account which uploaded the media to the source (not necessarily the same as the person who " +
          "created the media).",
      ),
    usernameOfUploader: z
      .string()
      .optional()
      .describe(
        "The username of the account which uploaded the media to the source (not necessarily the same as the person who " +
          "created the media).",
      ),
    usernameOfCreator: z
      .string()
      .optional()
      .describe(
        "The username of the account responsible for creating the media to the source (not necessarily the same as the " +
          "person who uploaded the media to the source).",
      ),
    title: z.string().optional().describe("The title of the media"),
    tags: z.array(z.string()).describe("").optional(),
    views: z
      .number()
      .int()
      .optional()
      .describe("The number times this media has been viewed"),
    numberOfLikes: z
      .number()
      .int()
      .optional()
      .describe("The number of times this media has been liked."),
    numberOfDislikes: z.number().int().optional().describe(""),
    percentOfLikes: z
      .number()
      .optional()
      .describe(
        "The percentage of likes to dislikes that this media has received",
      ),
    dateUploaded: z
      .date()
      .optional()
      .describe("The date that the media was uploaded"),
    relativeDateUploaded: z
      .string()
      .optional()
      .describe(
        'The relative time since the media was uploaded. e.g. "Two weeks ago"',
      ),
    description: z
      .string()
      .optional()
      .describe("A description supplied with the media"),
    duration: z
      .number()
      .optional()
      .describe("The play time of the media in seconds"),
  })
  .passthrough();

export type GenericMedia = z.infer<typeof genericMediaSchema>;
