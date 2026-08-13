import { z } from 'zod'

import { revisionSchema, utcTimestampSchema, uuidSchema, type Revision, type UUID } from '../common'
import { agentTemplateSchema, agentWorkflowEditorDocumentSchema, createAgentTemplateSchema, createAgentWorkflowEditorDocumentSchema, journeyEditorDocumentSchema, type AgentTemplate, type AgentWorkflowEditorDocument, type JourneyEditorDocument } from '../editor'
import { patternConfigSchema } from '../pattern'
import {
  agentReusableToolSchema,
  agentVariableSchema,
  canvasLayoutSchema,
  workflowGraphSchema,
  type AgentReusableTool,
  type AgentVariable,
  type CanvasLayout,
  type WorkflowGraph,
} from '../workflow'

export const createJourneyAgentInputSchema = z.strictObject({
  journeyId: uuidSchema,
  slotId: uuidSchema,
  name: z.string().trim().min(1),
  description: z.string().nullable(),
})

export const saveAgentAsTemplateInputSchema = z.strictObject({
  journeyId: uuidSchema,
  agentId: uuidSchema,
  ownerWorkspaceId: uuidSchema,
  name: z.string().trim().min(1),
  description: z.string().nullable(),
})

export const instantiateAgentTemplateInputSchema = z.strictObject({
  journeyId: uuidSchema,
  slotId: uuidSchema,
  templateId: uuidSchema,
  name: z.string().trim().min(1).optional(),
  dependencyMappings: z.array(z.strictObject({ dependencyId: uuidSchema, assetId: uuidSchema })),
})

export interface CreateOrInstantiateAgentSuccess {
  journey: JourneyEditorDocument
  agent: AgentWorkflowEditorDocument
}

function refineCreateOrInstantiateResult(result: CreateOrInstantiateAgentSuccess, context: z.RefinementCtx) {
  const metadata = result.agent.agent
  if (metadata.journeyId !== result.journey.journey.id) {
    context.addIssue({ code: 'custom', message: 'Agent must belong to the returned Journey', path: ['agent', 'agent', 'journeyId'] })
  }
  const summaries = result.journey.agents.filter((summary) => summary.id === metadata.id)
  if (summaries.length !== 1) {
    context.addIssue({ code: 'custom', message: 'Journey must contain exactly one summary for the returned Agent', path: ['journey', 'agents'] })
  } else {
    const summary = summaries[0]
    if (summary && (summary.name !== metadata.name || summary.description !== metadata.description || summary.revision !== metadata.revision || summary.updatedAt !== metadata.updatedAt)) {
      context.addIssue({ code: 'custom', message: 'Agent summary must match returned Agent metadata', path: ['journey', 'agents'] })
    }
  }
  const assignedSlots = result.journey.pattern.slots.filter((slot) => slot.agentId === metadata.id)
  if (assignedSlots.length !== 1) {
    context.addIssue({ code: 'custom', message: 'Returned Agent must be assigned to exactly one Pattern Slot', path: ['journey', 'pattern', 'slots'] })
  }
}

export const createOrInstantiateAgentSuccessSchema: z.ZodType<CreateOrInstantiateAgentSuccess> = z.strictObject({
  journey: journeyEditorDocumentSchema,
  agent: agentWorkflowEditorDocumentSchema,
}).superRefine(refineCreateOrInstantiateResult)

export const saveAgentAsTemplateSuccessSchema: z.ZodType<AgentTemplate> = agentTemplateSchema

export interface AgentLifecycleResponseSchemas {
  agentTemplate: z.ZodType<AgentTemplate>
  agentTemplateList: z.ZodType<AgentTemplate[]>
  createOrInstantiate: z.ZodType<CreateOrInstantiateAgentSuccess>
}

export function createAgentLifecycleResponseSchemas(systemVariableIds: readonly string[] = []): AgentLifecycleResponseSchemas {
  const template = createAgentTemplateSchema({ systemVariableIds })
  const agent = createAgentWorkflowEditorDocumentSchema({ systemVariableIds })
  return {
    agentTemplate: template,
    agentTemplateList: z.array(template),
    createOrInstantiate: z.strictObject({ journey: journeyEditorDocumentSchema, agent }).superRefine(refineCreateOrInstantiateResult),
  }
}

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
export interface SaveAgentWorkflowInput {
  journeyId: UUID
  agentId: UUID
  expectedRevision: Revision
  workflow: WorkflowGraph
  layout: CanvasLayout
  variables: AgentVariable[]
  reusableTools: AgentReusableTool[]
}
export type CreateJourneyAgentInput = z.infer<typeof createJourneyAgentInputSchema>
export type SaveAgentAsTemplateInput = z.infer<typeof saveAgentAsTemplateInputSchema>
export type InstantiateAgentTemplateInput = z.infer<typeof instantiateAgentTemplateInputSchema>
export type SaveAgentAsTemplateSuccess = AgentTemplate
export type SaveJourneySuccess = z.infer<typeof saveJourneySuccessSchema>
export type SaveAgentWorkflowSuccess = z.infer<typeof saveAgentWorkflowSuccessSchema>
export type RepositoryErrorCode = z.infer<typeof repositoryErrorCodeSchema>
export type RepositoryError = z.infer<typeof repositoryErrorSchema>
export type RepositoryResult<T> = { ok: true; value: T } | { ok: false; error: RepositoryError }
