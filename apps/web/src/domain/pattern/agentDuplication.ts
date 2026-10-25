import {
  createAgentWorkflowEditorDocumentSchema,
  journeyEditorDocumentSchema,
  type AgentReusableTool,
  type AgentWorkflowEditorDocument,
  type JourneyEditorDocument,
  type LoopEndNode,
  type LoopStartNode,
  type ToolStep,
  type UUID,
  type ValueSource,
  type WorkflowNode,
} from '@odyssey/schemas'

import { assignAgent } from './patternCommands'
import { validatePatternConfig } from './patternValidation'

export interface AgentDuplicationIdFactory {
  agentId(): UUID
  workflowNodeId(): UUID
  workflowEdgeId(): UUID
  branchHandleId(): UUID
  branchConditionId(): UUID
  variableId(): UUID
  reusableToolId(): UUID
  toolStepId(): UUID
  configurationEntryId(): UUID
}

export interface DuplicateAgentIntent {
  readonly sourceSlotId: UUID
  readonly targetSlotId: UUID
  readonly name: string
  readonly now: string
}

export type AgentDuplicationError =
  | { readonly code: 'INVALID_JOURNEY' }
  | { readonly code: 'INVALID_SOURCE_AGENT' }
  | { readonly code: 'SOURCE_SLOT_NOT_FOUND'; readonly slotId: UUID }
  | { readonly code: 'TARGET_SLOT_NOT_FOUND'; readonly slotId: UUID }
  | { readonly code: 'SOURCE_SLOT_EMPTY'; readonly slotId: UUID }
  | { readonly code: 'TARGET_SLOT_OCCUPIED'; readonly slotId: UUID }
  | { readonly code: 'SOURCE_AGENT_MISMATCH'; readonly agentId: UUID }
  | { readonly code: 'INVALID_AGENT_NAME' }
  | { readonly code: 'ID_FACTORY_FAILED' }
  | { readonly code: 'DUPLICATED_ID_COLLISION' }
  | { readonly code: 'DUPLICATED_DOCUMENT_INVALID' }

export type DuplicateAgentResult =
  | { readonly ok: true; readonly value: { readonly journey: JourneyEditorDocument; readonly agent: AgentWorkflowEditorDocument } }
  | { readonly ok: false; readonly error: AgentDuplicationError }

type AnyNode = WorkflowNode | LoopStartNode | LoopEndNode
export type AgentDocumentCloneResult =
  | { readonly ok: true; readonly value: AgentWorkflowEditorDocument }
  | { readonly ok: false; readonly reason: 'collision' | 'factory' | 'invalid' }

export function collectAgentOwnedIds(source: AgentWorkflowEditorDocument): UUID[] {
  const ids: UUID[] = [source.agent.id, ...source.variables.map((variable) => variable.id)]
  source.reusableTools.forEach((tool) => {
    ids.push(tool.id)
    if (tool.kind === 'api_request') {
      ids.push(...tool.configuration.headers.map((header) => header.id))
      if (tool.configuration.body.kind === 'form_data') ids.push(...tool.configuration.body.entries.map((entry) => entry.id))
    }
  })
  const collectNodes = (nodes: readonly AnyNode[], edges: readonly { id: UUID }[]): void => {
    nodes.forEach((node) => {
      ids.push(node.id)
      if (node.type === 'task') {
        ids.push(...node.config.localVariables.map((variable) => variable.id), ...node.config.steps.map((step) => step.id))
        node.config.steps.forEach((step) => {
          if (step.kind === 'api_request') {
            ids.push(...step.configuration.headers.map((header) => header.id))
            if (step.configuration.body.kind === 'form_data') ids.push(...step.configuration.body.entries.map((entry) => entry.id))
          }
        })
      } else if (node.type === 'branch') {
        ids.push(node.config.defaultCase.id)
        node.config.cases.forEach((branchCase) => {
          ids.push(branchCase.id, ...branchCase.conditions.map((condition) => condition.id))
        })
      } else if (node.type === 'loop') {
        collectNodes(node.config.body.graph.nodes, node.config.body.graph.edges)
      }
    })
    ids.push(...edges.map((edge) => edge.id))
  }
  collectNodes(source.workflow.nodes, source.workflow.edges)
  return ids
}

function journeyReservedIds(journey: JourneyEditorDocument): UUID[] {
  return [
    journey.journey.id,
    journey.journey.workspaceId,
    journey.pattern.id,
    ...journey.pattern.slots.flatMap((slot) => [slot.id, ...(slot.agentId ? [slot.agentId] : [])]),
    ...journey.pattern.routes.flatMap((route) => [route.id, route.sourceSlotId, ...(route.target.type === 'slot' ? [route.target.slotId] : [])]),
    ...journey.agents.map((agent) => agent.id),
  ]
}

