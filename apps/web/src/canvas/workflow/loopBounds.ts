import type { CanvasLayout, LoopNode, UUID, WorkflowGraph } from '@odyssey/schemas'

export interface LoopChildSize { readonly nodeId: UUID; readonly width: number; readonly height: number }
const LEFT = 16
const TOP = 70
const RIGHT = 24
const BOTTOM = 24

// Measured sizes are transient adapter inputs, never persisted as child dimensions.
export function containLoopChildren(
  graph: WorkflowGraph, layout: CanvasLayout, loopId: UUID,
  sizes: readonly LoopChildSize[], requestedSize?: { width: number; height: number },
): { graph: WorkflowGraph; layout: CanvasLayout } | null {
  const loop = graph.nodes.find((node): node is LoopNode => node.id === loopId && node.type === 'loop')
  const parent = layout.nodePlacements.find(p => p.nodeId === loopId)
  if (!loop || !parent || !sizes.length) return null
  const measurements = new Map(sizes.filter(s => Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0).map(s => [s.nodeId, s]))
  const children = loop.config.body.layout.nodePlacements
  const relevant = children.flatMap(p => { const size = measurements.get(p.nodeId); return size ? [size] : [] })
  // The stored size remains within the canonical layout contract. Exceptional
  // content larger than that contract expands only the derived canvas frame.
  const width = Math.min(1600, Math.max(420, requestedSize?.width ?? parent.width ?? 720, ...relevant.map(s => LEFT + s.width + RIGHT)))
  const height = Math.min(1200, Math.max(300, requestedSize?.height ?? parent.height ?? 480, ...relevant.map(s => TOP + s.height + BOTTOM)))
  const placements = children.map(p => {
    const size = measurements.get(p.nodeId)
    if (!size) return p
    return { ...p, x: Math.max(LEFT, Math.min(p.x, width - size.width - RIGHT)), y: Math.max(TOP, Math.min(p.y, height - size.height - BOTTOM)) }
  })
  if (width === parent.width && height === parent.height && placements.every((p, i) => p.x === children[i]?.x && p.y === children[i]?.y)) return null
  const nextGraph = structuredClone(graph)
  const nextLoop = nextGraph.nodes.find((node): node is LoopNode => node.id === loopId && node.type === 'loop')
  if (!nextLoop) return null
  nextLoop.config.body.layout.nodePlacements = placements.map(p => ({ ...p }))
  return { graph: nextGraph, layout: { ...structuredClone(layout), nodePlacements: layout.nodePlacements.map(p => p.nodeId === loopId ? { ...p, width, height } : { ...p }) } }
}
