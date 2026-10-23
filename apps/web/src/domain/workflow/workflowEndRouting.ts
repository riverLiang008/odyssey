import {
  deriveEndBindings, endBindingKey,
  type CanvasLayout, type EndBinding, type EndNode, type PatternConfig, type UUID, type WorkflowGraph,
} from '@odyssey/schemas'

import type { WorkflowIdFactory } from './workflowIdFactory'

export interface EndRoutingResult {
  readonly graph: WorkflowGraph
  readonly layout: CanvasLayout
  readonly removedEndIds: readonly UUID[]
  readonly removedEdgeIds: readonly UUID[]
  readonly changed: boolean
}

const END_EXIT_VERTICAL_GAP = 100

export function workflowEndRoutingStatus(graph: WorkflowGraph, pattern: PatternConfig, agentId: UUID) {
  const slot = pattern.slots.find((candidate) => candidate.agentId === agentId)
  if (!slot) return null // Guardrail and unassigned Agents use separate boundary semantics.
  const expected = deriveEndBindings(pattern, slot.id).map(endBindingKey).sort()
  const ends = graph.nodes.filter((node): node is EndNode => node.type === 'end')
  const actual = ends.flatMap((end) => end.config.binding ? [endBindingKey(end.config.binding)] : []).sort()
  const synchronized = expected.length === actual.length && expected.every((key, index) => actual[index] === key)
  const missingTargets = ends.filter((end) => {
    const target = end.config.binding?.target
    return target?.type === 'slot' && !pattern.slots.find((candidate) => candidate.id === target.slotId)?.agentId
  }).length
  const unconnected = ends.filter((end) => !graph.edges.some((edge) => edge.targetNodeId === end.id)).length
  return { synchronized, missingTargets, unconnected }
}

/** Application callers must confirm destructive impact before persisting this candidate. */
export function reconcileWorkflowEnds(
  graph: WorkflowGraph,
  layout: CanvasLayout,
  pattern: PatternConfig,
  slotId: UUID,
  ids: Pick<WorkflowIdFactory, 'nodeId'>,
): EndRoutingResult {
  const bindings = deriveEndBindings(pattern, slotId)
  if (!bindings.length) throw new Error('Routing requires an existing source Slot')
  const ends = graph.nodes.filter((node): node is EndNode => node.type === 'end')
  const sequential = pattern.kind === 'linear_sequence' || pattern.kind === 'diamond_loop'
  const singleLegacy = ends.length === 1 && !ends[0]?.config.binding && bindings.length === 1
  const retained = new Set<UUID>()
  const nextEnds = bindings.map((binding): EndNode => {
    const existing = ends.find((end) => !retained.has(end.id) && (
      end.config.binding && endBindingKey(end.config.binding) === endBindingKey(binding)
    )) ?? ((sequential || singleLegacy) && ends.length === 1 && bindings.length === 1 ? ends[0] : undefined)
    if (existing) retained.add(existing.id)
    return { id: existing?.id ?? ids.nodeId(), name: existing?.name ?? 'End', type: 'end', config: { binding } }
  })
  const removedEndIds = ends.filter((end) => !retained.has(end.id)).map((end) => end.id)
  const removed = new Set(removedEndIds)
  const removedEdgeIds = graph.edges.filter((edge) => removed.has(edge.sourceNodeId) || removed.has(edge.targetNodeId)).map((edge) => edge.id)
  const graphCopy = structuredClone(graph)
  graphCopy.schemaVersion = '1.1.0'
  graphCopy.nodes = [...graphCopy.nodes.filter((node) => node.type !== 'end'), ...nextEnds]
  graphCopy.edges = graphCopy.edges.filter((edge) => !removed.has(edge.sourceNodeId) && !removed.has(edge.targetNodeId))
  const layoutCopy = structuredClone(layout)
  layoutCopy.nodePlacements = layoutCopy.nodePlacements.filter((placement) => !removed.has(placement.nodeId))
  const placed = new Set(layoutCopy.nodePlacements.map((placement) => placement.nodeId))
  const internalIds = new Set(graph.nodes.filter((node) => node.type !== 'end').map((node) => node.id))
  const x = Math.max(0, ...layoutCopy.nodePlacements.filter((placement) => internalIds.has(placement.nodeId)).map((placement) => placement.x)) + 260
  nextEnds.forEach((end, index) => {
    if (!placed.has(end.id)) {
      let y = index * END_EXIT_VERTICAL_GAP
      while (layoutCopy.nodePlacements.some((placement) => placement.x === x && Math.abs(placement.y - y) < END_EXIT_VERTICAL_GAP)) y += END_EXIT_VERTICAL_GAP
      layoutCopy.nodePlacements.push({ nodeId: end.id, x, y })
    }
  })
  // Preserve original node ordering and object values on the no-op path.
  const oldById = new Map(graph.nodes.map((node) => [node.id, node]))
  const sameEnds = nextEnds.length === ends.length && nextEnds.every((end) => JSON.stringify(end) === JSON.stringify(oldById.get(end.id)))
  const changed = graph.schemaVersion !== '1.1.0' || !sameEnds || removedEdgeIds.length > 0 || layoutCopy.nodePlacements.length !== layout.nodePlacements.length
  return { graph: changed ? graphCopy : structuredClone(graph), layout: changed ? layoutCopy : structuredClone(layout), removedEndIds, removedEdgeIds, changed }
}

export function describeEndTarget(binding: EndBinding, pattern: PatternConfig, agents: readonly { id: UUID; name: string }[]): string {
  if (binding.target.type === 'journey_end') return 'Complete Journey'
  const targetId = binding.target.slotId
  const slot = pattern.slots.find((candidate) => candidate.id === targetId)
  if (!slot) return 'Unavailable target'
  const agent = agents.find((candidate) => candidate.id === slot.agentId)
  return agent ? `Handoff → ${slot.label} · ${agent.name}` : `Handoff → ${slot.label} (not configured)`
}
