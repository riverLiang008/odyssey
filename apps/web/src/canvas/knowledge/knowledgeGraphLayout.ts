import type { KnowledgeGraphOverview, UUID } from '@odyssey/schemas'

export interface KnowledgeGraphPoint { readonly x: number; readonly y: number }
export interface KnowledgeGraphViewport extends KnowledgeGraphPoint { readonly zoom: number }

export interface KnowledgeGraphPlacement extends KnowledgeGraphPoint {
  readonly nodeId: UUID
  readonly rank: number
  readonly componentId: string
}

export interface KnowledgeGraphLayoutDiagnostic {
  readonly code: 'MISSING_EDGE_ENDPOINT'
  readonly edgeId: UUID
}

export interface KnowledgeGraphLayout {
  readonly placements: readonly KnowledgeGraphPlacement[]
  readonly diagnostics: readonly KnowledgeGraphLayoutDiagnostic[]
  readonly width: number
  readonly height: number
}

interface Component {
  readonly id: string
  readonly nodeIds: readonly UUID[]
  readonly isIsolated: boolean
}

const NODE_WIDTH = 224
const NODE_HEIGHT = 140
const NODE_COLUMN_GAP = 96
const NODE_ROW_GAP = 72
const RANK_GAP = 128
const COMPONENT_GAP = 96
const PADDING_X = 96
const PADDING_Y = 96

interface ComponentFootprint {
  readonly columns: number
  readonly rows: number
  readonly width: number
  readonly height: number
}

function componentFootprint(nodeCount: number): ComponentFootprint {
  const columns = nodeCount <= 1 ? 1 : Math.ceil(Math.sqrt(nodeCount))
  const rows = Math.ceil(nodeCount / columns)
  return {
    columns,
    rows,
    width: columns * NODE_WIDTH + Math.max(0, columns - 1) * NODE_COLUMN_GAP,
    height: rows * NODE_HEIGHT + Math.max(0, rows - 1) * NODE_ROW_GAP,
  }
}

function stableNodeIds(graph: KnowledgeGraphOverview): UUID[] {
  return [...graph.nodes]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) || left.id.localeCompare(right.id))
    .map(node => node.id)
}

function findStronglyConnectedComponents(nodeIds: readonly UUID[], adjacency: ReadonlyMap<UUID, readonly UUID[]>): UUID[][] {
  let nextIndex = 0
  const indices = new Map<UUID, number>()
  const lowLinks = new Map<UUID, number>()
  const stack: UUID[] = []
  const onStack = new Set<UUID>()
  const components: UUID[][] = []

  const visit = (nodeId: UUID) => {
    const index = nextIndex++
    indices.set(nodeId, index)
    lowLinks.set(nodeId, index)
    stack.push(nodeId)
    onStack.add(nodeId)

    for (const targetId of adjacency.get(nodeId) ?? []) {
      if (!indices.has(targetId)) {
        visit(targetId)
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId) ?? index, lowLinks.get(targetId) ?? index))
      } else if (onStack.has(targetId)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId) ?? index, indices.get(targetId) ?? index))
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return
    const component: UUID[] = []
    while (stack.length > 0) {
      const member = stack.pop()
      if (!member) break
      onStack.delete(member)
      component.push(member)
      if (member === nodeId) break
    }
    components.push(component.sort((left, right) => nodeIds.indexOf(left) - nodeIds.indexOf(right)))
  }

  for (const nodeId of nodeIds) if (!indices.has(nodeId)) visit(nodeId)
  return components
}

