import { z } from 'zod'

/** Canonical timestamps are UTC ISO 8601 strings with a trailing `Z`. */
export const utcTimestampSchema = z.iso.datetime({ offset: false })

export type UtcTimestamp = z.infer<typeof utcTimestampSchema>
