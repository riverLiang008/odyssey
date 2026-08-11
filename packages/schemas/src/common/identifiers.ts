import { z } from 'zod'

/** UUID identity used by persisted records and nested domain objects. */
export const uuidSchema = z.uuid().brand<'UUID'>()

export type UUID = z.infer<typeof uuidSchema>