export function layoutKnowledgeGraph(graph: KnowledgeGraphOverview): KnowledgeGraphLayout {
  const nodeIds = stableNodeIds(graph)
  const nodeIdSet = new Set(nodeIds)
  const diagnostics: KnowledgeGraphLayoutDiagnostic[] = []
  const validEdges = graph.edges.filter((edge) => {
    const valid = nodeIdSet.has(edge.sourceResourceId) && nodeIdSet.has(edge.targetResourceId)
    if (!valid) diagnostics.push({ code: 'MISSING_EDGE_ENDPOINT', edgeId: edge.id })
    return valid
  })
  const adjacency = new Map<UUID, UUID[]>(nodeIds.map(nodeId => [nodeId, []]))
  const incidentCount = new Map<UUID, number>(nodeIds.map(nodeId => [nodeId, 0]))
  for (const edge of validEdges) {
    adjacency.get(edge.sourceResourceId)?.push(edge.targetResourceId)
    incidentCount.set(edge.sourceResourceId, (incidentCount.get(edge.sourceResourceId) ?? 0) + 1)
    incidentCount.set(edge.targetResourceId, (incidentCount.get(edge.targetResourceId) ?? 0) + 1)
  }
  for (const targets of adjacency.values()) targets.sort((left, right) => nodeIds.indexOf(left) - nodeIds.indexOf(right))

  const rawComponents = findStronglyConnectedComponents(nodeIds, adjacency)
  const componentByNode = new Map<UUID, number>()
  rawComponents.forEach((component, componentIndex) => component.forEach(nodeId => componentByNode.set(nodeId, componentIndex)))
  const outgoing = new Map<number, Set<number>>(rawComponents.map((_, index) => [index, new Set()]))
  const incoming = new Map<number, Set<number>>(rawComponents.map((_, index) => [index, new Set()]))
  for (const edge of validEdges) {
    const sourceComponent = componentByNode.get(edge.sourceResourceId)
    const targetComponent = componentByNode.get(edge.targetResourceId)
    if (sourceComponent === undefined || targetComponent === undefined || sourceComponent === targetComponent) continue
    outgoing.get(sourceComponent)?.add(targetComponent)
    incoming.get(targetComponent)?.add(sourceComponent)
  }

  const stableComponentKey = (componentIndex: number) => rawComponents[componentIndex]?.map(nodeId => nodeIds.indexOf(nodeId).toString().padStart(8, '0')).join(':') ?? ''
  const indegrees = new Map<number, number>(rawComponents.map((_, index) => [index, incoming.get(index)?.size ?? 0]))
  const queue = rawComponents.map((_, index) => index).filter(index => (indegrees.get(index) ?? 0) === 0).sort((a, b) => stableComponentKey(a).localeCompare(stableComponentKey(b)))
  const topological: number[] = []
  while (queue.length > 0) {
    const componentIndex = queue.shift()
    if (componentIndex === undefined) break
    topological.push(componentIndex)
    for (const target of [...(outgoing.get(componentIndex) ?? [])].sort((a, b) => stableComponentKey(a).localeCompare(stableComponentKey(b)))) {
      const next = (indegrees.get(target) ?? 0) - 1
      indegrees.set(target, next)
      if (next === 0) {
        queue.push(target)
        queue.sort((a, b) => stableComponentKey(a).localeCompare(stableComponentKey(b)))
      }
    }
  }

  const ranks = new Map<number, number>()
  for (const componentIndex of topological) {
    const predecessors = [...(incoming.get(componentIndex) ?? [])]
    ranks.set(componentIndex, predecessors.length === 0 ? 0 : Math.max(...predecessors.map(index => ranks.get(index) ?? 0)) + 1)
  }
  const connectedMaxRank = Math.max(0, ...rawComponents.map((component, index) => component.some(nodeId => (incidentCount.get(nodeId) ?? 0) > 0) ? (ranks.get(index) ?? 0) : 0))
  const components: Component[] = rawComponents.map((nodeIdsInComponent, index) => {
    const isIsolated = nodeIdsInComponent.every(nodeId => (incidentCount.get(nodeId) ?? 0) === 0)
    return { id: `component-${stableComponentKey(index)}`, nodeIds: nodeIdsInComponent, isIsolated }
  })
  const groups = new Map<number, { component: Component; componentIndex: number }[]>()
  components.forEach((component, componentIndex) => {
    const rank = component.isIsolated ? connectedMaxRank + 1 : (ranks.get(componentIndex) ?? 0)
    groups.set(rank, [...(groups.get(rank) ?? []), { component, componentIndex }])
  })
  for (const group of groups.values()) group.sort((left, right) => left.component.id.localeCompare(right.component.id))

  const orderedGroups = [...groups.entries()].sort(([left], [right]) => left - right)
  const rankMetrics = orderedGroups.map(([rank, group]) => {
    const footprints = group.map(({ component }) => componentFootprint(component.nodeIds.length))
    return {
      rank,
      group,
      footprints,
      width: Math.max(...footprints.map(footprint => footprint.width)),
      height: footprints.reduce((total, footprint) => total + footprint.height, 0) + Math.max(0, footprints.length - 1) * COMPONENT_GAP,
    }
  })
  const contentHeight = Math.max(0, ...rankMetrics.map(metric => metric.height))
  const rankX = new Map<number, number>()
  let nextX = PADDING_X
  for (const metric of rankMetrics) {
    rankX.set(metric.rank, nextX)
    nextX += metric.width + RANK_GAP
  }

  const placements: KnowledgeGraphPlacement[] = []
  for (const metric of rankMetrics) {
    let nextY = PADDING_Y + (contentHeight - metric.height) / 2
    metric.group.forEach(({ component }, componentIndex) => {
      const footprint = metric.footprints[componentIndex]
      if (!footprint) return
      component.nodeIds.forEach((nodeId, nodeIndex) => {
        const column = nodeIndex % footprint.columns
        const row = Math.floor(nodeIndex / footprint.columns)
        placements.push({
          nodeId,
          x: (rankX.get(metric.rank) ?? PADDING_X) + column * (NODE_WIDTH + NODE_COLUMN_GAP),
          y: nextY + row * (NODE_HEIGHT + NODE_ROW_GAP),
          rank: metric.rank,
          componentId: component.id,
        })
      })
      nextY += footprint.height + COMPONENT_GAP
    })
  }

  return {
    placements,
    diagnostics,
    width: Math.max(640, nextX - RANK_GAP + PADDING_X),
    height: Math.max(380, contentHeight + PADDING_Y * 2),
  }
}
