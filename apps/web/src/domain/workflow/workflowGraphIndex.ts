import type { BranchNode, LoopEndNode, LoopStartNode, WorkflowEdge, WorkflowNode, UUID } from '@odyssey/schemas'

export type GraphNode = WorkflowNode | LoopStartNode | LoopEndNode

export interface WorkflowGraphLike {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly WorkflowEdge[]
}

export interface WorkflowGraphIndex {
  readonly nodesById: ReadonlyMap<UUID, GraphNode>
  readonly outgoingByNodeId: ReadonlyMap<UUID, readonly WorkflowEdge[]>
  readonly incomingByNodeId: ReadonlyMap<UUID, readonly WorkflowEdge[]>
}

export function edgeSemanticKey(edge: Pick<WorkflowEdge, 'sourceNodeId' | 'sourceHandleId' | 'targetNodeId'>): string {
  return `${edge.sourceNodeId}:${edge.sourceHandleId ?? ''}:${edge.targetNodeId}`
}

export function branchHandleIds(node: BranchNode): ReadonlySet<UUID> {
  return new Set([node.config.defaultCase.id, ...node.config.cases.map((branchCase) => branchCase.id)])
}

export function indexWorkflowGraph(graph: WorkflowGraphLike): WorkflowGraphIndex {
  const nodesById = new Map<UUID, GraphNode>()
  const outgoing = new Map<UUID, WorkflowEdge[]>()
  const incoming = new Map<UUID, WorkflowEdge[]>()
  for (const node of graph.nodes) {
    if (!nodesById.has(node.id)) nodesById.set(node.id, node)
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }
  for (const edge of graph.edges) {
    outgoing.get(edge.sourceNodeId)?.push(edge)
    incoming.get(edge.targetNodeId)?.push(edge)
  }
  return { nodesById, outgoingByNodeId: outgoing, incomingByNodeId: incoming }
}

export function reachableFrom(startId: UUID, adjacency: ReadonlyMap<UUID, readonly WorkflowEdge[]>): ReadonlySet<UUID> {
  const visited = new Set<UUID>()
  const pending: UUID[] = [startId]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)
    for (const edge of adjacency.get(current) ?? []) pending.push(edge.targetNodeId)
  }
  return visited
}

export function canReachEnd(endId: UUID, incoming: ReadonlyMap<UUID, readonly WorkflowEdge[]>): ReadonlySet<UUID> {
  const visited = new Set<UUID>()
  const pending: UUID[] = [endId]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)
    for (const edge of incoming.get(current) ?? []) pending.push(edge.sourceNodeId)
  }
  return visited
}

export function hasCycle(graph: WorkflowGraphLike): boolean {
  const index = indexWorkflowGraph(graph)
  const indegree = new Map<UUID, number>()
  for (const node of graph.nodes) indegree.set(node.id, 0)
  for (const edge of graph.edges) {
    if (indegree.has(edge.targetNodeId) && index.nodesById.has(edge.sourceNodeId)) {
      indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1)
    }
  }
  const pending = [...indegree].filter(([, degree]) => degree === 0).map(([nodeId]) => nodeId)
  let visited = 0
  while (pending.length > 0) {
    const nodeId = pending.pop()
    if (!nodeId) continue
    visited += 1
    for (const edge of index.outgoingByNodeId.get(nodeId) ?? []) {
      const next = (indegree.get(edge.targetNodeId) ?? 0) - 1
      indegree.set(edge.targetNodeId, next)
      if (next === 0) pending.push(edge.targetNodeId)
    }
  }
  return visited !== graph.nodes.length
}
