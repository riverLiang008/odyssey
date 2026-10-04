import type {
  AgentActionNode,
  LoopBodyGraph,
  LoopBodyNode,
  LoopEndNode,
  LoopStartNode,
  TaskNode,
  UUID,
  WorkflowEdge,
} from '@odyssey/schemas'
import { agentActionNodeSchema } from '@odyssey/schemas'

import type { ConnectNodesIntent } from './workflowCommands'
import type { WorkflowCommandResult, WorkflowDomainError } from './workflowErrors'
import { branchHandleIds, edgeSemanticKey, hasCycle, indexWorkflowGraph } from './workflowGraphIndex'
import { isBoundaryNode, validateWorkflowGraph } from './workflowValidation'

export type AddableLoopBodyNode = Exclude<LoopBodyNode, LoopStartNode | LoopEndNode>
export type UpdateLoopBodyNodeConfigIntent =
  | { readonly nodeId: UUID; readonly nodeType: 'agent_action'; readonly config: AgentActionNode['config'] }
  | { readonly nodeId: UUID; readonly nodeType: 'task'; readonly config: TaskNode['config'] }

function failure<T>(error: WorkflowDomainError): WorkflowCommandResult<T> {
  return { ok: false, error }
}

function sourceFailure<T>(graph: LoopBodyGraph, loopNodeId: UUID): WorkflowCommandResult<T> | null {
  const report = validateWorkflowGraph(graph, { kind: 'loop-body', loopNodeId })
  return report.isStructurallyValid ? null : failure({ code: 'INVALID_SOURCE_GRAPH', issues: report.structuralErrors })
}

function finalize(graph: LoopBodyGraph, loopNodeId: UUID): WorkflowCommandResult<LoopBodyGraph> {
  const validation = validateWorkflowGraph(graph, { kind: 'loop-body', loopNodeId })
  return validation.isStructurallyValid
    ? { ok: true, value: graph, validation }
    : failure({ code: 'INVALID_LOOP_BODY', loopNodeId, issues: validation.structuralErrors })
}

export function addLoopBodyNode(
  graph: LoopBodyGraph,
  loopNodeId: UUID,
  node: AddableLoopBodyNode,
): WorkflowCommandResult<LoopBodyGraph> {
  const invalid = sourceFailure<LoopBodyGraph>(graph, loopNodeId)
  if (invalid) return invalid
  if (graph.nodes.some((candidate) => candidate.id === node.id)) return failure({ code: 'NODE_ID_CONFLICT', nodeId: node.id })
  const candidate = structuredClone(graph)
  candidate.nodes.push(structuredClone(node))
  return finalize(candidate, loopNodeId)
}

export function removeLoopBodyNode(
  graph: LoopBodyGraph,
  loopNodeId: UUID,
  nodeId: UUID,
): WorkflowCommandResult<LoopBodyGraph> {
  const invalid = sourceFailure<LoopBodyGraph>(graph, loopNodeId)
  if (invalid) return invalid
  const node = graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return failure({ code: 'NODE_NOT_FOUND', nodeId })
  if (isBoundaryNode(node)) return failure({ code: 'BOUNDARY_NODE_IMMUTABLE', nodeId })
  const candidate = structuredClone(graph)
  candidate.nodes = candidate.nodes.filter((candidateNode) => candidateNode.id !== nodeId)
  candidate.edges = candidate.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
  return finalize(candidate, loopNodeId)
}

export function removeLoopBodyEdge(
  graph: LoopBodyGraph,
  loopNodeId: UUID,
  edgeId: UUID,
): WorkflowCommandResult<LoopBodyGraph> {
  const invalid = sourceFailure<LoopBodyGraph>(graph, loopNodeId)
  if (invalid) return invalid
  if (!graph.edges.some((edge) => edge.id === edgeId)) return failure({ code: 'EDGE_NOT_FOUND', edgeId })
  const candidate = structuredClone(graph)
  candidate.edges = candidate.edges.filter((edge) => edge.id !== edgeId)
  return finalize(candidate, loopNodeId)
}

