import {
  loopBodyGraphSchema,
  workflowGraphSchema,
  type BranchNode,
  type LoopNode,
  type UUID,
} from '@odyssey/schemas'

import type { WorkflowGraphContext, WorkflowValidationIssue, WorkflowValidationReport } from './workflowErrors'
import {
  branchHandleIds,
  canReachEnd,
  edgeSemanticKey,
  hasCycle,
  indexWorkflowGraph,
  reachableFrom,
  type WorkflowGraphLike,
} from './workflowGraphIndex'

function contractIssues(graph: WorkflowGraphLike, context: WorkflowGraphContext): WorkflowValidationIssue[] {
  const parsed = context.kind === 'agent-workflow'
    ? workflowGraphSchema.safeParse(graph)
    : loopBodyGraphSchema.safeParse(graph)
  return parsed.success ? [] : parsed.error.issues.map((issue) => ({
    code: 'INVALID_CONTRACT' as const,
    path: issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol'),
  }))
}

function cardinalityIssues(graph: WorkflowGraphLike, context: WorkflowGraphContext): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const count = (type: string): number => graph.nodes.filter((node) => node.type === type).length
  if (context.kind === 'agent-workflow') {
    if (count('start') !== 1) issues.push({ code: 'START_CARDINALITY' })
    if (count('end') !== 1) issues.push({ code: 'END_CARDINALITY' })
    graph.nodes.forEach((node) => {
      if (node.type === 'loop_start' || node.type === 'loop_end') issues.push({ code: 'INVALID_NODE_KIND', nodeId: node.id })
    })
  } else {
    if (count('loop_start') !== 1) issues.push({ code: 'LOOP_START_CARDINALITY' })
    if (count('loop_end') !== 1) issues.push({ code: 'LOOP_END_CARDINALITY' })
    graph.nodes.forEach((node) => {
      if (node.type === 'start' || node.type === 'end' || node.type === 'loop') issues.push({ code: 'INVALID_NODE_KIND', nodeId: node.id })
    })
  }
  return issues
}

function referenceAndEdgeIssues(graph: WorkflowGraphLike): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const nodeIds = new Set<UUID>()
  const edgeIds = new Set<UUID>()
  const semanticEdges = new Set<string>()
  graph.nodes.forEach((node) => {
    if (nodeIds.has(node.id)) issues.push({ code: 'DUPLICATE_NODE_ID', nodeId: node.id })
    nodeIds.add(node.id)
  })
  const index = indexWorkflowGraph(graph)
  graph.edges.forEach((edge) => {
    if (edgeIds.has(edge.id)) issues.push({ code: 'DUPLICATE_EDGE_ID', edgeId: edge.id })
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.sourceNodeId)) issues.push({ code: 'MISSING_EDGE_SOURCE', edgeId: edge.id, nodeId: edge.sourceNodeId })
    if (!nodeIds.has(edge.targetNodeId)) issues.push({ code: 'MISSING_EDGE_TARGET', edgeId: edge.id, nodeId: edge.targetNodeId })
    if (edge.sourceNodeId === edge.targetNodeId) issues.push({ code: 'SELF_EDGE', edgeId: edge.id, nodeId: edge.sourceNodeId })
    const semanticKey = edgeSemanticKey(edge)
    if (semanticEdges.has(semanticKey)) issues.push({ code: 'DUPLICATE_EDGE', edgeId: edge.id })
    semanticEdges.add(semanticKey)

    const source = index.nodesById.get(edge.sourceNodeId)
    if (source?.type === 'branch') {
      if (!edge.sourceHandleId || !branchHandleIds(source).has(edge.sourceHandleId)) {
        issues.push({ code: 'INVALID_SOURCE_HANDLE', edgeId: edge.id, nodeId: source.id, sourceHandleId: edge.sourceHandleId })
      }
    } else if (edge.sourceHandleId) {
      issues.push({ code: 'INVALID_SOURCE_HANDLE', edgeId: edge.id, nodeId: edge.sourceNodeId, sourceHandleId: edge.sourceHandleId })
    }

    if (source?.type === 'end' || source?.type === 'loop_end') issues.push({ code: 'END_HAS_OUTGOING', edgeId: edge.id, nodeId: source.id })
    const target = index.nodesById.get(edge.targetNodeId)
    if (target?.type === 'start' || target?.type === 'loop_start') issues.push({ code: 'START_HAS_INCOMING', edgeId: edge.id, nodeId: target.id })
  })
  if (hasCycle(graph)) issues.push({ code: 'CYCLE_DETECTED' })
  return issues
}

