import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { createCanvasLayoutFixture, createWorkflowGraphFixture } from '@/fixtures'
import { addNode } from '@/domain/workflow'
import { addNodePlacement, moveNodePlacement, removeNodePlacement, updateCanvasViewport } from './workflowLayoutCommands'

const NODE_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8990')

describe('workflow layout commands', () => {
  it('adds, moves, and removes placements immutably', () => {
    const graph = createWorkflowGraphFixture('minimal')
    const layout = createCanvasLayoutFixture(graph)
    const graphWithNode = addNode(graph, { id: NODE_ID, type: 'task', name: 'Task', config: { localVariables: [], steps: [] } })
    if (!graphWithNode.ok) throw new Error('Expected valid graph')
    const added = addNodePlacement(layout, graphWithNode.value, NODE_ID, { x: 20, y: 40 })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(layout.nodePlacements).toHaveLength(2)
    const moved = moveNodePlacement(added.value, NODE_ID, { x: 90, y: 110 })
    expect(moved.ok && moved.value.nodePlacements.find((item) => item.nodeId === NODE_ID)).toEqual({ nodeId: NODE_ID, x: 90, y: 110 })
    const removed = moved.ok ? removeNodePlacement(moved.value, NODE_ID) : moved
    expect(removed.ok && removed.value.nodePlacements.some((item) => item.nodeId === NODE_ID)).toBe(false)
  })

  it('rejects invalid positions and viewport without modifying input', () => {
    const graph = createWorkflowGraphFixture('minimal')
    const layout = createCanvasLayoutFixture(graph)
    const before = structuredClone(layout)
    expect(moveNodePlacement(layout, graph.nodes[0]!.id, { x: Number.NaN, y: 1 })).toMatchObject({ ok: false, error: { code: 'INVALID_POSITION' } })
    expect(updateCanvasViewport(layout, { x: 0, y: 0, zoom: 0 })).toEqual({ ok: false, error: { code: 'INVALID_VIEWPORT' } })
    expect(layout).toEqual(before)
  })
})

