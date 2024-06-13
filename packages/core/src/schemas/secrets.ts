import { z } from "zod"

export const genericSecretsSchema = z.object({}).passthrough()

export type GenericSecrets = z.infer<typeof genericSecretsSchema>