function externalIds(source: AgentWorkflowEditorDocument, systemVariableIds: readonly UUID[]): UUID[] {
  const ids = [...systemVariableIds]
  source.reusableTools.forEach((tool) => {
    if (tool.sourceTemplateId) ids.push(tool.sourceTemplateId)
    if (tool.kind === 'knowledge_retrieval' && typeof tool.configuration.knowledgeSpaceId === 'string') ids.push(tool.configuration.knowledgeSpaceId)
  })
  const collectNodes = (nodes: readonly AnyNode[]): void => {
    nodes.forEach((node) => {
      if (node.type === 'agent_action') ids.push(...node.config.knowledgeSpaceIds.filter((id) => typeof id === 'string'))
      if (node.type === 'task') {
        node.config.steps.forEach((step) => {
          if (step.kind === 'knowledge_retrieval' && typeof step.configuration.knowledgeSpaceId === 'string') ids.push(step.configuration.knowledgeSpaceId)
        })
      }
      if (node.type === 'loop') collectNodes(node.config.body.graph.nodes)
    })
  }
  collectNodes(source.workflow.nodes)
  return ids
}

function mapped(idMap: ReadonlyMap<string, UUID>, id: UUID, systemVariableIds: ReadonlySet<string> = new Set()): UUID {
  return systemVariableIds.has(id) ? id : idMap.get(id) ?? id
}

function remapValue(value: ValueSource, idMap: ReadonlyMap<string, UUID>, systemIds: ReadonlySet<string>): void {
  if (value.kind === 'variable') value.variableId = mapped(idMap, value.variableId, systemIds)
  if (value.kind === 'template') {
    value.segments.forEach((segment) => {
      if (segment.kind === 'variable') segment.variableId = mapped(idMap, segment.variableId, systemIds)
    })
  }
}

function remapToolConfiguration(
  tool: ToolStep | AgentReusableTool,
  idMap: ReadonlyMap<string, UUID>,
  systemIds: ReadonlySet<string>,
): void {
  if ('inputBindings' in tool) {
    tool.inputBindings.forEach((value) => remapValue(value, idMap, systemIds))
    if (tool.outputBinding) tool.outputBinding.targetVariableId = mapped(idMap, tool.outputBinding.targetVariableId, systemIds)
  } else if (tool.outputMapping) {
    tool.outputMapping.targetVariableId = mapped(idMap, tool.outputMapping.targetVariableId, systemIds)
  }
  switch (tool.kind) {
    case 'knowledge_retrieval':
      if (tool.configuration.query) remapValue(tool.configuration.query, idMap, systemIds)
      break
    case 'script_execution':
      tool.configuration.inputs?.forEach((input) => { input.variableId = mapped(idMap, input.variableId, systemIds) })
      break
    case 'api_request':
      remapValue(tool.configuration.url, idMap, systemIds)
      tool.configuration.headers.forEach((header) => {
        header.id = mapped(idMap, header.id)
        remapValue(header.value, idMap, systemIds)
      })
      if (tool.configuration.body.kind === 'json') remapValue(tool.configuration.body.value, idMap, systemIds)
      if (tool.configuration.body.kind === 'form_data') {
        tool.configuration.body.entries.forEach((entry) => {
          entry.id = mapped(idMap, entry.id)
          remapValue(entry.value, idMap, systemIds)
        })
      }
      break
    case 'set_variable':
      tool.configuration.targetVariableId = mapped(idMap, tool.configuration.targetVariableId, systemIds)
      if (tool.configuration.operation !== 'toggle') remapValue(tool.configuration.value, idMap, systemIds)
      break
    case 'llm_call':
      remapValue(tool.configuration.prompt, idMap, systemIds)
      if (tool.configuration.systemPrompt) remapValue(tool.configuration.systemPrompt, idMap, systemIds)
  }
}

