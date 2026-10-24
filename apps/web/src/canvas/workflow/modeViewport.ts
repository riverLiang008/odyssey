import type { WorkflowCanvasProjection } from './workflowCanvasAdapter'

type Viewport = WorkflowCanvasProjection['viewport']
function positions(projection: WorkflowCanvasProjection) {
  return new Map(projection.nodes.map(node => {
    const parent = projection.nodes.find(p => p.id === node.parentNode)
    return [node.id, { x: node.position.x + (parent?.position.x ?? 0), y: node.position.y + (parent?.position.y ?? 0) }]
  }))
}

export function modeViewportAnchor(projection: WorkflowCanvasProjection, viewport: Viewport, size: { width: number; height: number }, preferredId?: string | null): string | null {
  const candidates = [...positions(projection)].map(([id, point]) => ({ id, screen: { x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y } }))
  const visible = candidates.filter(p => p.screen.x >= 0 && p.screen.x <= size.width && p.screen.y >= 0 && p.screen.y <= size.height)
  const pool = visible.length ? visible : candidates
  return (visible.find(p => p.id === preferredId) ?? pool.sort((a, b) => Math.hypot(a.screen.x - size.width / 2, a.screen.y - size.height / 2) - Math.hypot(b.screen.x - size.width / 2, b.screen.y - size.height / 2))[0])?.id ?? null
}
// Preserve the screen position of a visible selected node, otherwise the nearest
// visible node. Children use absolute positions derived from their parent.
export function mapModeViewport(before: WorkflowCanvasProjection, after: WorkflowCanvasProjection, viewport: Viewport, size: { width: number; height: number }, selectedId?: string | null): Viewport {
  const oldPositions = positions(before)
  const newPositions = positions(after)
  const id = modeViewportAnchor(before, viewport, size, selectedId)
  const anchor = id ? oldPositions.get(id) : undefined
  const target = id ? newPositions.get(id) : undefined
  if (!anchor || !target) return { ...viewport }
  return { x: viewport.x + (anchor.x - target.x) * viewport.zoom, y: viewport.y + (anchor.y - target.y) * viewport.zoom, zoom: viewport.zoom }
}
