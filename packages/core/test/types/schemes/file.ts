import { z } from "zod";
import { createFileSchema } from "@/src/schemas/file.js";

const fileSchema = createFileSchema ({
  required: ["url", "ext", "mimeType", "video", "image"],
  optional: ["fileSize", "width", "height"],
});

const file: z.infer<typeof fileSchema> = {
  type: "file",
  kind: "full",
  url: "blar",
  ext: "blar",
  mimeType: "string",
  video: true,
  image: true,
  fileSize: 42
};

const wrongTypes: z.infer<typeof fileSchema> = {
  type: "file",
  kind: "full",
  url: "blar",
  ext: "blar",
  mimeType: "string",
  video: true,
  // @ts-expect-error
  image: "string",
  fileSize: 42
};

const extraProp: z.infer<typeof fileSchema> = {
  type: "file",
  kind: "full",
  url: "blar",
  ext: "blar",
  mimeType: "string",
  video: true,
  image: true,
  fileSize: 42,
  // @ts-expect-error
  dummyProp: 1,
};

const fileSchemaWithNoOptionals = createFileSchema ({
  required: ["url", "ext", "mimeType", "video", "image"],
  optional: [],
});

const fileWithoutOptionals: z.infer<typeof fileSchemaWithNoOptionals> = {
  type: "file",
  kind: "full",
  url: "blar",
  ext: "blar",
  mimeType: "string",
  video: true,
  image: true,
};

const fileWithNonIncludedProp: z.infer<typeof fileSchemaWithNoOptionals> = {
  type: "file",
  kind: "full",
  url: "blar",
  ext: "blar",
  mimeType: "string",
  video: true,
  image: true,
  // @ts-expect-error
  fileSize: 42
};

const fileSchemaWithInvalidRequiredOption = createFileSchema ({
  // @ts-expect-error
  required: ["url", "dummyValue"],
  optional: [],
});

createFileSchema({
  required: ["url"],
  optional: [],
})

createFileSchema({
  // @ts-expect-error
  required: ["url", "fdsfdsa"],
  optional: [],
})

createFileSchema({
  // @ts-expect-error
  required: ["fdsfdsa"],
  optional: [],
})

createFileSchema({
  required: [],
  optional: [],
})

// @ts-expect-error
createFileSchema({
  optional: [],
})
