import { z } from 'zod'
import { uuidSchema } from '../common'

/** Stable descriptor keys; actual event values are never stored in editor documents. */
export const systemValueKeySchema = z.enum(['change_event', 'document_id', 'document_revision'])
export const systemKnowledgeSpaceSchema = z.strictObject({ kind: z.literal('system_knowledge_space'), key: z.literal('target_knowledge_space') })
export const knowledgeSpaceReferenceSchema = z.union([uuidSchema, systemKnowledgeSpaceSchema])
export const systemValueSourceSchema = z.strictObject({ kind: z.literal('system'), key: systemValueKeySchema })
export type KnowledgeSpaceReference = z.infer<typeof knowledgeSpaceReferenceSchema>
export type SystemValueKey = z.infer<typeof systemValueKeySchema>
export const systemInputs = [
  { key: 'target_knowledge_space', type: 'knowledge_space', readOnly: true },
  { key: 'change_event', type: 'json', readOnly: true },
  { key: 'document_id', type: 'string', readOnly: true },
  { key: 'document_revision', type: 'string', readOnly: true },
] as const
export const systemValueType = (key: SystemValueKey) => key === 'change_event' ? 'json' : 'string'
export const knowledgeReferenceKey = (value: KnowledgeSpaceReference): string => typeof value === 'string' ? value : `sys.${value.key}`
