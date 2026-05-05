import { z } from "zod";

export const zodPrimitives = z.union([
  z.string(),
  z.number(),
  z.bigint(),
  z.boolean(),
  z.date(),
  z.symbol(),
  z.undefined(),
  z.null(),
]);

export type Primitives = z.infer<typeof zodPrimitives>;