export function connectLoopBodyNodes(
  graph: LoopBodyGraph,
  loopNodeId: UUID,
  intent: ConnectNodesIntent,
): WorkflowCommandResult<LoopBodyGraph> {
  const invalid = sourceFailure<LoopBodyGraph>(graph, loopNodeId)
  if (invalid) return invalid
  const index = indexWorkflowGraph(graph)
  const source = index.nodesById.get(intent.sourceNodeId)
  const target = index.nodesById.get(intent.targetNodeId)
  if (!source) return failure({ code: 'MISSING_ENDPOINT', endpoint: 'source', nodeId: intent.sourceNodeId })
  if (!target) return failure({ code: 'MISSING_ENDPOINT', endpoint: 'target', nodeId: intent.targetNodeId })
  if (source.id === target.id) return failure({ code: 'SELF_EDGE', nodeId: source.id })
  if (source.type === 'loop_end' || target.type === 'loop_start') {
    return failure({ code: 'INVALID_EDGE_DIRECTION', sourceNodeId: source.id, targetNodeId: target.id })
  }
  if (source.type === 'branch') {
    if (!intent.sourceHandleId) return failure({ code: 'HANDLE_REQUIRED', branchNodeId: source.id })
    if (!branchHandleIds(source).has(intent.sourceHandleId)) {
      return failure({ code: 'HANDLE_NOT_FOUND', branchNodeId: source.id, sourceHandleId: intent.sourceHandleId })
    }
    if ((index.outgoingByNodeId.get(source.id) ?? []).some((edge) => edge.sourceHandleId === intent.sourceHandleId)) {
      return failure({ code: 'HANDLE_ALREADY_CONNECTED', branchNodeId: source.id, sourceHandleId: intent.sourceHandleId })
    }
  } else if (intent.sourceHandleId) {
    return failure({ code: 'HANDLE_NOT_ALLOWED', sourceNodeId: source.id })
  }
  const edge: WorkflowEdge = {
    id: intent.edgeId,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    ...(intent.sourceHandleId ? { sourceHandleId: intent.sourceHandleId } : {}),
  }
  if (graph.edges.some((candidate) => edgeSemanticKey(candidate) === edgeSemanticKey(edge))) {
    return failure({ code: 'DUPLICATE_EDGE', sourceNodeId: edge.sourceNodeId, sourceHandleId: edge.sourceHandleId, targetNodeId: edge.targetNodeId })
  }
  if (graph.edges.some((candidate) => candidate.id === edge.id)) return failure({ code: 'EDGE_ID_CONFLICT', edgeId: edge.id })
  const candidate = structuredClone(graph)
  candidate.edges.push(edge)
  if (hasCycle(candidate)) return failure({ code: 'CYCLE_DETECTED', sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId })
  return finalize(candidate, loopNodeId)
}

export function updateLoopBodyNodeConfig(
  graph: LoopBodyGraph,
  loopNodeId: UUID,
  intent: UpdateLoopBodyNodeConfigIntent,
): WorkflowCommandResult<LoopBodyGraph> {
  const invalid = sourceFailure<LoopBodyGraph>(graph, loopNodeId)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === intent.nodeId)
  const existing = graph.nodes[index]
  if (!existing) return failure({ code: 'NODE_NOT_FOUND', nodeId: intent.nodeId })
  if (existing.type !== intent.nodeType) return failure({ code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId })
  const candidate = structuredClone(graph)
  if (intent.nodeType === 'agent_action' && existing.type === 'agent_action') {
    candidate.nodes[index] = { ...existing, config: structuredClone(intent.config) }
  } else if (intent.nodeType === 'task' && existing.type === 'task') {
    candidate.nodes[index] = { ...existing, config: structuredClone(intent.config) }
  } else return failure({ code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId })
  return finalize(candidate, loopNodeId)
}

export function updateLoopBodyAgentActionDetails(
  graph: LoopBodyGraph,
  loopNodeId: UUID,
  intent: { readonly nodeId: UUID; readonly name: string; readonly model: string; readonly goal: string },
): WorkflowCommandResult<LoopBodyGraph> {
  const invalid = sourceFailure<LoopBodyGraph>(graph, loopNodeId)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === intent.nodeId)
  const existing = graph.nodes[index]
  if (!existing || existing.type !== 'agent_action') return failure({ code: 'NODE_NOT_FOUND', nodeId: intent.nodeId })
  const replacement = agentActionNodeSchema.safeParse({
    ...structuredClone(existing),
    name: intent.name.trim(),
    config: {
      ...structuredClone(existing.config),
      model: intent.model.trim(),
      goal: { kind: 'literal', value: intent.goal },
    },
  })
  if (!replacement.success || !replacement.data.name || !replacement.data.config.model) return failure({ code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId })
  const candidate = structuredClone(graph)
  candidate.nodes[index] = replacement.data
  return finalize(candidate, loopNodeId)
}
