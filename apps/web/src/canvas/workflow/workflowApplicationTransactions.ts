import type { CanvasLayout, CanvasViewport, LoopNode, UUID, WorkflowGraph } from '@odyssey/schemas'

import {
  addLoopBodyNode,
  addNode,
  connectLoopBodyNodes,
  removeLoopBodyEdge,
  removeLoopBodyNode,
  removeNode,
  type AddableLoopBodyNode,
  type AddableWorkflowNode,
  type ConnectNodesIntent,
  type WorkflowDomainError,
} from '@/domain/workflow'
import {
  addNodePlacement,
  moveNodePlacement,
  removeNodePlacement,
  updateCanvasViewport,
  type WorkflowLayoutError,
  type WorkflowPoint,
} from './workflowLayoutCommands'

export interface WorkflowDocumentSlice {
  readonly graph: WorkflowGraph
  readonly layout: CanvasLayout
}

export type WorkflowApplicationError =
  | { readonly kind: 'graph'; readonly error: WorkflowDomainError }
  | { readonly kind: 'layout'; readonly error: WorkflowLayoutError }

export type WorkflowApplicationResult =
  | { readonly ok: true; readonly value: WorkflowDocumentSlice }
  | { readonly ok: false; readonly error: WorkflowApplicationError }

export type LoopBodyDocumentSlice = LoopNode['config']['body']
export type LoopBodyApplicationResult =
  | { readonly ok: true; readonly value: LoopBodyDocumentSlice }
  | { readonly ok: false; readonly error: WorkflowApplicationError }

function validateLoopBodyLayout(current: LoopBodyDocumentSlice): LoopBodyApplicationResult {
  const nodeIds = new Set(current.graph.nodes.map((node) => node.id))
  const placementIds = new Set<UUID>()
  for (const placement of current.layout.nodePlacements) {
    if (!nodeIds.has(placement.nodeId)) return { ok: false, error: { kind: 'layout', error: { code: 'NODE_NOT_FOUND', nodeId: placement.nodeId } } }
    if (placementIds.has(placement.nodeId)) return { ok: false, error: { kind: 'layout', error: { code: 'PLACEMENT_ALREADY_EXISTS', nodeId: placement.nodeId } } }
    placementIds.add(placement.nodeId)
  }
  return { ok: true, value: structuredClone(current) }
}

export function createWorkflowNodeAt(
  current: WorkflowDocumentSlice,
  node: AddableWorkflowNode,
  point: WorkflowPoint,
): WorkflowApplicationResult {
  const graph = addNode(current.graph, node)
  if (!graph.ok) return { ok: false, error: { kind: 'graph', error: graph.error } }
  const layout = addNodePlacement(current.layout, graph.value, node.id, point)
  if (!layout.ok) return { ok: false, error: { kind: 'layout', error: layout.error } }
  if (node.type === 'loop') {
    const placement = layout.value.nodePlacements.find((candidate) => candidate.nodeId === node.id)
    if (placement) Object.assign(placement, { width: 720, height: 480 })
  }
  return { ok: true, value: { graph: graph.value, layout: layout.value } }
}

export function removeWorkflowNodeAndPlacement(
  current: WorkflowDocumentSlice,
  nodeId: UUID,
): WorkflowApplicationResult {
  const graph = removeNode(current.graph, nodeId)
  if (!graph.ok) return { ok: false, error: { kind: 'graph', error: graph.error } }
  const layout = removeNodePlacement(current.layout, nodeId)
  if (!layout.ok) return { ok: false, error: { kind: 'layout', error: layout.error } }
  return { ok: true, value: { graph: graph.value, layout: layout.value } }
}

export function createLoopBodyNodeAt(
  current: LoopBodyDocumentSlice,
  loopNodeId: UUID,
  node: AddableLoopBodyNode,
  point: WorkflowPoint,
): LoopBodyApplicationResult {
  const source = validateLoopBodyLayout(current)
  if (!source.ok) return source
  const graph = addLoopBodyNode(current.graph, loopNodeId, node)
  if (!graph.ok) return { ok: false, error: { kind: 'graph', error: graph.error } }
  const layout = addNodePlacement(current.layout, graph.value, node.id, point)
  if (!layout.ok) return { ok: false, error: { kind: 'layout', error: layout.error } }
  return validateLoopBodyLayout({ graph: graph.value, layout: layout.value })
}

export function removeLoopBodyNodeAndPlacement(
  current: LoopBodyDocumentSlice,
  loopNodeId: UUID,
  nodeId: UUID,
): LoopBodyApplicationResult {
  const source = validateLoopBodyLayout(current)
  if (!source.ok) return source
  const graph = removeLoopBodyNode(current.graph, loopNodeId, nodeId)
  if (!graph.ok) return { ok: false, error: { kind: 'graph', error: graph.error } }
  const layout = removeNodePlacement(current.layout, nodeId)
  if (!layout.ok) return { ok: false, error: { kind: 'layout', error: layout.error } }
  return validateLoopBodyLayout({ graph: graph.value, layout: layout.value })
}

export function moveLoopBodyNode(
  current: LoopBodyDocumentSlice,
  nodeId: UUID,
  point: WorkflowPoint,
): LoopBodyApplicationResult {
  const source = validateLoopBodyLayout(current)
  if (!source.ok) return source
  const layout = moveNodePlacement(current.layout, nodeId, point)
  if (!layout.ok) return { ok: false, error: { kind: 'layout', error: layout.error } }
  return validateLoopBodyLayout({ graph: current.graph, layout: layout.value })
}

export function connectLoopBodyDocumentNodes(
  current: LoopBodyDocumentSlice,
  loopNodeId: UUID,
  intent: ConnectNodesIntent,
): LoopBodyApplicationResult {
  const source = validateLoopBodyLayout(current)
  if (!source.ok) return source
  const graph = connectLoopBodyNodes(current.graph, loopNodeId, intent)
  if (!graph.ok) return { ok: false, error: { kind: 'graph', error: graph.error } }
  return validateLoopBodyLayout({ graph: graph.value, layout: current.layout })
}

export function removeLoopBodyDocumentEdge(
  current: LoopBodyDocumentSlice,
  loopNodeId: UUID,
  edgeId: UUID,
): LoopBodyApplicationResult {
  const source = validateLoopBodyLayout(current)
  if (!source.ok) return source
  const graph = removeLoopBodyEdge(current.graph, loopNodeId, edgeId)
  if (!graph.ok) return { ok: false, error: { kind: 'graph', error: graph.error } }
  return validateLoopBodyLayout({ graph: graph.value, layout: current.layout })
}

export function updateLoopBodyViewport(
  current: LoopBodyDocumentSlice,
  viewport: CanvasViewport,
): LoopBodyApplicationResult {
  const source = validateLoopBodyLayout(current)
  if (!source.ok) return source
  const layout = updateCanvasViewport(current.layout, viewport)
  if (!layout.ok) return { ok: false, error: { kind: 'layout', error: layout.error } }
  return validateLoopBodyLayout({ graph: current.graph, layout: layout.value })
}
