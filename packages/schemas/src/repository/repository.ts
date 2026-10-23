import { z } from 'zod'

import { revisionSchema, utcTimestampSchema, uuidSchema, type Revision, type UUID } from '../common'
import { agentTemplateSchema, agentWorkflowEditorDocumentSchema, createAgentTemplateSchema, createAgentWorkflowEditorDocumentSchema, guardrailSideSchema, journeyEditorDocumentSchema, journeyStatusSchema, type AgentTemplate, type AgentWorkflowEditorDocument, type JourneyEditorDocument } from '../editor'
import { patternConfigSchema, patternTemplateKeySchema, patternRouteTargetSchema } from '../pattern'
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
  expectedRevision: revisionSchema,
})

export const addGuardrailInputSchema = z.strictObject({
  journeyId: uuidSchema,
  side: guardrailSideSchema,
  expectedRevision: revisionSchema,
})

export const removeGuardrailInputSchema = z.strictObject({
  journeyId: uuidSchema,
  side: guardrailSideSchema,
  expectedRevision: revisionSchema,
  expectedAgentId: uuidSchema,
})

export const saveAgentAsTemplateInputSchema = z.strictObject({
  journeyId: uuidSchema,
  agentId: uuidSchema,
  name: z.string().trim().min(1),
  description: z.string().nullable(),
})

export const templateEndAssignmentSchema = z.strictObject({ endNodeId: uuidSchema, target: patternRouteTargetSchema })
export type TemplateEndAssignment = z.infer<typeof templateEndAssignmentSchema>
export const instantiateAgentTemplateInputSchema = z.strictObject({
  endAssignments: z.array(templateEndAssignmentSchema).optional(),
  journeyId: uuidSchema,
  slotId: uuidSchema,
  templateId: uuidSchema,
  expectedRevision: revisionSchema,
})

export const routingImpactSchema = z.strictObject({
  agentId: uuidSchema,
  revision: revisionSchema,
  removedEndIds: z.array(uuidSchema),
  removedEdgeIds: z.array(uuidSchema),
  legacy: z.boolean(),
})
export const routingConfirmationSchema = z.array(z.strictObject({ agentId: uuidSchema, revision: revisionSchema, removedEndIds: z.array(uuidSchema), removedEdgeIds: z.array(uuidSchema) }))
export type RoutingImpact = z.infer<typeof routingImpactSchema>
export type RoutingConfirmation = z.infer<typeof routingConfirmationSchema>

export const removeOccupiedSlotInputSchema = z.strictObject({
  routingConfirmation: routingConfirmationSchema.optional(),
  journeyId: uuidSchema,
  slotId: uuidSchema,
  expectedRevision: revisionSchema,
  expectedAgentId: uuidSchema,
  agentAction: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('discard') }),
    z.strictObject({
      type: z.literal('save_as_template_and_discard'),
      template: z.strictObject({ name: z.string().trim().min(1), description: z.string().nullable() }),
    }),
  ]),
})

export const removeOccupiedSlotSuccessSchema = z.strictObject({
  journey: journeyEditorDocumentSchema,
  template: agentTemplateSchema.nullable(),
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

export const addGuardrailSuccessSchema = z.strictObject({
  journey: journeyEditorDocumentSchema,
  agent: agentWorkflowEditorDocumentSchema,
}).superRefine((result, context) => {
  const metadata = result.agent.agent
  const guardrails = [result.journey.inputGuardrail, result.journey.outputGuardrail]
  const matches = guardrails.filter(
    (guardrail) => guardrail.state === 'active' && guardrail.agentId === metadata.id,
  )
  if (metadata.journeyId !== result.journey.journey.id || matches.length !== 1) {
    context.addIssue({
      code: 'custom',
      message: 'Created Guardrail Agent must belong to and be bound exactly once in the Journey',
      path: ['agent', 'agent', 'id'],
    })
  }
})

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
  routingConfirmation: routingConfirmationSchema.optional(),
})

