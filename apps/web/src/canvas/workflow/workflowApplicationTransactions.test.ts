import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { createCanvasLayoutFixture, createWorkflowGraphFixture } from '@/fixtures'
import {
  createLoopBodyNodeAt,
  createWorkflowNodeAt,
  removeLoopBodyNodeAndPlacement,
  removeWorkflowNodeAndPlacement,
} from './workflowApplicationTransactions'

const NODE_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8993')

describe('workflow application transactions', () => {
  it('creates and removes graph node plus placement as one result', () => {
    const graph = createWorkflowGraphFixture('minimal')
    const layout = createCanvasLayoutFixture(graph)
    const created = createWorkflowNodeAt({ graph, layout }, { id: NODE_ID, type: 'task', name: 'Task', config: { localVariables: [], steps: [] } }, { x: 12, y: 34 })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value.graph.nodes.some((node) => node.id === NODE_ID)).toBe(true)
    expect(created.value.layout.nodePlacements).toContainEqual({ nodeId: NODE_ID, x: 12, y: 34 })
    const removed = removeWorkflowNodeAndPlacement(created.value, NODE_ID)
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.value.graph.nodes.some((node) => node.id === NODE_ID)).toBe(false)
    expect(removed.value.layout.nodePlacements.some((placement) => placement.nodeId === NODE_ID)).toBe(false)
  })

  it('does not expose a partial candidate when placement fails', () => {
    const graph = createWorkflowGraphFixture('minimal')
    const layout = createCanvasLayoutFixture(graph)
    const before = structuredClone({ graph, layout })
    const result = createWorkflowNodeAt({ graph, layout }, { id: NODE_ID, type: 'task', name: 'Task', config: { localVariables: [], steps: [] } }, { x: Number.NaN, y: 10 })
    expect(result).toMatchObject({ ok: false, error: { kind: 'layout', error: { code: 'INVALID_POSITION' } } })
    expect({ graph, layout }).toEqual(before)
  })

  it('atomically creates and removes a Loop child node with its placement', () => {
    const root = createWorkflowGraphFixture('loop')
    const loop = root.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Expected Loop')
    const before = structuredClone(loop.config.body)
    const created = createLoopBodyNodeAt(before, loop.id, { id: NODE_ID, type: 'task', name: 'Child task', config: { localVariables: [], steps: [] } }, { x: 44, y: 55 })
    expect(created.ok).toBe(true)
    expect(loop.config.body).toEqual(before)
    if (!created.ok) return
    expect(created.value.graph.nodes.some((node) => node.id === NODE_ID)).toBe(true)
    expect(created.value.layout.nodePlacements).toContainEqual({ nodeId: NODE_ID, x: 44, y: 55 })
    const removed = removeLoopBodyNodeAndPlacement(created.value, loop.id, NODE_ID)
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.value).toEqual(before)
  })

  it('rejects an inconsistent Loop layout without exposing a partial candidate', () => {
    const root = createWorkflowGraphFixture('loop')
    const loop = root.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Expected Loop')
    const inconsistent = structuredClone(loop.config.body)
    inconsistent.layout.nodePlacements.push({ nodeId: NODE_ID, x: 1, y: 2 })
    const before = structuredClone(inconsistent)
    const result = createLoopBodyNodeAt(inconsistent, loop.id, { id: NODE_ID, type: 'task', name: 'Child task', config: { localVariables: [], steps: [] } }, { x: 44, y: 55 })
    expect(result).toMatchObject({ ok: false, error: { kind: 'layout', error: { code: 'NODE_NOT_FOUND', nodeId: NODE_ID } } })
    expect(inconsistent).toEqual(before)
  })

  it('rejects Loop boundary removal without changing graph or layout', () => {
    const root = createWorkflowGraphFixture('loop')
    const loop = root.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Expected Loop')
    const start = loop.config.body.graph.nodes.find((node) => node.type === 'loop_start')
    if (!start) throw new Error('Expected Loop Start')
    const before = structuredClone(loop.config.body)
    const result = removeLoopBodyNodeAndPlacement(loop.config.body, loop.id, start.id)
    expect(result).toMatchObject({ ok: false, error: { kind: 'graph', error: { code: 'BOUNDARY_NODE_IMMUTABLE' } } })
    expect(loop.config.body).toEqual(before)
  })
})
