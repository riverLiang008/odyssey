import {
  agentReusableToolSchema,
  type AgentReusableTool,
  type AgentWorkflowEditorDocument,
  type LoopBodyNode,
  type ToolStep,
  type UUID,
  type WorkflowNode,
} from '@odyssey/schemas'

import { bindAgentActionReusableTool } from './agentActionResourceCommands'
import type { WorkflowDomainError } from './workflowErrors'

export type InstantiateAndBindReusableToolResult<TNode extends WorkflowNode | LoopBodyNode> =
  | { readonly ok: true; readonly value: { readonly nodes: TNode[]; readonly reusableTools: AgentReusableTool[] } }
  | { readonly ok: false; readonly error: WorkflowDomainError }

export interface InstantiateAndBindReusableToolIntent {
  readonly nodeId: UUID
  readonly tool: AgentReusableTool
}

export function agentReusableToolReferenceCount(
  document: AgentWorkflowEditorDocument,
  reusableToolId: UUID,
): number {
  const countNodes = (nodes: readonly (WorkflowNode | LoopBodyNode)[]): number => nodes.reduce((count, node) => {
    if (node.type === 'agent_action') return count + (node.config.reusableToolIds.includes(reusableToolId) ? 1 : 0)
    if (node.type === 'loop') return count + countNodes(node.config.body.graph.nodes)
    return count
  }, 0)
  return countNodes(document.workflow.nodes)
}

export function deleteAgentReusableTool(
  document: AgentWorkflowEditorDocument,
  reusableToolId: UUID,
): { readonly ok: true; readonly value: AgentReusableTool[] } | { readonly ok: false; readonly error: WorkflowDomainError } {
  if (!document.reusableTools.some((tool) => tool.id === reusableToolId)) {
    return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: reusableToolId } }
  }
  const referenceCount = agentReusableToolReferenceCount(document, reusableToolId)
  if (referenceCount > 0) return { ok: false, error: { code: 'RESOURCE_IN_USE', resourceId: reusableToolId, referenceCount } }
  return { ok: true, value: document.reusableTools.filter((tool) => tool.id !== reusableToolId).map((tool) => structuredClone(tool)) }
}

export function createAgentReusableToolFromTaskStep(
  reusableTools: readonly AgentReusableTool[],
  step: ToolStep,
  reusableToolId: UUID,
): { readonly ok: true; readonly value: { readonly tools: AgentReusableTool[]; readonly tool: AgentReusableTool } } | { readonly ok: false; readonly error: WorkflowDomainError } {
  if (reusableTools.some((tool) => tool.id === reusableToolId)) {
    return { ok: false, error: { code: 'RESOURCE_ID_CONFLICT', resourceId: reusableToolId } }
  }
  const defaultName = step.kind.split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
  const parsed = agentReusableToolSchema.safeParse({
    id: reusableToolId,
    name: step.label?.trim() || defaultName,
    sourceTemplateId: null,
    kind: step.kind,
    configuration: structuredClone(step.configuration),
    inputBindings: [],
    // Task output mappings may target Task-local variables and therefore cannot
    // be carried into the Agent-level reusable library.
    outputBinding: null,
  })
  if (!parsed.success) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: step.id } }
  return {
    ok: true,
    value: {
      tools: [...reusableTools.map((tool) => structuredClone(tool)), parsed.data],
      tool: parsed.data,
    },
  }
}

export function updateAgentReusableTool(
  reusableTools: readonly AgentReusableTool[],
  candidate: AgentReusableTool,
): { readonly ok: true; readonly value: AgentReusableTool[] } | { readonly ok: false; readonly error: WorkflowDomainError } {
  const parsed = agentReusableToolSchema.safeParse(candidate)
  if (!parsed.success) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: candidate.id } }
  const index = reusableTools.findIndex((tool) => tool.id === candidate.id)
  if (index < 0) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: candidate.id } }
  const value: AgentReusableTool[] = reusableTools.map((tool) => structuredClone(tool))
  value[index] = parsed.data
  return { ok: true, value }
}

export function instantiateAndBindAgentReusableTool<TNode extends WorkflowNode | LoopBodyNode>(
  nodes: readonly TNode[],
  reusableTools: readonly AgentReusableTool[],
  intent: InstantiateAndBindReusableToolIntent,
): InstantiateAndBindReusableToolResult<TNode> {
  const parsed = agentReusableToolSchema.safeParse(intent.tool)
  if (!parsed.success) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: intent.tool.id } }
  if (reusableTools.some((tool) => tool.id === parsed.data.id)) {
    return { ok: false, error: { code: 'RESOURCE_ALREADY_BOUND', nodeId: intent.nodeId, resourceId: parsed.data.id } }
  }
  const nextTools = [...structuredClone(reusableTools), parsed.data]
  const binding = bindAgentActionReusableTool(nodes, new Set(nextTools.map((tool) => tool.id)), {
    nodeId: intent.nodeId,
    reusableToolId: parsed.data.id,
  })
  if (!binding.ok) return binding
  const nextNodes = nodes.map((node): TNode => {
    if (node.id !== intent.nodeId || node.type !== 'agent_action') return structuredClone(node)
    // Both graph unions contain this same Agent Action shape; preserve the caller's union.
    return { ...structuredClone(node), config: binding.value } as TNode
  })
  return {
    ok: true,
    value: {
      nodes: nextNodes,
      reusableTools: nextTools,
    },
  }
}
