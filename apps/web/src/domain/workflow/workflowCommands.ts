import {
  agentActionNodeSchema,
  branchNodeSchema,
  loopNodeSchema,
  type AgentActionNode,
  type BranchNode,
  type EndNode,
  type LoopBodyGraph,
  type LoopNode,
  type StartNode,
  type TaskNode,
  type UUID,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
} from '@odyssey/schemas'

import type { WorkflowCommandResult, WorkflowDomainError } from './workflowErrors'
import { branchHandleIds, edgeSemanticKey, hasCycle, indexWorkflowGraph } from './workflowGraphIndex'
import { isBoundaryNode, validateWorkflowGraph } from './workflowValidation'

export type AddableWorkflowNode = Exclude<WorkflowNode, StartNode | EndNode>

export type UpdateNodeConfigIntent =
  | { readonly nodeId: UUID; readonly nodeType: 'agent_action'; readonly config: AgentActionNode['config'] }
  | { readonly nodeId: UUID; readonly nodeType: 'task'; readonly config: TaskNode['config'] }
  | { readonly nodeId: UUID; readonly nodeType: 'branch'; readonly config: BranchNode['config'] }

export interface ConnectNodesIntent {
  readonly edgeId: UUID
  readonly sourceNodeId: UUID
  readonly sourceHandleId?: UUID
  readonly targetNodeId: UUID
}

export interface UpdateAgentActionDetailsIntent {
  readonly nodeId: UUID
  readonly name: string
  readonly model: string
  readonly goal: string
}

function failure<T>(error: WorkflowDomainError): WorkflowCommandResult<T> {
  return { ok: false, error }
}

function sourceFailure<T>(graph: WorkflowGraph): WorkflowCommandResult<T> | null {
  const report = validateWorkflowGraph(graph)
  return report.isStructurallyValid ? null : failure({ code: 'INVALID_SOURCE_GRAPH', issues: report.structuralErrors })
}

function finalize(candidate: WorkflowGraph): WorkflowCommandResult<WorkflowGraph> {
  const validation = validateWorkflowGraph(candidate)
  return validation.isStructurallyValid
    ? { ok: true, value: candidate, validation }
    : failure({ code: 'INVALID_SOURCE_GRAPH', issues: validation.structuralErrors })
}

export function addNode(graph: WorkflowGraph, node: AddableWorkflowNode): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  if (graph.nodes.some((candidate) => candidate.id === node.id)) return failure({ code: 'NODE_ID_CONFLICT', nodeId: node.id })
  if (node.type === 'loop') {
    const bodyValidation = validateWorkflowGraph(node.config.body.graph, { kind: 'loop-body', loopNodeId: node.id })
    if (!bodyValidation.isStructurallyValid) return failure({ code: 'INVALID_LOOP_BODY', loopNodeId: node.id, issues: bodyValidation.structuralErrors })
  }
  const candidate = structuredClone(graph)
  candidate.nodes.push(structuredClone(node))
  return finalize(candidate)
}

export function removeNode(graph: WorkflowGraph, nodeId: UUID): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const node = graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return failure({ code: 'NODE_NOT_FOUND', nodeId })
  if (isBoundaryNode(node)) return failure({ code: 'BOUNDARY_NODE_IMMUTABLE', nodeId })
  const candidate = structuredClone(graph)
  candidate.nodes = candidate.nodes.filter((candidateNode) => candidateNode.id !== nodeId)
  candidate.edges = candidate.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
  return finalize(candidate)
}

export function removeEdge(graph: WorkflowGraph, edgeId: UUID): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  if (!graph.edges.some((edge) => edge.id === edgeId)) return failure({ code: 'EDGE_NOT_FOUND', edgeId })
  const candidate = structuredClone(graph)
  candidate.edges = candidate.edges.filter((edge) => edge.id !== edgeId)
  return finalize(candidate)
}

