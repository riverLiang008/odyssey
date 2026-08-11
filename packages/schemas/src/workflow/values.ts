import { z } from 'zod'

import { jsonValueSchema, uuidSchema } from '../common'

export const textTemplateSegmentSchema = z.strictObject({
  kind: z.literal('text'),
  text: z.string(),
})

export const variableTemplateSegmentSchema = z.strictObject({
  kind: z.literal('variable'),
  variableId: uuidSchema,
})

export const templateSegmentSchema = z.discriminatedUnion('kind', [
  textTemplateSegmentSchema,
  variableTemplateSegmentSchema,
])

export const literalValueSourceSchema = z.strictObject({
  kind: z.literal('literal'),
  value: jsonValueSchema,
})

export const variableValueSourceSchema = z.strictObject({
  kind: z.literal('variable'),
  variableId: uuidSchema,
})

export const templateValueSourceSchema = z.strictObject({
  kind: z.literal('template'),
  segments: z.array(templateSegmentSchema).min(1),
})

export const valueSourceSchema = z.discriminatedUnion('kind', [
  literalValueSourceSchema,
  variableValueSourceSchema,
  templateValueSourceSchema,
])

export type TemplateSegment = z.infer<typeof templateSegmentSchema>
export type ValueSource = z.infer<typeof valueSourceSchema>
