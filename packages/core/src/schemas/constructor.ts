import { z } from "zod";
import { ActionContext } from "../ActionContext.js";
import { type Primitives, zodPrimitives } from "./primitives.js";

// biome-ignore lint/suspicious/noExplicitAny: action can return any value including primitives and complex objects
export type Action = (context: ActionContext) => any;

export type Constructor =
  // eslint-disable-next-line no-use-before-define -- We have to use ConstructorObject before it's defined because it's recursive
  ConstructorObject | Action | Primitives | Array<Constructor>;

export type ConstructorObject = {
  _arrayMap?: Action;
  _setup?: Action;
  _include?: Action;
} & {
  [key: string]: Constructor;
};

const ActionSchema: z.ZodType<Action> = z
  .function()
  .input([z.instanceof(ActionContext)])
  .output(z.promise(z.unknown()));

// ConstructorSchema should be the following:
//
// export const ConstructorSchema: z.ZodType<Constructor> = z.union([
//   z.object({
//     _arrayMap: ActionSchema.optional(),
//     _setup: ActionSchema.optional(),
//     _include: ActionSchema.optional(),
//   }).and(
//     z.record(
//       z.string(),
//       z.lazy(() => ConstructorSchema)
//     )
//   ),
//   ActionSchema,
//   zodPrimitives,
//   z.array(z.lazy(() => ConstructorSchema))
// ])
// But until https://github.com/colinhacks/zod/issues/3485 is resolved this fails.
// So instead we use the following which works except it will also accept giving _arrayMap and _setup
// as Constructor which should be invalid
export const ConstructorSchema: z.ZodType<Constructor> = z.union([
  z.record(
    z.string(),
    z.lazy(() => ConstructorSchema),
  ),
  ActionSchema,
  zodPrimitives,
  z.array(z.lazy(() => ConstructorSchema)),
]);