export function connectNodes(graph: WorkflowGraph, intent: ConnectNodesIntent): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = indexWorkflowGraph(graph)
  const source = index.nodesById.get(intent.sourceNodeId)
  const target = index.nodesById.get(intent.targetNodeId)
  if (!source) return failure({ code: 'MISSING_ENDPOINT', endpoint: 'source', nodeId: intent.sourceNodeId })
  if (!target) return failure({ code: 'MISSING_ENDPOINT', endpoint: 'target', nodeId: intent.targetNodeId })
  if (intent.sourceNodeId === intent.targetNodeId) return failure({ code: 'SELF_EDGE', nodeId: intent.sourceNodeId })
  if (source.type === 'end' || target.type === 'start') {
    return failure({ code: 'INVALID_EDGE_DIRECTION', sourceNodeId: intent.sourceNodeId, targetNodeId: intent.targetNodeId })
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
    sourceNodeId: intent.sourceNodeId,
    targetNodeId: intent.targetNodeId,
    ...(intent.sourceHandleId ? { sourceHandleId: intent.sourceHandleId } : {}),
  }
  if (graph.edges.some((candidate) => edgeSemanticKey(candidate) === edgeSemanticKey(edge))) {
    return failure({ code: 'DUPLICATE_EDGE', sourceNodeId: edge.sourceNodeId, sourceHandleId: edge.sourceHandleId, targetNodeId: edge.targetNodeId })
  }
  if (graph.edges.some((candidate) => candidate.id === edge.id)) return failure({ code: 'EDGE_ID_CONFLICT', edgeId: edge.id })
  const candidate = structuredClone(graph)
  candidate.edges.push(edge)
  if (hasCycle(candidate)) return failure({ code: 'CYCLE_DETECTED', sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId })
  return finalize(candidate)
}

export function updateNodeConfig(graph: WorkflowGraph, intent: UpdateNodeConfigIntent): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === intent.nodeId)
  const existing = graph.nodes[index]
  if (!existing) return failure({ code: 'NODE_NOT_FOUND', nodeId: intent.nodeId })
  if (existing.type !== intent.nodeType || isBoundaryNode(existing)) return failure({ code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId })
  const candidate = structuredClone(graph)
  const replacement = { ...candidate.nodes[index], config: structuredClone(intent.config) } as WorkflowNode
  const parsed = intent.nodeType === 'branch' ? branchNodeSchema.safeParse(replacement) : { success: true as const }
  if (!parsed.success) return failure({ code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId })
  candidate.nodes[index] = replacement
  return finalize(candidate)
}

export function updateAgentActionDetails(graph: WorkflowGraph, intent: UpdateAgentActionDetailsIntent): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
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
  return finalize(candidate)
}

export function removeBranchCase(graph: WorkflowGraph, branchNodeId: UUID, caseId: UUID): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === branchNodeId)
  const branch = graph.nodes[index]
  if (!branch || branch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  if (branch.config.defaultCase.id === caseId) return failure({ code: 'BOUNDARY_NODE_IMMUTABLE', nodeId: branchNodeId })
  if (!branch.config.cases.some((branchCase) => branchCase.id === caseId)) return failure({ code: 'HANDLE_NOT_FOUND', branchNodeId, sourceHandleId: caseId })
  const candidate = structuredClone(graph)
  const candidateBranch = candidate.nodes[index]
  if (!candidateBranch || candidateBranch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  candidateBranch.config.cases = candidateBranch.config.cases.filter((branchCase) => branchCase.id !== caseId)
  candidate.edges = candidate.edges.filter((edge) => !(edge.sourceNodeId === branchNodeId && edge.sourceHandleId === caseId))
  return finalize(candidate)
}

type BranchCase = BranchNode['config']['cases'][number]

export function addBranchCase(graph: WorkflowGraph, branchNodeId: UUID, branchCase: BranchCase): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === branchNodeId)
  const branch = graph.nodes[index]
  if (!branch || branch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  if (branchHandleIds(branch).has(branchCase.id)) return failure({ code: 'NODE_ID_CONFLICT', nodeId: branchCase.id })
  const candidate = structuredClone(graph)
  const candidateBranch = candidate.nodes[index]
  if (!candidateBranch || candidateBranch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  candidateBranch.config.cases.push(structuredClone(branchCase))
  return finalize(candidate)
}

export function updateBranchCase(graph: WorkflowGraph, branchNodeId: UUID, branchCase: BranchCase): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === branchNodeId)
  const branch = graph.nodes[index]
  if (!branch || branch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  const caseIndex = branch.config.cases.findIndex((candidate) => candidate.id === branchCase.id)
  if (caseIndex < 0) return failure({ code: 'HANDLE_NOT_FOUND', branchNodeId, sourceHandleId: branchCase.id })
  const candidate = structuredClone(graph)
  const candidateBranch = candidate.nodes[index]
  if (!candidateBranch || candidateBranch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  candidateBranch.config.cases[caseIndex] = structuredClone(branchCase)
  return finalize(candidate)
}

export function reorderBranchCase(graph: WorkflowGraph, branchNodeId: UUID, caseId: UUID, targetIndex: number): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const nodeIndex = graph.nodes.findIndex((node) => node.id === branchNodeId)
  const branch = graph.nodes[nodeIndex]
  if (!branch || branch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  const caseIndex = branch.config.cases.findIndex((candidate) => candidate.id === caseId)
  if (caseIndex < 0) return failure({ code: 'HANDLE_NOT_FOUND', branchNodeId, sourceHandleId: caseId })
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= branch.config.cases.length) {
    return failure({ code: 'INVALID_NODE_CONFIG', nodeId: branchNodeId })
  }
  const candidate = structuredClone(graph)
  const candidateBranch = candidate.nodes[nodeIndex]
  if (!candidateBranch || candidateBranch.type !== 'branch') return failure({ code: 'NODE_NOT_FOUND', nodeId: branchNodeId })
  const moved = candidateBranch.config.cases.splice(caseIndex, 1)[0]
  if (!moved) return failure({ code: 'HANDLE_NOT_FOUND', branchNodeId, sourceHandleId: caseId })
  candidateBranch.config.cases.splice(targetIndex, 0, moved)
  return finalize(candidate)
}

