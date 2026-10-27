import type { KnowledgeGraphOverview, UUID } from '@odyssey/schemas'

export function filterKnowledgeGraphByFamily(graph: KnowledgeGraphOverview, familyId: UUID | null): KnowledgeGraphOverview {
  if (familyId === null) return graph
  const family = graph.families.find(candidate => candidate.id === familyId)
  if (!family) return graph
  const visibleNodeIds = new Set(family.resourceIds)
  const visibleEdges = graph.edges.filter(edge => visibleNodeIds.has(edge.sourceResourceId) && visibleNodeIds.has(edge.targetResourceId))
  const visibleEdgeIds = new Set(visibleEdges.map(edge => edge.id))
  return {
    ...graph,
    nodes: graph.nodes.filter(node => visibleNodeIds.has(node.id)),
    edges: visibleEdges,
    issues: graph.issues.filter(issue => issue.resourceIds.some(resourceId => visibleNodeIds.has(resourceId)) || issue.relationIds.some(relationId => visibleEdgeIds.has(relationId))),
  }
}
