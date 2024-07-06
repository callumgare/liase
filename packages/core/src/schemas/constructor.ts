import { z } from "zod";
import { ActionContext } from "../ActionContext.js";
import { Primitives, zodPrimitives } from "./primitives.js";

export type Action = ((context: ActionContext) => any)

// eslint-disable-next-line no-use-before-define -- We have to use ConstructorObject before it's defined because it's recursive
export type Constructor = ConstructorObject | Action | Primitives | Array<Constructor>

export type ConstructorObject = {
  _arrayMap?: Action,
  _setup?: Action,
  _include?: Action,
} & {
  [key: string]: Constructor
}

const ActionSchema: z.ZodType<Action> = z.function()
    .args(z.instanceof(ActionContext))
    .returns(z.promise(z.any()))

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
export const ConstructorSchema: z.ZodType<Constructor, z.ZodTypeDef, Constructor> = z.union([
  z.record(
    z.string(),
    z.lazy(() => ConstructorSchema)
  ),
  ActionSchema,
  zodPrimitives,
  z.array(z.lazy(() => ConstructorSchema))
])