export function updateLoopBody(graph: WorkflowGraph, loopNodeId: UUID, bodyGraph: LoopBodyGraph): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const node = graph.nodes.find((candidate) => candidate.id === loopNodeId)
  if (!node || node.type !== 'loop') return failure({ code: 'NODE_NOT_FOUND', nodeId: loopNodeId })
  const childValidation = validateWorkflowGraph(bodyGraph, { kind: 'loop-body', loopNodeId })
  if (!childValidation.isStructurallyValid) return failure({ code: 'INVALID_LOOP_BODY', loopNodeId, issues: childValidation.structuralErrors })
  return replaceLoopConfig(graph, loopNodeId, {
    ...node.config,
    body: {
      graph: structuredClone(bodyGraph),
      layout: structuredClone(node.config.body.layout),
    },
  })
}

export function updateLoopBodyDocument(
  graph: WorkflowGraph,
  loopNodeId: UUID,
  body: LoopNode['config']['body'],
): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const node = graph.nodes.find((candidate) => candidate.id === loopNodeId)
  if (!node || node.type !== 'loop') return failure({ code: 'NODE_NOT_FOUND', nodeId: loopNodeId })
  const childValidation = validateWorkflowGraph(body.graph, { kind: 'loop-body', loopNodeId })
  if (!childValidation.isStructurallyValid) return failure({ code: 'INVALID_LOOP_BODY', loopNodeId, issues: childValidation.structuralErrors })
  return replaceLoopConfig(graph, loopNodeId, { ...node.config, body: structuredClone(body) })
}

export function updateLoopSettings(
  graph: WorkflowGraph,
  loopNodeId: UUID,
  settings: Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>,
): WorkflowCommandResult<WorkflowGraph> {
  const node = graph.nodes.find((candidate) => candidate.id === loopNodeId)
  if (!node || node.type !== 'loop') return failure({ code: 'NODE_NOT_FOUND', nodeId: loopNodeId })
  return updateLoopDetails(graph, loopNodeId, { name: node.name, ...settings })
}

export function updateLoopDetails(
  graph: WorkflowGraph,
  loopNodeId: UUID,
  details: Pick<LoopNode, 'name'> & Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>,
): WorkflowCommandResult<WorkflowGraph> {
  const node = graph.nodes.find((candidate) => candidate.id === loopNodeId)
  if (!node || node.type !== 'loop') return failure({ code: 'NODE_NOT_FOUND', nodeId: loopNodeId })
  if (!details.name.trim()) return failure({ code: 'INVALID_NODE_CONFIG', nodeId: loopNodeId })
  return replaceLoop(graph, loopNodeId, {
    ...structuredClone(node),
    name: details.name.trim(),
    config: { ...node.config, maxTurns: details.maxTurns, exitCondition: structuredClone(details.exitCondition) },
  })
}

function replaceLoopConfig(
  graph: WorkflowGraph,
  loopNodeId: UUID,
  config: LoopNode['config'],
): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === loopNodeId)
  const existing = graph.nodes[index]
  if (!existing || existing.type !== 'loop') return failure({ code: 'NODE_NOT_FOUND', nodeId: loopNodeId })
  const replacement: LoopNode = { ...structuredClone(existing), config: structuredClone(config) }
  return replaceLoop(graph, loopNodeId, replacement)
}

function replaceLoop(graph: WorkflowGraph, loopNodeId: UUID, replacement: LoopNode): WorkflowCommandResult<WorkflowGraph> {
  const invalid = sourceFailure<WorkflowGraph>(graph)
  if (invalid) return invalid
  const index = graph.nodes.findIndex((node) => node.id === loopNodeId)
  const existing = graph.nodes[index]
  if (!existing || existing.type !== 'loop') return failure({ code: 'NODE_NOT_FOUND', nodeId: loopNodeId })
  if (!loopNodeSchema.safeParse(replacement).success) return failure({ code: 'INVALID_NODE_CONFIG', nodeId: loopNodeId })
  const candidate = structuredClone(graph)
  candidate.nodes[index] = replacement
  return finalize(candidate)
}
