import { describe, expect, it } from 'vitest'
import { createCanvasLayoutFixture, createWorkflowGraphFixture } from '@/fixtures'
import { containLoopChildren } from './loopBounds'
import { projectWorkflowCanvas } from './workflowCanvasAdapter'
import { expandMeasuredLoopFrames } from './measuredLoopProjection'

describe('content-sized Loop display', () => {
  it('preserves oversized content beyond persisted resize limits in editor and Preview projections', () => {
    const graph = createWorkflowGraphFixture('loop')
    const layout = createCanvasLayoutFixture(graph)
    const loop = graph.nodes.find(n => n.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Missing fixture')
    const child = loop.config.body.graph.nodes[0]
    if (!child) throw new Error('Missing fixture child')
    const sizes = [{ nodeId: child.id, width: 1900, height: 2400 }]
    const contained = containLoopChildren(graph, layout, loop.id, sizes)
    if (!contained) throw new Error('Expected containment')
    expect(contained.layout.nodePlacements.find(p => p.nodeId === loop.id)).toMatchObject({ width: 1600, height: 1200 })
    const projection = projectWorkflowCanvas(contained.graph, contained.layout, 'configure')
    const before = structuredClone(projection)
    const expanded = expandMeasuredLoopFrames(projection.nodes, sizes)
    expect(expanded.find(n => n.id === loop.id)?.style).toMatchObject({ width: '1940px', height: '2494px' })
    expect(projection).toEqual(before)
    expect(containLoopChildren(contained.graph, contained.layout, loop.id, sizes)).toBeNull()
    expect(expandMeasuredLoopFrames(expanded, sizes)).toEqual(expanded)
  })
})
