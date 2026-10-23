import { describe, expect, it } from 'vitest'
import { deriveEndBindings, endBindingKey, uuidSchema, type CanvasLayout } from '@odyssey/schemas'

import { instantiatePattern } from '../pattern/patternStrategies'
import { setHubSpokeDirection } from '../pattern/patternCommands'
import { createMinimalAgentWorkflow } from './workflowFactories'
import { reconcileWorkflowEnds } from './workflowEndRouting'
import { validateWorkflowGraph } from './workflowValidation'

let sequence = 0
const id = () => uuidSchema.parse(`10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`)
const ids = { nodeId: id, edgeId: id, slotId: id, routeId: id, patternId: id }
function minimal() {
  const graph = createMinimalAgentWorkflow(ids)
  const layout: CanvasLayout = { schemaVersion: '1.0.0', nodePlacements: graph.nodes.map((node, index) => ({ nodeId: node.id, x: index * 200, y: 0 })), viewport: { x: 0, y: 0, zoom: 1 } }
  return { graph, layout }
}

describe('Pattern-owned End boundaries', () => {
  it('generates all Hub exits including empty Slots, removes ambiguous legacy wiring, and is idempotent', () => {
    const pattern = instantiatePattern('hub_and_spoke', ids)
    const hub = pattern.slots[0]!
    const { graph, layout } = minimal()
    const input = structuredClone({ graph, layout, pattern })
    const result = reconcileWorkflowEnds(graph, layout, pattern, hub.id, ids)
    expect(result.graph.nodes.filter((node) => node.type === 'end')).toHaveLength(4)
    expect(result.removedEdgeIds).toEqual(graph.edges.map((edge) => edge.id))
    expect(result.graph.edges).toEqual([])
    expect(validateWorkflowGraph(result.graph).isStructurallyValid).toBe(true)
    expect(validateWorkflowGraph(result.graph).isExecutionReady).toBe(false)
    expect(reconcileWorkflowEnds(result.graph, result.layout, pattern, hub.id, ids)).toMatchObject({ changed: false })
    expect({ graph, layout, pattern }).toEqual(input)
  })

  it('keeps Linear next-boundary identity and incoming edge when its target changes', () => {
    const pattern = instantiatePattern('linear_sequence', ids)
    const { graph, layout } = minimal()
    const first = reconcileWorkflowEnds(graph, layout, pattern, pattern.slots[0]!.id, ids)
    const next = structuredClone(pattern)
    next.routes[0]!.target = { type: 'slot', slotId: pattern.slots[2]!.id }
    const second = reconcileWorkflowEnds(first.graph, first.layout, next, pattern.slots[0]!.id, ids)
    expect(second.graph.edges).toEqual(graph.edges)
    expect(second.graph.nodes.filter((node) => node.type === 'end').map((node) => node.id)).toEqual([graph.nodes[1]!.id])
  })

  it('changes only the affected Hub exit, cleans its incoming edges, and never changes Pattern', () => {
    const pattern = instantiatePattern('hub_and_spoke', ids)
    const { graph, layout } = minimal()
    const first = reconcileWorkflowEnds(graph, layout, pattern, pattern.slots[0]!.id, ids)
    const ends = first.graph.nodes.filter((node) => node.type === 'end')
    first.graph.edges.push({ id: id(), sourceNodeId: graph.nodes[0]!.id, targetNodeId: ends[0]!.id })
    const command = setHubSpokeDirection(pattern, pattern.slots[1]!.id, 'spoke_to_hub', ids)
    expect(command.ok).toBe(true)
    if (!command.ok) return
    const second = reconcileWorkflowEnds(first.graph, first.layout, command.value, pattern.slots[0]!.id, ids)
    expect(second.removedEndIds).toEqual([ends[0]!.id])
    expect(second.graph.edges).toEqual([])
    expect(second.graph.nodes.filter((node) => node.type === 'end').map((node) => node.id)).toEqual(ends.slice(1).map((node) => node.id))
    expect(pattern.routes).toHaveLength(4)
  })

  it('derives reverse exits and exactly one completion exit for a leaf', () => {
    const pattern = instantiatePattern('hub_and_spoke', ids)
    const spoke = pattern.slots[1]!
    expect(deriveEndBindings(pattern, spoke.id)).toEqual([{ sourceSlotId: spoke.id, target: { type: 'journey_end' } }])
    const command = setHubSpokeDirection(pattern, spoke.id, 'bidirectional', ids)
    if (!command.ok) throw new Error('Direction command failed')
    expect(deriveEndBindings(command.value, spoke.id)).toEqual([{ sourceSlotId: spoke.id, target: { type: 'slot', slotId: pattern.slots[0]!.id } }])
    expect(setHubSpokeDirection(instantiatePattern('linear_sequence', ids), spoke.id, 'bidirectional', ids).ok).toBe(false)
  })

  it('keeps boundary and reference invariants across a deterministic sequence of direction changes', () => {
    let pattern = instantiatePattern('hub_and_spoke', ids)
    const sourceId = pattern.slots[0]!.id
    let { graph, layout } = minimal()
    let seed = 719
    const random = () => { seed = (seed * 16807) % 2147483647; return seed }
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const spoke = pattern.slots[1 + random() % (pattern.slots.length - 1)]!
      const direction = (['hub_to_spoke', 'spoke_to_hub', 'bidirectional'] as const)[random() % 3]!
      const changed = setHubSpokeDirection(pattern, spoke.id, direction, ids)
      if (!changed.ok) throw new Error('A supported direction was rejected')
      pattern = changed.value
      const before = structuredClone({ graph, layout, pattern })
      const routed = reconcileWorkflowEnds(graph, layout, pattern, sourceId, ids)
      expect({ graph, layout, pattern }).toEqual(before)
      graph = routed.graph; layout = routed.layout
      const ends = graph.nodes.filter((node) => node.type === 'end')
      expect(ends.map((end) => endBindingKey(end.config.binding!)).sort()).toEqual(deriveEndBindings(pattern, sourceId).map(endBindingKey).sort())
      const nodeIds = new Set(graph.nodes.map((node) => node.id))
      expect(nodeIds.size).toBe(graph.nodes.length)
      expect(graph.edges.every((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))).toBe(true)
      expect(layout.nodePlacements.every((placement) => nodeIds.has(placement.nodeId))).toBe(true)
      expect(reconcileWorkflowEnds(graph, layout, pattern, sourceId, ids).changed).toBe(false)
      graph.edges = [{ id: id(), sourceNodeId: graph.nodes.find((node) => node.type === 'start')!.id, targetNodeId: ends[random() % ends.length]!.id }]
    }
  })
})
