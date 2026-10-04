import type { CanvasLayout, LoopBodyGraph, LoopBodyNode, LoopNode, UUID, WorkflowGraph, WorkflowNode } from '@odyssey/schemas'
import { MarkerType, Position, type Edge, type Node, type ViewportTransform } from '@vue-flow/core'

export interface WorkflowCanvasNodeData {
  readonly node: WorkflowNode | LoopBodyNode
  readonly branchHandles: readonly { readonly id: UUID; readonly label: string }[]
}

export interface WorkflowCanvasDiagnostic { readonly code: 'MISSING_PLACEMENT'; readonly nodeId: UUID }

export interface WorkflowCanvasProjection {
  readonly nodes: Node<WorkflowCanvasNodeData>[]
  readonly edges: Edge[]
  readonly viewport: ViewportTransform
  readonly diagnostics: WorkflowCanvasDiagnostic[]
}

const FALLBACK_COLUMNS = 4
const CONFIGURE_X_SPACING_FACTOR = 2.45
const CONFIGURE_Y_SPACING_FACTOR = 2.35
export interface WorkflowCanvasPoint { readonly x: number; readonly y: number }
const normalizeCanvasCoordinate = (value: number) => Math.round(value * 1_000) / 1_000

function placementOrigin(placements: readonly WorkflowCanvasPoint[]): WorkflowCanvasPoint {
  if (!placements.length) return { x: 0, y: 0 }
  return {
    x: Math.min(...placements.map((placement) => placement.x)),
    y: Math.min(...placements.map((placement) => placement.y)),
  }
}

export function fromWorkflowCanvasPosition(
  position: WorkflowCanvasPoint,
  layout: CanvasLayout | LoopNode['config']['body']['layout'],
  presentationMode: 'flow' | 'configure',
): WorkflowCanvasPoint {
  if (presentationMode === 'flow') return { ...position }
  const origin = placementOrigin(layout.nodePlacements)
  return {
    x: normalizeCanvasCoordinate(origin.x + (position.x - origin.x) / CONFIGURE_X_SPACING_FACTOR),
    y: normalizeCanvasCoordinate(origin.y + (position.y - origin.y) / CONFIGURE_Y_SPACING_FACTOR),
  }
}
function fallbackPosition(index: number) {
  return { x: 100 + (index % FALLBACK_COLUMNS) * 220, y: 100 + Math.floor(index / FALLBACK_COLUMNS) * 150 }
}

function branchHandles(node: WorkflowNode | LoopBodyNode): WorkflowCanvasNodeData['branchHandles'] {
  if (node.type !== 'branch') return []
  return [
    ...node.config.cases.map((branchCase) => ({ id: branchCase.id, label: branchCase.label })),
    { id: node.config.defaultCase.id, label: `Default · ${node.config.defaultCase.label}` },
  ]
}

export function projectWorkflowCanvas(
  graph: WorkflowGraph | LoopBodyGraph,
  layout: CanvasLayout | LoopNode['config']['body']['layout'],
  presentationMode: 'flow' | 'configure' = 'flow',
): WorkflowCanvasProjection {
  const placements = new Map(layout.nodePlacements.map((placement) => [placement.nodeId, placement]))
  const projectedPlacements = layout.nodePlacements.length
    ? layout.nodePlacements
    : graph.nodes.map((_, index) => ({ nodeId: graph.nodes[index]?.id, ...fallbackPosition(index) }))
  const { x: originX, y: originY } = placementOrigin(projectedPlacements)
  const diagnostics: WorkflowCanvasDiagnostic[] = []
  const nodes = graph.nodes.map((node, index): Node<WorkflowCanvasNodeData> => {
    const placement = placements.get(node.id)
    if (!placement) diagnostics.push({ code: 'MISSING_PLACEMENT', nodeId: node.id })
    return {
      id: node.id,
      type: 'workflow',
      position: (() => {
        const source = placement ? { x: placement.x, y: placement.y } : fallbackPosition(index)
        if (presentationMode === 'flow') return source
        return {
          x: originX + (source.x - originX) * CONFIGURE_X_SPACING_FACTOR,
          y: originY + (source.y - originY) * CONFIGURE_Y_SPACING_FACTOR,
        }
      })(),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { node: structuredClone(node), branchHandles: branchHandles(node) },
      draggable: true,
      selectable: true,
      deletable: !['start', 'end', 'loop_start', 'loop_end'].includes(node.type),
    }
  })
  const edges = graph.edges.map((edge): Edge => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    ...(edge.sourceHandleId ? { sourceHandle: edge.sourceHandleId } : {}),
    type: 'smoothstep',
    markerEnd: MarkerType.ArrowClosed,
    style: { stroke: '#4d72f2', strokeWidth: 2 },
  }))
  return {
    nodes,
    edges,
    viewport: { ...layout.viewport },
    diagnostics,
  }
}