function rewriteGraph(nodes: AnyNode[], edges: Array<{ id: UUID; sourceNodeId: UUID; targetNodeId: UUID; sourceHandleId?: UUID }>, idMap: ReadonlyMap<string, UUID>, systemIds: ReadonlySet<string>): void {
  nodes.forEach((node) => {
    node.id = mapped(idMap, node.id)
    if (node.type === 'agent_action') {
      remapValue(node.config.goal, idMap, systemIds)
      node.config.reusableToolIds = node.config.reusableToolIds.map((id) => mapped(idMap, id))
    } else if (node.type === 'task') {
      node.config.localVariables.forEach((variable) => { variable.id = mapped(idMap, variable.id) })
      node.config.steps.forEach((step) => {
        step.id = mapped(idMap, step.id)
        remapToolConfiguration(step, idMap, systemIds)
      })
    } else if (node.type === 'branch') {
      node.config.defaultCase.id = mapped(idMap, node.config.defaultCase.id)
      node.config.cases.forEach((branchCase) => {
        branchCase.id = mapped(idMap, branchCase.id)
        branchCase.conditions.forEach((condition) => {
          condition.id = mapped(idMap, condition.id)
          remapValue(condition.left, idMap, systemIds)
          if ('right' in condition) remapValue(condition.right, idMap, systemIds)
        })
      })
    } else if (node.type === 'loop') {
      node.config.exitCondition.variableId = mapped(idMap, node.config.exitCondition.variableId, systemIds)
      rewriteGraph(node.config.body.graph.nodes, node.config.body.graph.edges, idMap, systemIds)
      node.config.body.layout.nodePlacements.forEach((placement) => { placement.nodeId = mapped(idMap, placement.nodeId) })
    }
  })
  edges.forEach((edge) => {
    edge.id = mapped(idMap, edge.id)
    edge.sourceNodeId = mapped(idMap, edge.sourceNodeId)
    edge.targetNodeId = mapped(idMap, edge.targetNodeId)
    if (edge.sourceHandleId) edge.sourceHandleId = mapped(idMap, edge.sourceHandleId)
  })
}

function remapDocument(source: AgentWorkflowEditorDocument, journey: JourneyEditorDocument, intent: Pick<DuplicateAgentIntent, 'name' | 'now'>, factory: AgentDuplicationIdFactory, systemVariableIds: readonly UUID[]): AgentDocumentCloneResult {
  const reserved = new Set<string>([
    ...collectAgentOwnedIds(source),
    ...journeyReservedIds(journey),
    ...externalIds(source, systemVariableIds),
  ])
  const generated = new Set<string>()
  const idMap = new Map<string, UUID>()
  let failure: 'collision' | 'factory' | null = null
  const register = (oldId: UUID, create: () => UUID): void => {
    if (failure) return
    try {
      const newId = create()
      if (reserved.has(newId) || generated.has(newId) || idMap.has(oldId)) failure = 'collision'
      else { idMap.set(oldId, newId); generated.add(newId) }
    } catch { failure = 'factory' }
  }

  register(source.agent.id, () => factory.agentId())
  source.variables.forEach((variable) => register(variable.id, () => factory.variableId()))
  source.reusableTools.forEach((tool) => {
    register(tool.id, () => factory.reusableToolId())
    if (tool.kind === 'api_request') {
      tool.configuration.headers.forEach((header) => register(header.id, () => factory.configurationEntryId()))
      if (tool.configuration.body.kind === 'form_data') tool.configuration.body.entries.forEach((entry) => register(entry.id, () => factory.configurationEntryId()))
    }
  })
  const registerGraph = (nodes: readonly AnyNode[], edges: readonly { id: UUID }[]): void => {
    nodes.forEach((node) => {
      register(node.id, () => factory.workflowNodeId())
      if (node.type === 'task') {
        node.config.localVariables.forEach((variable) => register(variable.id, () => factory.variableId()))
        node.config.steps.forEach((step) => {
          register(step.id, () => factory.toolStepId())
          if (step.kind === 'api_request') {
            step.configuration.headers.forEach((header) => register(header.id, () => factory.configurationEntryId()))
            if (step.configuration.body.kind === 'form_data') step.configuration.body.entries.forEach((entry) => register(entry.id, () => factory.configurationEntryId()))
          }
        })
      } else if (node.type === 'branch') {
        register(node.config.defaultCase.id, () => factory.branchHandleId())
        node.config.cases.forEach((branchCase) => {
          register(branchCase.id, () => factory.branchHandleId())
          branchCase.conditions.forEach((condition) => register(condition.id, () => factory.branchConditionId()))
        })
      } else if (node.type === 'loop') registerGraph(node.config.body.graph.nodes, node.config.body.graph.edges)
    })
    edges.forEach((edge) => register(edge.id, () => factory.workflowEdgeId()))
  }
  registerGraph(source.workflow.nodes, source.workflow.edges)
  if (failure) return { ok: false, reason: failure }

  const candidate = structuredClone(source)
  const systemIds = new Set<string>(systemVariableIds)
  candidate.agent.id = mapped(idMap, candidate.agent.id)
  Object.assign(candidate.agent, { journeyId: journey.journey.id, name: intent.name.trim(), revision: 1, createdAt: intent.now, updatedAt: intent.now })
  candidate.variables.forEach((variable) => { variable.id = mapped(idMap, variable.id) })
  candidate.reusableTools.forEach((tool) => {
    tool.id = mapped(idMap, tool.id)
    remapToolConfiguration(tool, idMap, systemIds)
  })
  rewriteGraph(candidate.workflow.nodes, candidate.workflow.edges, idMap, systemIds)
  candidate.layout.nodePlacements.forEach((placement) => { placement.nodeId = mapped(idMap, placement.nodeId) })
  const parsed = createAgentWorkflowEditorDocumentSchema({ systemVariableIds }).safeParse(candidate)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'invalid' }
}

