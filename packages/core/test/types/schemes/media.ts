import { z } from "zod";
import { createFileSchema } from "@/src/schemas/file";
import { createMediaSchema } from "@/src/schemas/media";

const fileSchema = createFileSchema ({
  required: ["url", "ext", "mimeType", "video", "image"],
  optional: ["fileSize", "width", "height"],
});

export const mediaSchema = createMediaSchema({
  fileSchema: fileSchema,
  required: [
    "usernameOfUploader",
    "views",
    "numberOfLikes",
    "dateUploaded",
    "tags",
  ],
  optional: [],
});

const media: z.infer<typeof mediaSchema> = {
  url: "string",
  usernameOfUploader: "string",
  views: 42,
  numberOfLikes: 42,
  dateUploaded: new Date(),
  tags: ["string"],
  meta: {
    type: "media",
  },
  source: "string",
  id: "string",
  files: [
    {
      type: "file",
      kind: "full",
      url: "blar",
      ext: "blar",
      mimeType: "string",
      video: true,
      image: true,
      fileSize: 42
    }
  ]
};

const wrongMetaType: z.infer<typeof mediaSchema> = {
  url: "string",
  usernameOfUploader: "string",
  views: 42,
  numberOfLikes: 42,
  dateUploaded: new Date(),
  tags: ["string"],
  meta: {
    // @ts-expect-error
    type: "dummy",
  },
  source: "string",
  id: "string",
  files: [
    {
      type: "file",
      kind: "full",
      url: "blar",
      ext: "blar",
      mimeType: "string",
      video: true,
      image: true,
      fileSize: 42
    }
  ]
};



export const mediaSchemaEmptyRequired = createMediaSchema({
  fileSchema: fileSchema,
  required: [],
  optional: [],
});


const mediaWithNoRequired: z.infer<typeof mediaSchemaEmptyRequired> = {
  url: "string",
  meta: {
    type: "media",
  },
  source: "string",
  id: "string",
  files: [
    {
      type: "file",
      kind: "full",
      url: "blar",
      ext: "blar",
      mimeType: "string",
      video: true,
      image: true,
      fileSize: 42
    }
  ]
};

const mediaWithInvalidProp: z.infer<typeof mediaSchemaEmptyRequired> = {
  url: "string",
  meta: {
    type: "media",
  },
  source: "string",
  id: "string",
  // @ts-expect-error
  dummyValue: 42,
  files: [
    {
      type: "file",
      kind: "full",
      url: "blar",
      ext: "blar",
      mimeType: "string",
      video: true,
      image: true,
      fileSize: 42
    }
  ]
};

export const mediaSchemaRequiredWithInvalid = createMediaSchema({
  fileSchema: fileSchema,
  // @ts-expect-error
  required: ["dummyValue"]
});

const simpleMediaSchema = createMediaSchema({
  fileSchema: z.object({ foo: z.number() }),
  required: ["tags"],
  optional: ["views", "title"],
});

const simpleMedia: z.infer<typeof simpleMediaSchema> = {
  meta: {
    type: "media",
  },
  source: "string",
  id: "string",
  url: "string",
  views: 2,
  tags: ["string", "string"],
  title: "string",
  files: [{ foo: 23 }],
};
