import type { AgentActionNode, LoopBodyNode, UUID, WorkflowNode } from '@odyssey/schemas'

import type { WorkflowDomainError } from './workflowErrors'

type AgentActionResourceResult =
  | { readonly ok: true; readonly value: AgentActionNode['config'] }
  | { readonly ok: false; readonly error: WorkflowDomainError }

export interface AgentActionReusableToolIntent {
  readonly nodeId: UUID
  readonly reusableToolId: UUID
}

export interface AgentActionKnowledgeSpaceIntent {
  readonly nodeId: UUID
  readonly knowledgeSpaceId: UUID
}

function findAgentAction(
  nodes: readonly (WorkflowNode | LoopBodyNode)[],
  nodeId: UUID,
): AgentActionNode | null {
  const node = nodes.find((candidate) => candidate.id === nodeId)
  return node?.type === 'agent_action' ? node : null
}

export function bindAgentActionReusableTool(
  nodes: readonly (WorkflowNode | LoopBodyNode)[],
  availableReusableToolIds: ReadonlySet<UUID>,
  intent: AgentActionReusableToolIntent,
): AgentActionResourceResult {
  const node = findAgentAction(nodes, intent.nodeId)
  if (!node) return { ok: false, error: { code: 'RESOURCE_TARGET_INVALID', nodeId: intent.nodeId } }
  if (!availableReusableToolIds.has(intent.reusableToolId)) {
    return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: intent.reusableToolId } }
  }
  if (node.config.reusableToolIds.includes(intent.reusableToolId)) {
    return { ok: false, error: { code: 'RESOURCE_ALREADY_BOUND', nodeId: node.id, resourceId: intent.reusableToolId } }
  }
  return {
    ok: true,
    value: { ...structuredClone(node.config), reusableToolIds: [...node.config.reusableToolIds, intent.reusableToolId] },
  }
}

export function unbindAgentActionReusableTool(
  nodes: readonly (WorkflowNode | LoopBodyNode)[],
  availableReusableToolIds: ReadonlySet<UUID>,
  intent: AgentActionReusableToolIntent,
): AgentActionResourceResult {
  const node = findAgentAction(nodes, intent.nodeId)
  if (!node) return { ok: false, error: { code: 'RESOURCE_TARGET_INVALID', nodeId: intent.nodeId } }
  if (!availableReusableToolIds.has(intent.reusableToolId)) {
    return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: intent.reusableToolId } }
  }
  if (!node.config.reusableToolIds.includes(intent.reusableToolId)) {
    return { ok: false, error: { code: 'RESOURCE_NOT_BOUND', nodeId: node.id, resourceId: intent.reusableToolId } }
  }
  return {
    ok: true,
    value: {
      ...structuredClone(node.config),
      reusableToolIds: node.config.reusableToolIds.filter((toolId) => toolId !== intent.reusableToolId),
    },
  }
}

export function bindAgentActionKnowledgeSpace(
  nodes: readonly (WorkflowNode | LoopBodyNode)[],
  availableKnowledgeSpaceIds: ReadonlySet<UUID>,
  intent: AgentActionKnowledgeSpaceIntent,
): AgentActionResourceResult {
  const node = findAgentAction(nodes, intent.nodeId)
  if (!node) return { ok: false, error: { code: 'RESOURCE_TARGET_INVALID', nodeId: intent.nodeId } }
  if (!availableKnowledgeSpaceIds.has(intent.knowledgeSpaceId)) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: intent.knowledgeSpaceId } }
  if (node.config.knowledgeSpaceIds.includes(intent.knowledgeSpaceId)) return { ok: false, error: { code: 'RESOURCE_ALREADY_BOUND', nodeId: node.id, resourceId: intent.knowledgeSpaceId } }
  return { ok: true, value: { ...structuredClone(node.config), knowledgeSpaceIds: [...node.config.knowledgeSpaceIds, intent.knowledgeSpaceId] } }
}

export function unbindAgentActionKnowledgeSpace(
  nodes: readonly (WorkflowNode | LoopBodyNode)[],
  availableKnowledgeSpaceIds: ReadonlySet<UUID>,
  intent: AgentActionKnowledgeSpaceIntent,
): AgentActionResourceResult {
  const node = findAgentAction(nodes, intent.nodeId)
  if (!node) return { ok: false, error: { code: 'RESOURCE_TARGET_INVALID', nodeId: intent.nodeId } }
  if (!availableKnowledgeSpaceIds.has(intent.knowledgeSpaceId)) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: intent.knowledgeSpaceId } }
  if (!node.config.knowledgeSpaceIds.includes(intent.knowledgeSpaceId)) return { ok: false, error: { code: 'RESOURCE_NOT_BOUND', nodeId: node.id, resourceId: intent.knowledgeSpaceId } }
  return { ok: true, value: { ...structuredClone(node.config), knowledgeSpaceIds: node.config.knowledgeSpaceIds.filter((id) => id !== intent.knowledgeSpaceId) } }
}
