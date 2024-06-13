import { z } from "zod";
import { ActionContext } from "../ActionContext.js";
import { Primitives, zodPrimitives } from "./primitives.js";

export type Action = ((context: ActionContext) => any)

export type Constructor = {
  _arrayMap?: Action,
  _setup?: Action,
} & {
  [key: string]: Constructor | Constructor[] | Action | Primitives
}

const ActionSchema: z.ZodType<Action> = z.function()
    .args(z.instanceof(ActionContext))
    .returns(z.promise(z.any()))

// ConstructorSchema should be the following:
//
// export const ConstructorSchema: z.ZodType<Constructor> = z.object({
//   _arrayMap: ActionSchema.optional(),
//   _setup: ActionSchema.optional(),
// }).and(
//   z.record(
//     z.string(),
//     z.lazy(() => z.union([
//       ConstructorSchema, z.array(ConstructorSchema), ActionSchema, zodPrimitives
//     ]) )
//   )
// )
//
// But until https://github.com/colinhacks/zod/issues/3485 is resolved this fails.
// So instead we use the following which works except it will also accept giving _arrayMap and _setup
// as Constructor which should be invalid
export const ConstructorSchema: z.ZodType<Constructor> = z.record(
  z.string(),
  z.lazy(() => z.union([
    ConstructorSchema, z.array(ConstructorSchema), ActionSchema, zodPrimitives
  ]) )
)
