import type { CanvasLayout, CanvasViewport, UUID } from '@odyssey/schemas'

export type WorkflowLayoutError =
  | { readonly code: 'PLACEMENT_NOT_FOUND'; readonly nodeId: UUID }
  | { readonly code: 'PLACEMENT_ALREADY_EXISTS'; readonly nodeId: UUID }
  | { readonly code: 'NODE_NOT_FOUND'; readonly nodeId: UUID }
  | { readonly code: 'INVALID_POSITION'; readonly nodeId: UUID }
  | { readonly code: 'INVALID_VIEWPORT' }

export type WorkflowLayoutResult =
  | { readonly ok: true; readonly value: CanvasLayout }
  | { readonly ok: false; readonly error: WorkflowLayoutError }

export interface WorkflowPoint { readonly x: number; readonly y: number }
type CanvasLayoutLike = Pick<CanvasLayout, 'nodePlacements' | 'viewport'>
type WorkflowLayoutResultFor<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: WorkflowLayoutError }

function finitePoint(point: WorkflowPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function addNodePlacement<T extends CanvasLayoutLike>(
  layout: T,
  graph: { nodes: readonly { id: UUID }[] },
  nodeId: UUID,
  point: WorkflowPoint,
): WorkflowLayoutResultFor<T> {
  if (!graph.nodes.some((node) => node.id === nodeId)) return { ok: false, error: { code: 'NODE_NOT_FOUND', nodeId } }
  if (!finitePoint(point)) return { ok: false, error: { code: 'INVALID_POSITION', nodeId } }
  if (layout.nodePlacements.some((placement) => placement.nodeId === nodeId)) {
    return { ok: false, error: { code: 'PLACEMENT_ALREADY_EXISTS', nodeId } }
  }
  const value = structuredClone(layout)
  value.nodePlacements.push({ nodeId, x: point.x, y: point.y })
  return { ok: true, value }
}

export function moveNodePlacement<T extends CanvasLayoutLike>(layout: T, nodeId: UUID, point: WorkflowPoint): WorkflowLayoutResultFor<T> {
  if (!finitePoint(point)) return { ok: false, error: { code: 'INVALID_POSITION', nodeId } }
  const index = layout.nodePlacements.findIndex((placement) => placement.nodeId === nodeId)
  if (index < 0) return { ok: false, error: { code: 'PLACEMENT_NOT_FOUND', nodeId } }
  const value = structuredClone(layout)
  value.nodePlacements[index] = { ...value.nodePlacements[index], nodeId, x: point.x, y: point.y }
  return { ok: true, value }
}

export function resizeNodePlacement<T extends CanvasLayoutLike>(layout: T, nodeId: UUID, size: { width: number; height: number }): WorkflowLayoutResultFor<T> {
  const index = layout.nodePlacements.findIndex((placement) => placement.nodeId === nodeId)
  if (index < 0) return { ok: false, error: { code: 'PLACEMENT_NOT_FOUND', nodeId } }
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 420 || size.height < 300 || size.width > 1600 || size.height > 1200) {
    return { ok: false, error: { code: 'INVALID_POSITION', nodeId } }
  }
  const value = structuredClone(layout)
  value.nodePlacements[index] = { ...value.nodePlacements[index], width: size.width, height: size.height }
  return { ok: true, value }
}

export function removeNodePlacement<T extends CanvasLayoutLike>(layout: T, nodeId: UUID): WorkflowLayoutResultFor<T> {
  if (!layout.nodePlacements.some((placement) => placement.nodeId === nodeId)) {
    return { ok: false, error: { code: 'PLACEMENT_NOT_FOUND', nodeId } }
  }
  const value = structuredClone(layout)
  value.nodePlacements = value.nodePlacements.filter((placement) => placement.nodeId !== nodeId)
  return { ok: true, value }
}

export function updateCanvasViewport<T extends CanvasLayoutLike>(layout: T, viewport: CanvasViewport): WorkflowLayoutResultFor<T> {
  if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.zoom) || viewport.zoom <= 0) {
    return { ok: false, error: { code: 'INVALID_VIEWPORT' } }
  }
  return { ok: true, value: { ...structuredClone(layout), viewport: { ...viewport } } as T }
}
