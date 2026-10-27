import { MarkerType, Position, type Edge, type Node } from '@vue-flow/core'
import type { KnowledgeGraphEdge, KnowledgeGraphFamily, KnowledgeGraphIssue, KnowledgeGraphNode, KnowledgeGraphOverview, UUID } from '@odyssey/schemas'
import { layoutKnowledgeGraph, type KnowledgeGraphLayoutDiagnostic } from './knowledgeGraphLayout'

export interface KnowledgeGraphCanvasNodeData {
  readonly node: KnowledgeGraphNode
  readonly families: readonly KnowledgeGraphFamily[]
  readonly issues: readonly KnowledgeGraphIssue[]
}

export interface KnowledgeGraphCanvasEdgeData {
  readonly relation: KnowledgeGraphEdge
  readonly issues: readonly KnowledgeGraphIssue[]
}

export interface KnowledgeGraphCanvasProjection {
  readonly nodes: readonly Node<KnowledgeGraphCanvasNodeData>[]
  readonly edges: readonly Edge<KnowledgeGraphCanvasEdgeData>[]
  readonly diagnostics: readonly KnowledgeGraphLayoutDiagnostic[]
}

export function projectKnowledgeGraphCanvas(graph: KnowledgeGraphOverview): KnowledgeGraphCanvasProjection {
  const layout = layoutKnowledgeGraph(graph)
  const placements = new Map(layout.placements.map(placement => [placement.nodeId, placement]))
  const familiesByNode = new Map<UUID, KnowledgeGraphFamily[]>()
  for (const family of graph.families) {
    for (const resourceId of family.resourceIds) familiesByNode.set(resourceId, [...(familiesByNode.get(resourceId) ?? []), family])
  }
  const issuesByNode = new Map<UUID, KnowledgeGraphIssue[]>()
  const issuesByEdge = new Map<UUID, KnowledgeGraphIssue[]>()
  for (const issue of graph.issues.filter(candidate => candidate.resolutionStatus === 'open' || candidate.resolutionStatus === 'accepted')) {
    for (const resourceId of issue.resourceIds) issuesByNode.set(resourceId, [...(issuesByNode.get(resourceId) ?? []), issue])
    for (const relationId of issue.relationIds) issuesByEdge.set(relationId, [...(issuesByEdge.get(relationId) ?? []), issue])
  }
  const invalidEdgeIds = new Set(layout.diagnostics.map(diagnostic => diagnostic.edgeId))
  return {
    nodes: graph.nodes.flatMap((node): Node<KnowledgeGraphCanvasNodeData>[] => {
      const placement = placements.get(node.id)
      if (!placement) return []
      return [{
        id: node.id,
        type: 'knowledge-document',
        position: { x: placement.x, y: placement.y },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          node,
          families: [...(familiesByNode.get(node.id) ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
          issues: [...(issuesByNode.get(node.id) ?? [])],
        },
        draggable: false,
        connectable: false,
        selectable: true,
        deletable: false,
        focusable: true,
      }]
    }),
    edges: graph.edges.filter(edge => !invalidEdgeIds.has(edge.id)).map((edge): Edge<KnowledgeGraphCanvasEdgeData> => {
      const sourcePlacement = placements.get(edge.sourceResourceId)
      const targetPlacement = placements.get(edge.targetResourceId)
      const isInsideCyclicComponent = sourcePlacement?.componentId === targetPlacement?.componentId
        && sourcePlacement?.nodeId !== targetPlacement?.nodeId
      return {
        id: edge.id,
        source: edge.sourceResourceId,
        target: edge.targetResourceId,
        type: isInsideCyclicComponent ? 'default' : 'smoothstep',
        label: edge.kind.replaceAll('_', ' '),
        markerEnd: MarkerType.ArrowClosed,
        animated: false,
        selectable: false,
        focusable: true,
        updatable: false,
        deletable: false,
        data: { relation: edge, issues: [...(issuesByEdge.get(edge.id) ?? [])] },
        style: {
          stroke: edge.status === 'needs_review' ? 'var(--odyssey-warning, #c8942f)' : 'var(--odyssey-primary, #5073f3)',
          strokeWidth: edge.status === 'needs_review' ? 2.25 : 1.6,
          strokeDasharray: edge.status === 'needs_review' ? '6 4' : undefined,
        },
      }
    }),
    diagnostics: layout.diagnostics,
  }
}
