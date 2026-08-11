import { z } from 'zod'

export const V1_SCHEMA_VERSION = '1.0.0' as const

export const schemaVersionSchema = z.literal(V1_SCHEMA_VERSION)

export const revisionSchema = z.number().int().min(1)

export type SchemaVersion = z.infer<typeof schemaVersionSchema>
export type Revision = z.infer<typeof revisionSchema>
