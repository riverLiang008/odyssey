import { z } from 'zod'

import { revisionSchema, utcTimestampSchema, uuidSchema } from '../common'
import { patternConfigSchema } from '../pattern'
import {
  agentReusableToolSchema,
  agentVariableSchema,
  canvasLayoutSchema,
  workflowGraphSchema,
} from '../workflow'

export const saveJourneyInputSchema = z.strictObject({
  journeyId: uuidSchema,
  expectedRevision: revisionSchema,
  pattern: patternConfigSchema,
})

export const saveAgentWorkflowInputSchema = z.strictObject({
  journeyId: uuidSchema,
  agentId: uuidSchema,
  expectedRevision: revisionSchema,
  workflow: workflowGraphSchema,
  layout: canvasLayoutSchema,
  variables: z.array(agentVariableSchema),
  reusableTools: z.array(agentReusableToolSchema),
})

const saveSuccessFields = {
  revision: revisionSchema,
  updatedAt: utcTimestampSchema,
} as const

export const saveJourneySuccessSchema = z.strictObject({
  journeyId: uuidSchema,
  ...saveSuccessFields,
})
export const saveAgentWorkflowSuccessSchema = z.strictObject({
  journeyId: uuidSchema,
  agentId: uuidSchema,
  ...saveSuccessFields,
})

export const repositoryErrorCodeSchema = z.enum([
  'NOT_FOUND',
  'RESPONSE_INVALID',
  'NETWORK_FAILED',
  'REVISION_CONFLICT',
  'ABORTED',
])

const simpleRepositoryErrorSchema = z.discriminatedUnion('code', [
  z.strictObject({ code: z.literal('NOT_FOUND') }),
  z.strictObject({ code: z.literal('RESPONSE_INVALID') }),
  z.strictObject({ code: z.literal('NETWORK_FAILED') }),
  z.strictObject({ code: z.literal('ABORTED') }),
])
const revisionConflictErrorSchema = z.strictObject({
  code: z.literal('REVISION_CONFLICT'),
  expectedRevision: revisionSchema,
  currentRevision: revisionSchema,
})
export const repositoryErrorSchema = z.union([
  simpleRepositoryErrorSchema,
  revisionConflictErrorSchema,
])

export type SaveJourneyInput = z.infer<typeof saveJourneyInputSchema>
export type SaveAgentWorkflowInput = z.infer<typeof saveAgentWorkflowInputSchema>
export type SaveJourneySuccess = z.infer<typeof saveJourneySuccessSchema>
export type SaveAgentWorkflowSuccess = z.infer<typeof saveAgentWorkflowSuccessSchema>
export type RepositoryErrorCode = z.infer<typeof repositoryErrorCodeSchema>
export type RepositoryError = z.infer<typeof repositoryErrorSchema>
export type RepositoryResult<T> = { ok: true; value: T } | { ok: false; error: RepositoryError }
