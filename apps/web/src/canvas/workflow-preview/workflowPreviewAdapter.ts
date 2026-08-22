import type { AgentWorkflowEditorDocument, UUID, WorkflowNode } from '@odyssey/schemas'

export interface WorkflowPreviewBounds {
  readonly width: number
  readonly height: number
  readonly padding: number
}

export interface WorkflowPreviewPoint { readonly x: number; readonly y: number }

export interface WorkflowPreviewNode {
  readonly id: UUID
  readonly name: string
  readonly type: WorkflowNode['type']
  readonly position: WorkflowPreviewPoint
  readonly width: number
  readonly height: number
}

export interface WorkflowPreviewEdge {
  readonly id: UUID
  readonly sourceNodeId: UUID
  readonly targetNodeId: UUID
  readonly source: WorkflowPreviewPoint
  readonly target: WorkflowPreviewPoint
}

export type WorkflowPreviewDiagnostic =
  | { readonly code: 'NODE_PLACEMENT_MISSING'; readonly id: UUID }
  | { readonly code: 'EDGE_ENDPOINT_MISSING'; readonly id: UUID }

export interface WorkflowPreviewViewModel {
  readonly agentId: UUID
  readonly agentName: string
  readonly nodes: readonly WorkflowPreviewNode[]
  readonly edges: readonly WorkflowPreviewEdge[]
  readonly bounds: WorkflowPreviewBounds
  readonly diagnostics: readonly WorkflowPreviewDiagnostic[]
}

export const DEFAULT_WORKFLOW_PREVIEW_BOUNDS: WorkflowPreviewBounds = {
  width: 328,
  height: 156,
  padding: 24,
}

const NODE_WIDTH = 64
const NODE_HEIGHT = 32
const FALLBACK_EXTENT = 120

export function createWorkflowPreviewViewModel(
  document: Readonly<AgentWorkflowEditorDocument>,
  bounds: WorkflowPreviewBounds = DEFAULT_WORKFLOW_PREVIEW_BOUNDS,
): WorkflowPreviewViewModel {
  const diagnostics: WorkflowPreviewDiagnostic[] = []
  const placementByNodeId = new Map(document.layout.nodePlacements.map((placement) => [placement.nodeId, placement]))
  const placedNodes = document.workflow.nodes.flatMap((node) => {
    const placement = placementByNodeId.get(node.id)
    if (!placement) {
      diagnostics.push({ code: 'NODE_PLACEMENT_MISSING', id: node.id })
      return []
    }
    return [{ node, placement }]
  })

  const xs = placedNodes.map(({ placement }) => placement.x)
  const ys = placedNodes.map(({ placement }) => placement.y)
  const minX = xs.length ? Math.min(...xs) : 0
  const maxX = xs.length ? Math.max(...xs) : 0
  const minY = ys.length ? Math.min(...ys) : 0
  const maxY = ys.length ? Math.max(...ys) : 0
  const sourceWidth = Math.max(maxX - minX, FALLBACK_EXTENT)
  const sourceHeight = Math.max(maxY - minY, FALLBACK_EXTENT)
  const availableWidth = Math.max(1, bounds.width - bounds.padding * 2 - NODE_WIDTH)
  const availableHeight = Math.max(1, bounds.height - bounds.padding * 2 - NODE_HEIGHT)
  const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight)
  const renderedWidth = (maxX - minX) * scale
  const renderedHeight = (maxY - minY) * scale
  const offsetX = (bounds.width - renderedWidth) / 2
  const offsetY = (bounds.height - renderedHeight) / 2

  const nodes = placedNodes.map<WorkflowPreviewNode>(({ node, placement }) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    position: {
      x: offsetX + (placement.x - minX) * scale,
      y: offsetY + (placement.y - minY) * scale,
    },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = document.workflow.edges.flatMap<WorkflowPreviewEdge>((edge) => {
    const source = nodeById.get(edge.sourceNodeId)
    const target = nodeById.get(edge.targetNodeId)
    if (!source || !target) {
      diagnostics.push({ code: 'EDGE_ENDPOINT_MISSING', id: edge.id })
      return []
    }
    return [{
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      source: anchorRectangle(source, target.position),
      target: anchorRectangle(target, source.position),
    }]
  })

  return {
    agentId: document.agent.id,
    agentName: document.agent.name,
    nodes,
    edges,
    bounds,
    diagnostics,
  }
}

function anchorRectangle(node: WorkflowPreviewNode, destination: WorkflowPreviewPoint): WorkflowPreviewPoint {
  const dx = destination.x - node.position.x
  const dy = destination.y - node.position.y
  if (dx === 0 && dy === 0) return node.position
  const scale = 1 / Math.max(Math.abs(dx) / (node.width / 2), Math.abs(dy) / (node.height / 2))
  return { x: node.position.x + dx * scale, y: node.position.y + dy * scale }
}