export const journeySummarySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  status: journeyStatusSchema,
  patternKind: patternTemplateKeySchema,
  agentCount: z.number().int().nonnegative(),
  revision: revisionSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
})
export const journeySummaryListSchema = z.array(journeySummarySchema)
export const createJourneyInputSchema = z.strictObject({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable(),
  patternTemplateKey: patternTemplateKeySchema,
})
export const deleteJourneyInputSchema = z.strictObject({ journeyId: uuidSchema, expectedRevision: revisionSchema })
export const deleteJourneySuccessSchema = z.strictObject({ journeyId: uuidSchema })

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
  document: journeyEditorDocumentSchema.optional(),
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
  'REQUEST_INVALID',
  'VALIDATION_FAILED',
  'STATE_CONFLICT',
  'LEGACY_PATTERN_UNSUPPORTED',
  'CURRENT_WORKSPACE_UNAVAILABLE',
])
export const apiErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(['VALIDATION_FAILED', 'NOT_FOUND', 'REVISION_CONFLICT', 'STATE_CONFLICT', 'LEGACY_PATTERN_UNSUPPORTED', 'CURRENT_WORKSPACE_UNAVAILABLE']),
    details: z.unknown(),
  }),
})
export const validationErrorDetailsSchema = z.strictObject({
  issues: z.array(z.strictObject({ path: z.array(z.union([z.string(), z.number()])), code: z.string().min(1) })),
})
export const revisionConflictDetailsSchema = z.strictObject({ expectedRevision: revisionSchema, currentRevision: revisionSchema })
export const stateConflictReasonSchema = z.enum([
  'END_ROUTING_CONFIRMATION_REQUIRED',
  'END_BOUNDARY_IMMUTABLE',
  'TEMPLATE_END_MAPPING_REQUIRED',
  'PATTERN_IMMUTABLE',
  'OCCUPIED_SLOT_REMOVAL_REQUIRES_COMMAND',
  'SLOT_OCCUPIED',
  'SLOT_AGENT_CHANGED',
  'GUARDRAIL_ALREADY_ACTIVE',
  'GUARDRAIL_ALREADY_INACTIVE',
  'GUARDRAIL_AGENT_MISMATCH',
  'GUARDRAIL_STATE_INVALID',
  'KNOWLEDGE_SPACE_CATEGORY_NAME_CONFLICT',
  'KNOWLEDGE_SPACE_NAME_CONFLICT',
  'KNOWLEDGE_SPACE_MUST_BE_ARCHIVED',
  'KNOWLEDGE_SPACE_HAS_DOCUMENTS',
  'KNOWLEDGE_SPACE_IS_REFERENCED',
  'KNOWLEDGE_FOLDER_NAME_CONFLICT',
  'KNOWLEDGE_RESOURCE_ALREADY_IN_FOLDER',
  'KNOWLEDGE_RESOURCE_NOT_EDITABLE_MARKDOWN',
])
export const stateConflictDetailsSchema = z.object({ reason: stateConflictReasonSchema, routingImpact: z.array(routingImpactSchema).optional() }).passthrough()

const simpleRepositoryErrorSchema = z.discriminatedUnion('code', [
  z.strictObject({ code: z.literal('NOT_FOUND') }),
  z.strictObject({ code: z.literal('RESPONSE_INVALID') }),
  z.strictObject({ code: z.literal('NETWORK_FAILED') }),
  z.strictObject({ code: z.literal('ABORTED') }),
  z.strictObject({ code: z.literal('REQUEST_INVALID') }),
  z.strictObject({ code: z.literal('LEGACY_PATTERN_UNSUPPORTED') }),
  z.strictObject({ code: z.literal('CURRENT_WORKSPACE_UNAVAILABLE') }),
])
const revisionConflictErrorSchema = z.strictObject({
  code: z.literal('REVISION_CONFLICT'),
  expectedRevision: revisionSchema,
  currentRevision: revisionSchema,
})
export const repositoryErrorSchema = z.union([
  simpleRepositoryErrorSchema,
  revisionConflictErrorSchema,
  z.strictObject({
    code: z.literal('VALIDATION_FAILED'),
    issues: z.array(z.strictObject({ path: z.array(z.union([z.string(), z.number()])), code: z.string().min(1) })),
  }),
  z.strictObject({
    code: z.literal('STATE_CONFLICT'),
    reason: stateConflictReasonSchema,
    routingImpact: z.array(routingImpactSchema).optional(),
  }),
])

export type SaveJourneyInput = z.infer<typeof saveJourneyInputSchema>
export type JourneySummary = z.infer<typeof journeySummarySchema>
export type CreateJourneyInput = z.infer<typeof createJourneyInputSchema>
export type DeleteJourneyInput = z.infer<typeof deleteJourneyInputSchema>
export type DeleteJourneySuccess = z.infer<typeof deleteJourneySuccessSchema>
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
export type AddGuardrailInput = z.infer<typeof addGuardrailInputSchema>
export type RemoveGuardrailInput = z.infer<typeof removeGuardrailInputSchema>
export type AddGuardrailSuccess = z.infer<typeof addGuardrailSuccessSchema>
export type SaveAgentAsTemplateInput = z.infer<typeof saveAgentAsTemplateInputSchema>
export type InstantiateAgentTemplateInput = z.infer<typeof instantiateAgentTemplateInputSchema>
export type RemoveOccupiedSlotInput = z.infer<typeof removeOccupiedSlotInputSchema>
export type RemoveOccupiedSlotSuccess = z.infer<typeof removeOccupiedSlotSuccessSchema>
export type SaveAgentAsTemplateSuccess = AgentTemplate
export type SaveJourneySuccess = z.infer<typeof saveJourneySuccessSchema>
export type SaveAgentWorkflowSuccess = z.infer<typeof saveAgentWorkflowSuccessSchema>
export type RepositoryErrorCode = z.infer<typeof repositoryErrorCodeSchema>
export type RepositoryError = z.infer<typeof repositoryErrorSchema>
export type RepositoryResult<T> = { ok: true; value: T } | { ok: false; error: RepositoryError }
