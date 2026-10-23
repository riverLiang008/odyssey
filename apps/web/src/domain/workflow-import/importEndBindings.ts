import type { AgentWorkflowEditorDocument, AgentWorkflowExportDocument, EndNode, UUID } from '@odyssey/schemas'

export interface ImportEndMapping { sourceEndId: UUID; targetEndId: UUID }

/** Reuse server-owned boundaries; imported routing never grants new Pattern permissions. */
export function bindImportedEnds(
  source: AgentWorkflowExportDocument,
  current: AgentWorkflowEditorDocument,
  mapping?: readonly ImportEndMapping[],
): AgentWorkflowExportDocument | null {
  const targets = current.workflow.nodes.filter((node): node is EndNode => node.type === 'end')
  const sources = source.workflow.nodes.filter((node): node is EndNode => node.type === 'end')
  if (!targets.length || !sources.length) return null
  const supplied = new Map(mapping?.map((entry) => [entry.sourceEndId, entry.targetEndId]))
  if (mapping && (mapping.length !== sources.length || supplied.size !== sources.length)) return null
  const ids = new Map<UUID, UUID>()
  for (const node of sources) {
    const targetId = supplied.get(node.id) ?? (targets.length === 1 ? targets[0]?.id : undefined)
    if (!targetId || !targets.some((target) => target.id === targetId)) return null
    ids.set(node.id, targetId)
  }
  const result = structuredClone(source)
  result.workflow.schemaVersion = current.workflow.schemaVersion
  const internal = result.workflow.nodes.filter((node) => node.type !== 'end')
  if (internal.some((node) => targets.some((end) => end.id === node.id))) return null
  result.workflow.nodes = [...internal, ...structuredClone(targets)]
  const seen = new Set<string>()
  result.workflow.edges = result.workflow.edges.flatMap((edge) => {
    const targetNodeId = ids.get(edge.targetNodeId) ?? edge.targetNodeId
    const key = `${edge.sourceNodeId}:${edge.sourceHandleId ?? ''}:${targetNodeId}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...edge, targetNodeId }]
  })
  const originalPlacement = new Map(result.layout.nodePlacements.map((item) => [item.nodeId, item]))
  const sourceIds = new Set(sources.map((node) => node.id))
  result.layout.nodePlacements = result.layout.nodePlacements.filter((item) => !sourceIds.has(item.nodeId))
  targets.forEach((end, index) => {
    const sourceId = [...ids].find(([, targetId]) => targetId === end.id)?.[0]
    const placement = sourceId ? originalPlacement.get(sourceId) : undefined
    result.layout.nodePlacements.push(placement ? { ...placement, nodeId: end.id }
      : structuredClone(current.layout.nodePlacements.find((item) => item.nodeId === end.id) ?? { nodeId: end.id, x: 800, y: index * 140 }))
  })
  return result
}
