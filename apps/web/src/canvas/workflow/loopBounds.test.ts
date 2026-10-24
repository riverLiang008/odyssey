import { describe, expect, it } from 'vitest'
import { createCanvasLayoutFixture, createWorkflowGraphFixture } from '@/fixtures'
import { containLoopChildren } from './loopBounds'

describe('measured Loop bounds', () => {
  it.each([{ width: 372, height: 480 }, { width: 900, height: 600 }])('contains new and expanded cards %o without mutating input, and stabilizes', size => {
    const graph = createWorkflowGraphFixture('loop')
    const layout = createCanvasLayoutFixture(graph)
    const loop = graph.nodes.find(n => n.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Missing fixture')
    const child = loop.config.body.layout.nodePlacements[0]
    if (!child) throw new Error('Missing child')
    child.x = 700; child.y = 450
    const before = structuredClone({ graph, layout })
    const sizes = [{ nodeId: child.nodeId, ...size }]
    const result = containLoopChildren(graph, layout, loop.id, sizes)
    expect(result).not.toBeNull()
    if (!result) return
    const nextLoop = result.graph.nodes.find(n => n.type === 'loop')
    const nextChild = nextLoop?.type === 'loop' ? nextLoop.config.body.layout.nodePlacements[0] : undefined
    const parent = result.layout.nodePlacements.find(p => p.nodeId === loop.id)
    expect(nextChild?.x).toBeGreaterThanOrEqual(16)
    expect(nextChild?.y).toBeGreaterThanOrEqual(70)
    expect((nextChild?.x ?? 0) + size.width).toBeLessThanOrEqual((parent?.width ?? 0) - 24)
    expect((nextChild?.y ?? 0) + size.height).toBeLessThanOrEqual((parent?.height ?? 0) - 24)
    expect({ graph, layout }).toEqual(before)
    expect(containLoopChildren(result.graph, result.layout, loop.id, sizes)).toBeNull()
    expect(nextLoop?.type === 'loop' && nextLoop.config.body.graph).toEqual(loop.config.body.graph)
  })

  it('constrains shrink to actual card dimensions and moves children inside the new bounds', () => {
    const graph = createWorkflowGraphFixture('loop')
    const layout = createCanvasLayoutFixture(graph)
    const loop = graph.nodes.find(n => n.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Missing fixture')
    const sizes = loop.config.body.graph.nodes.map(n => ({ nodeId: n.id, width: 500, height: 400 }))
    const result = containLoopChildren(graph, layout, loop.id, sizes, { width: 420, height: 300 })
    expect(result?.layout.nodePlacements.find(p => p.nodeId === loop.id)).toMatchObject({ width: 540, height: 494 })
  })
})
