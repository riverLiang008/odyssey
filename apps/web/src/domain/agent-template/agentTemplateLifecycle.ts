import {
  createAgentTemplateSchema,
  createAgentWorkflowEditorDocumentSchema,
  journeyEditorDocumentSchema,
  uuidSchema,
  type AgentTemplate,
  type AgentWorkflowEditorDocument,
  type JourneyEditorDocument,
  type LoopEndNode,
  type LoopStartNode,
  type UUID,
  type WorkflowNode,
} from '@odyssey/schemas'

import {
  cloneAgentDocument,
  collectAgentOwnedIds,
  type AgentDuplicationIdFactory,
} from '@/domain/pattern/agentDuplication'
import { assignAgent } from '@/domain/pattern/patternCommands'

export interface AgentLifecycleIdFactory extends AgentDuplicationIdFactory {
  agentTemplateId(): UUID
}

export const MINIMUM_WORKFLOW_START_POSITION = { x: 0, y: 0 } as const
export const MINIMUM_WORKFLOW_END_POSITION = { x: 200, y: 0 } as const

export type AgentLifecycleError =
  | { readonly code: 'INVALID_JOURNEY' }
  | { readonly code: 'INVALID_AGENT' }
  | { readonly code: 'INVALID_TEMPLATE' }
  | { readonly code: 'INVALID_NAME' }
  | { readonly code: 'SLOT_NOT_FOUND'; readonly slotId: UUID }
  | { readonly code: 'TARGET_SLOT_OCCUPIED'; readonly slotId: UUID }
  | { readonly code: 'AGENT_NOT_FOUND'; readonly agentId: UUID }
  | { readonly code: 'WORKSPACE_MISMATCH' }
  | { readonly code: 'DEPENDENCY_MAPPING_INVALID' }
  | { readonly code: 'ID_FACTORY_FAILED' }
  | { readonly code: 'GENERATED_ID_COLLISION' }
  | { readonly code: 'GENERATED_DOCUMENT_INVALID' }

export type AgentAggregateResult =
  | { readonly ok: true; readonly value: { readonly journey: JourneyEditorDocument; readonly agent: AgentWorkflowEditorDocument } }
  | { readonly ok: false; readonly error: AgentLifecycleError }

export type AgentTemplateResult =
  | { readonly ok: true; readonly value: AgentTemplate }
  | { readonly ok: false; readonly error: AgentLifecycleError }

function failure(error: AgentLifecycleError): { readonly ok: false; readonly error: AgentLifecycleError } {
  return { ok: false, error }
}

function appendAgent(
  journey: JourneyEditorDocument,
  slotId: UUID,
  agent: AgentWorkflowEditorDocument,
): AgentAggregateResult {
  const assignment = assignAgent(journey.pattern, slotId, agent.agent.id)
  if (!assignment.ok) {
    if (assignment.error.code === 'SLOT_NOT_FOUND') return failure({ code: 'SLOT_NOT_FOUND', slotId })
    if (assignment.error.code === 'TARGET_SLOT_OCCUPIED') return failure({ code: 'TARGET_SLOT_OCCUPIED', slotId })
    return failure({ code: 'GENERATED_DOCUMENT_INVALID' })
  }
  const parsed = journeyEditorDocumentSchema.safeParse({
    ...structuredClone(journey),
    pattern: assignment.value,
    agents: [...journey.agents, {
      id: agent.agent.id,
      name: agent.agent.name,
      description: agent.agent.description,
      revision: agent.agent.revision,
      updatedAt: agent.agent.updatedAt,
    }],
  })
  return parsed.success
    ? { ok: true, value: { journey: parsed.data, agent } }
    : failure({ code: 'GENERATED_DOCUMENT_INVALID' })
}