export function cloneAgentDocument(
  source: AgentWorkflowEditorDocument,
  targetJourney: JourneyEditorDocument,
  name: string,
  now: string,
  factory: AgentDuplicationIdFactory,
  systemVariableIds: readonly UUID[] = [],
): AgentDocumentCloneResult {
  return remapDocument(source, targetJourney, { name, now }, factory, systemVariableIds)
}

export function duplicateAgentAggregate(journeyInput: JourneyEditorDocument, sourceAgentInput: AgentWorkflowEditorDocument, intent: DuplicateAgentIntent, factory: AgentDuplicationIdFactory, systemVariableIds: readonly UUID[] = []): DuplicateAgentResult {
  const journeyParsed = journeyEditorDocumentSchema.safeParse(journeyInput)
  if (!journeyParsed.success || !validatePatternConfig(journeyParsed.data.pattern).ok) return { ok: false, error: { code: 'INVALID_JOURNEY' } }
  const agentSchema = createAgentWorkflowEditorDocumentSchema({ systemVariableIds })
  const sourceParsed = agentSchema.safeParse(sourceAgentInput)
  if (!sourceParsed.success) return { ok: false, error: { code: 'INVALID_SOURCE_AGENT' } }
  if (intent.name.trim().length === 0) return { ok: false, error: { code: 'INVALID_AGENT_NAME' } }

  const journey = journeyParsed.data
  const sourceSlot = journey.pattern.slots.find((slot) => slot.id === intent.sourceSlotId)
  if (!sourceSlot) return { ok: false, error: { code: 'SOURCE_SLOT_NOT_FOUND', slotId: intent.sourceSlotId } }
  const targetSlot = journey.pattern.slots.find((slot) => slot.id === intent.targetSlotId)
  if (!targetSlot) return { ok: false, error: { code: 'TARGET_SLOT_NOT_FOUND', slotId: intent.targetSlotId } }
  if (!sourceSlot.agentId) return { ok: false, error: { code: 'SOURCE_SLOT_EMPTY', slotId: intent.sourceSlotId } }
  if (targetSlot.agentId) return { ok: false, error: { code: 'TARGET_SLOT_OCCUPIED', slotId: intent.targetSlotId } }
  if (sourceSlot.agentId !== sourceParsed.data.agent.id || sourceParsed.data.agent.journeyId !== journey.journey.id) {
    return { ok: false, error: { code: 'SOURCE_AGENT_MISMATCH', agentId: sourceParsed.data.agent.id } }
  }

  const duplicated = remapDocument(sourceParsed.data, journey, intent, factory, systemVariableIds)
  if (!duplicated.ok) {
    const code = duplicated.reason === 'collision' ? 'DUPLICATED_ID_COLLISION' : duplicated.reason === 'factory' ? 'ID_FACTORY_FAILED' : 'DUPLICATED_DOCUMENT_INVALID'
    return { ok: false, error: { code } }
  }
  const assignment = assignAgent(journey.pattern, intent.targetSlotId, duplicated.value.agent.id)
  if (!assignment.ok) return { ok: false, error: { code: 'DUPLICATED_DOCUMENT_INVALID' } }
  const journeyCandidate = journeyEditorDocumentSchema.safeParse({
    ...structuredClone(journey),
    pattern: assignment.value,
    agents: [...journey.agents, {
      id: duplicated.value.agent.id,
      name: duplicated.value.agent.name,
      description: duplicated.value.agent.description,
      revision: duplicated.value.agent.revision,
      updatedAt: duplicated.value.agent.updatedAt,
    }],
  })
  if (!journeyCandidate.success) return { ok: false, error: { code: 'DUPLICATED_DOCUMENT_INVALID' } }
  return { ok: true, value: { journey: journeyCandidate.data, agent: duplicated.value } }
}