function branchStructuralIssues(graph: WorkflowGraphLike): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const index = indexWorkflowGraph(graph)
  for (const node of graph.nodes) {
    if (node.type !== 'branch') continue
    const counts = new Map<UUID, number>()
    for (const edge of index.outgoingByNodeId.get(node.id) ?? []) {
      if (edge.sourceHandleId) counts.set(edge.sourceHandleId, (counts.get(edge.sourceHandleId) ?? 0) + 1)
    }
    for (const [handleId, count] of counts) {
      if (count > 1) issues.push({ code: 'BRANCH_ROUTE_DUPLICATE', nodeId: node.id, sourceHandleId: handleId })
    }
  }
  return issues
}

function loopIssues(graph: WorkflowGraphLike): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  for (const node of graph.nodes) {
    if (node.type !== 'loop') continue
    const report = validateWorkflowGraph(node.config.body.graph, { kind: 'loop-body', loopNodeId: node.id })
    if (!report.isStructurallyValid) issues.push({ code: 'INVALID_LOOP_BODY', nodeId: node.id })
  }
  return issues
}

function readinessIssues(graph: WorkflowGraphLike, context: WorkflowGraphContext): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const index = indexWorkflowGraph(graph)
  const start = graph.nodes.find((node) => node.type === (context.kind === 'agent-workflow' ? 'start' : 'loop_start'))
  const end = graph.nodes.find((node) => node.type === (context.kind === 'agent-workflow' ? 'end' : 'loop_end'))
  if (!start || !end) return issues
  const reachable = reachableFrom(start.id, index.outgoingByNodeId)
  const coReachable = canReachEnd(end.id, index.incomingByNodeId)
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) issues.push({ code: 'UNREACHABLE_FROM_START', nodeId: node.id })
    if (!coReachable.has(node.id)) issues.push({ code: 'CANNOT_REACH_END', nodeId: node.id })
    if (node.type === 'branch') issues.push(...branchReadinessIssues(node, index.outgoingByNodeId.get(node.id) ?? []))
    if (node.type === 'loop') {
      const child = validateWorkflowGraph(node.config.body.graph, { kind: 'loop-body', loopNodeId: node.id })
      if (!child.isExecutionReady) issues.push({ code: 'INVALID_LOOP_BODY', nodeId: node.id })
    }
  }
  return issues
}

function branchReadinessIssues(branch: BranchNode, outgoing: readonly { sourceHandleId?: UUID }[]): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const counts = new Map<UUID, number>()
  outgoing.forEach((edge) => {
    if (edge.sourceHandleId) counts.set(edge.sourceHandleId, (counts.get(edge.sourceHandleId) ?? 0) + 1)
  })
  for (const handleId of branchHandleIds(branch)) {
    if ((counts.get(handleId) ?? 0) !== 1) issues.push({ code: 'BRANCH_ROUTE_INCOMPLETE', nodeId: branch.id, sourceHandleId: handleId })
  }
  return issues
}

export function validateWorkflowGraph(graph: WorkflowGraphLike, context: WorkflowGraphContext = { kind: 'agent-workflow' }): WorkflowValidationReport {
  const structuralErrors = [
    ...contractIssues(graph, context),
    ...cardinalityIssues(graph, context),
    ...referenceAndEdgeIssues(graph),
    ...branchStructuralIssues(graph),
    ...loopIssues(graph),
  ]
  const readinessErrors = structuralErrors.length === 0 ? readinessIssues(graph, context) : []
  return {
    structuralErrors,
    readinessErrors,
    isStructurallyValid: structuralErrors.length === 0,
    isExecutionReady: structuralErrors.length === 0 && readinessErrors.length === 0,
  }
}

export function isBoundaryNode(node: { readonly type: string }): boolean {
  return node.type === 'start' || node.type === 'end' || node.type === 'loop_start' || node.type === 'loop_end'
}

export function isLoopNode(node: { readonly type: string }): node is LoopNode {
  return node.type === 'loop'
}

