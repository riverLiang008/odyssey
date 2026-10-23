import { describeEndTarget } from '@/domain/workflow/workflowEndRouting'
import type { JourneyEditorDocument, CanvasLayout, LoopBodyGraph, LoopBodyNode, LoopNode, UUID, WorkflowGraph, WorkflowNode } from '@odyssey/schemas'
import { MarkerType, Position, type Edge, type Node, type ViewportTransform } from '@vue-flow/core'

export interface WorkflowCanvasNodeData {
  readonly branchConnectedHandles?: readonly UUID[]
  readonly boundaryLabel?: string
  readonly node: WorkflowNode | LoopBodyNode
  readonly branchHandles: readonly { readonly id: UUID; readonly label: string }[]
  readonly context?: { readonly kind: 'root' } | { readonly kind: 'loop-body'; readonly loopNodeId: UUID }
  readonly compoundLoop?: boolean
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
  routingJourney?: JourneyEditorDocument | null,
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
      data: { ...(node.type === 'end' && node.config.binding && routingJourney ? { boundaryLabel: describeEndTarget(node.config.binding, routingJourney.pattern, routingJourney.agents) } : {}), node: structuredClone(node), branchHandles: branchHandles(node), ...(node.type === 'branch' ? { branchConnectedHandles: graph.edges.flatMap(e => e.sourceNodeId === node.id && e.sourceHandleId ? [e.sourceHandleId] : []) } : {}), context: { kind: 'root' }, compoundLoop: node.type === 'loop' && 'schemaVersion' in graph },
      ...(node.type === 'loop' && 'schemaVersion' in graph ? { style: { width: `${placement?.width ?? 720}px`, height: `${placement?.height ?? 480}px` } } : {}),
      draggable: true,
      selectable: true,
      deletable: !['start', 'end', 'loop_start', 'loop_end'].includes(node.type),
    }
  })
  if ('schemaVersion' in graph) {
    for (const loop of graph.nodes.filter((candidate): candidate is LoopNode => candidate.type === 'loop')) {
      const childPlacements = new Map(loop.config.body.layout.nodePlacements.map((placement) => [placement.nodeId, placement]))
      loop.config.body.graph.nodes.forEach((node, index) => {
        const placement = childPlacements.get(node.id)
        if (!placement) diagnostics.push({ code: 'MISSING_PLACEMENT', nodeId: node.id })
        nodes.push({
          id: node.id,
          type: 'workflow',
          position: placement ? { x: placement.x, y: placement.y } : fallbackPosition(index),
          parentNode: loop.id,
          extent: 'parent',
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: { node: structuredClone(node), branchHandles: branchHandles(node), ...(node.type === 'branch' ? { branchConnectedHandles: loop.config.body.graph.edges.flatMap(e => e.sourceNodeId === node.id && e.sourceHandleId ? [e.sourceHandleId] : []) } : {}), context: { kind: 'loop-body', loopNodeId: loop.id }, compoundLoop: false },
          draggable: true,
          selectable: true,
          deletable: !['loop_start', 'loop_end'].includes(node.type),
          zIndex: 2,
        })
      })
    }
  }
  const edges = graph.edges.map((edge): Edge => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    ...(edge.sourceHandleId ? { sourceHandle: edge.sourceHandleId } : {}),
    type: 'smoothstep',
    markerEnd: MarkerType.ArrowClosed,
    style: { stroke: '#4d72f2', strokeWidth: 2 },
  }))
  if ('schemaVersion' in graph) {
    for (const loop of graph.nodes.filter((candidate): candidate is LoopNode => candidate.type === 'loop')) {
      edges.push(...loop.config.body.graph.edges.map((edge): Edge => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        ...(edge.sourceHandleId ? { sourceHandle: edge.sourceHandleId } : {}),
        type: 'smoothstep',
        markerEnd: MarkerType.ArrowClosed,
        style: { stroke: '#c8942f', strokeWidth: 2 },
        zIndex: 3,
      })))
    }
  }
  return {
    nodes,
    edges,
    viewport: { ...layout.viewport },
    diagnostics,
  }
}