export function createMinimalAgent(
  journeyInput: JourneyEditorDocument,
  slotId: UUID,
  name: string,
  description: string | null,
  now: string,
  factory: AgentLifecycleIdFactory,
  systemVariableIds: readonly UUID[] = [],
): AgentAggregateResult {
  const journey = journeyEditorDocumentSchema.safeParse(journeyInput)
  if (!journey.success) return failure({ code: 'INVALID_JOURNEY' })
  if (name.trim().length === 0) return failure({ code: 'INVALID_NAME' })
  const slot = journey.data.pattern.slots.find((candidate) => candidate.id === slotId)
  if (!slot) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  if (slot.agentId) return failure({ code: 'TARGET_SLOT_OCCUPIED', slotId })

  let agentId: UUID
  let startId: UUID
  let endId: UUID
  try {
    agentId = factory.agentId()
    startId = factory.workflowNodeId()
    endId = factory.workflowNodeId()
  } catch {
    return failure({ code: 'ID_FACTORY_FAILED' })
  }
  const reserved = new Set<string>([
    journey.data.journey.id,
    journey.data.journey.workspaceId,
    journey.data.pattern.id,
    ...journey.data.pattern.slots.map((candidate) => candidate.id),
    ...journey.data.pattern.routes.map((route) => route.id),
    ...journey.data.agents.map((agent) => agent.id),
    ...systemVariableIds,
  ])
  const generated = [agentId, startId, endId]
  if (new Set(generated).size !== generated.length || generated.some((id) => reserved.has(id))) {
    return failure({ code: 'GENERATED_ID_COLLISION' })
  }

  const parsedAgent = createAgentWorkflowEditorDocumentSchema({ systemVariableIds }).safeParse({
    agent: {
      id: agentId,
      journeyId: journey.data.journey.id,
      name: name.trim(),
      description,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
    workflow: {
      schemaVersion: '1.0.0',
      nodes: [
        { id: startId, type: 'start', name: 'Start', config: {} },
        { id: endId, type: 'end', name: 'End', config: {} },
      ],
      edges: [],
    },
    layout: {
      schemaVersion: '1.0.0',
      nodePlacements: [
        { nodeId: startId, ...MINIMUM_WORKFLOW_START_POSITION },
        { nodeId: endId, ...MINIMUM_WORKFLOW_END_POSITION },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    variables: [],
    reusableTools: [],
  })
  return parsedAgent.success
    ? appendAgent(journey.data, slotId, parsedAgent.data)
    : failure({ code: 'GENERATED_DOCUMENT_INVALID' })
}

export function saveAgentAsTemplate(
  sourceInput: AgentWorkflowEditorDocument,
  ownerWorkspaceId: UUID,
  name: string,
  description: string | null,
  now: string,
  factory: Pick<AgentLifecycleIdFactory, 'agentTemplateId'>,
  systemVariableIds: readonly UUID[] = [],
): AgentTemplateResult {
  const agentSchema = createAgentWorkflowEditorDocumentSchema({ systemVariableIds })
  const source = agentSchema.safeParse(sourceInput)
  if (!source.success) return failure({ code: 'INVALID_AGENT' })
  if (name.trim().length === 0) return failure({ code: 'INVALID_NAME' })
  let templateId: UUID
  try { templateId = factory.agentTemplateId() } catch { return failure({ code: 'ID_FACTORY_FAILED' }) }
  if (collectAgentOwnedIds(source.data).includes(templateId) || systemVariableIds.includes(templateId)) {
    return failure({ code: 'GENERATED_ID_COLLISION' })
  }
  const parsed = createAgentTemplateSchema({ systemVariableIds }).safeParse({
    schemaVersion: '1.0.0',
    id: templateId,
    name: name.trim(),
    description,
    source: 'user',
    ownerWorkspaceId,
    sourceTemplateId: null,
    visibility: 'private',
    publicationStatus: 'draft',
    dependencies: [],
    snapshot: {
      workflow: structuredClone(source.data.workflow),
      layout: structuredClone(source.data.layout),
      variables: structuredClone(source.data.variables),
      reusableTools: structuredClone(source.data.reusableTools),
    },
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  })
  return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'GENERATED_DOCUMENT_INVALID' })
}

export function instantiateAgentTemplate(
  journeyInput: JourneyEditorDocument,
  templateInput: AgentTemplate,
  slotId: UUID,
  name: string | undefined,
  now: string,
  factory: AgentLifecycleIdFactory,
  systemVariableIds: readonly UUID[] = [],
  dependencyMappings: readonly { dependencyId: UUID; assetId: UUID }[] = [],
): AgentAggregateResult {
  const journey = journeyEditorDocumentSchema.safeParse(journeyInput)
  if (!journey.success) return failure({ code: 'INVALID_JOURNEY' })
  const template = createAgentTemplateSchema({ systemVariableIds }).safeParse(templateInput)
  if (!template.success) return failure({ code: 'INVALID_TEMPLATE' })
  if (template.data.visibility !== 'public' && template.data.ownerWorkspaceId !== journey.data.journey.workspaceId) {
    return failure({ code: 'WORKSPACE_MISMATCH' })
  }
  const mappings = new Map(dependencyMappings.map((mapping) => [mapping.dependencyId, mapping.assetId]))
  if (new Set(dependencyMappings.map((mapping) => mapping.dependencyId)).size !== dependencyMappings.length) return failure({ code: 'DEPENDENCY_MAPPING_INVALID' })
  if (template.data.dependencies.some((dependency) => dependency.required && !mappings.has(dependency.id))) return failure({ code: 'DEPENDENCY_MAPPING_INVALID' })
  if (dependencyMappings.some((mapping) => !template.data.dependencies.some((dependency) => dependency.id === mapping.dependencyId))) return failure({ code: 'DEPENDENCY_MAPPING_INVALID' })
  const requestedName = name?.trim() || template.data.name
  const snapshot = structuredClone(template.data.snapshot)
  snapshot.reusableTools.forEach((tool) => {
    if (tool.kind === 'knowledge_retrieval' && typeof tool.configuration.knowledgeSpaceId === 'string') tool.configuration.knowledgeSpaceId = mappings.get(tool.configuration.knowledgeSpaceId) ?? tool.configuration.knowledgeSpaceId
  })
  const rewriteKnowledgeSpaces = (nodes: Array<WorkflowNode | LoopStartNode | LoopEndNode>): void => {
    nodes.forEach((node) => {
      if (node.type === 'agent_action') node.config.knowledgeSpaceIds = node.config.knowledgeSpaceIds.map((id) => typeof id === 'string' ? mappings.get(id) ?? id : id)
      if (node.type === 'task') node.config.steps.forEach((step) => {
        if (step.kind === 'knowledge_retrieval' && typeof step.configuration.knowledgeSpaceId === 'string') step.configuration.knowledgeSpaceId = mappings.get(step.configuration.knowledgeSpaceId) ?? step.configuration.knowledgeSpaceId
      })
      if (node.type === 'loop') rewriteKnowledgeSpaces(node.config.body.graph.nodes)
    })
  }
  rewriteKnowledgeSpaces(snapshot.workflow.nodes)
  const serializedSnapshot = JSON.stringify(snapshot)
  let sentinelSequence = 1
  let sentinelAgentId = uuidSchema.parse(`00000000-0000-4000-8000-${sentinelSequence.toString().padStart(12, '0')}`)
  while (serializedSnapshot.includes(sentinelAgentId)) {
    sentinelSequence += 1
    sentinelAgentId = uuidSchema.parse(`00000000-0000-4000-8000-${sentinelSequence.toString().padStart(12, '0')}`)
  }
  const source = createAgentWorkflowEditorDocumentSchema({ systemVariableIds }).safeParse({
    agent: {
      id: sentinelAgentId,
      journeyId: journey.data.journey.id,
      name: template.data.name,
      description: template.data.description,
      revision: 1,
      createdAt: template.data.createdAt,
      updatedAt: template.data.updatedAt,
    },
    ...snapshot,
  })
  if (!source.success) return failure({ code: 'INVALID_TEMPLATE' })
  const cloned = cloneAgentDocument(source.data, journey.data, requestedName, now, factory, systemVariableIds)
  if (!cloned.ok) {
    return failure({
      code: cloned.reason === 'factory'
        ? 'ID_FACTORY_FAILED'
        : cloned.reason === 'collision'
          ? 'GENERATED_ID_COLLISION'
          : 'GENERATED_DOCUMENT_INVALID',
    })
  }
  return appendAgent(journey.data, slotId, cloned.value)
}
