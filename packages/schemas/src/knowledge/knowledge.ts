import { z } from 'zod'

import { utcTimestampSchema, uuidSchema } from '../common'

export const knowledgeSpaceLifecycleStatusSchema = z.enum([
  'initializing',
  'ready',
  'syncing',
  'failed',
])

export const knowledgeGraphStatusSchema = z.enum([
  'not_indexed',
  'healthy',
  'needs_review',
  'error',
])

export const knowledgeSpaceSummarySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1).max(255),
  description: z.string().nullable(),
  knowledgeSpaceCategoryId: uuidSchema,
  lifecycleStatus: knowledgeSpaceLifecycleStatusSchema,
  graphStatus: knowledgeGraphStatusSchema,
  updatedAt: utcTimestampSchema,
})

export const knowledgeSpaceSummaryPageSchema = z.strictObject({
  items: z.array(knowledgeSpaceSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
})

export type KnowledgeSpaceLifecycleStatus = z.infer<typeof knowledgeSpaceLifecycleStatusSchema>
export type KnowledgeGraphStatus = z.infer<typeof knowledgeGraphStatusSchema>
export type KnowledgeSpaceSummary = z.infer<typeof knowledgeSpaceSummarySchema>
export type KnowledgeSpaceSummaryPage = z.infer<typeof knowledgeSpaceSummaryPageSchema>
