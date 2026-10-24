import { describe, expect, it } from 'vitest'
import { createCanvasLayoutFixture, createWorkflowGraphFixture } from '@/fixtures'
import { projectWorkflowCanvas } from './workflowCanvasAdapter'
import { mapModeViewport, modeViewportAnchor } from './modeViewport'

describe('mode viewport mapping', () => {
  it('retains the chosen anchor even when compression makes a different node closer to the center', () => {
    const graph = createWorkflowGraphFixture('minimal')
    const layout = createCanvasLayoutFixture(graph)
    layout.nodePlacements = graph.nodes.map((node, i) => ({ nodeId: node.id, x: i * 300, y: 0 }))
    const configure = projectWorkflowCanvas(graph, layout, 'configure')
    const flow = projectWorkflowCanvas(graph, layout, 'flow')
    const size = { width: 1000, height: 900 }
    const original = { x: 0, y: 0, zoom: 1 }
    const anchor = modeViewportAnchor(configure, original, size)
    const mapped = mapModeViewport(configure, flow, original, size, anchor)
    expect(modeViewportAnchor(flow, mapped, size)).not.toBe(anchor)
    expect(mapModeViewport(flow, configure, mapped, size, anchor)).toEqual(original)
  })
  it.each([0.35, 1, 1.8])('keeps a panned Loop area visible and round trips at zoom %s', zoom => {
    const graph = createWorkflowGraphFixture('loop')
    const layout = createCanvasLayoutFixture(graph)
    const before = structuredClone({ graph, layout })
    const configure = projectWorkflowCanvas(graph, layout, 'configure')
    const flow = projectWorkflowCanvas(graph, layout, 'flow')
    const loop = configure.nodes.find(n => n.data?.compoundLoop)
    if (!loop) throw new Error('Missing fixture')
    const viewport = { x: 300 - loop.position.x * zoom, y: 250 - loop.position.y * zoom, zoom }
    const size = { width: 1024, height: 900 }
    for (const selection of [null, loop.id]) {
      let current = viewport
      for (let i = 0; i < 10; i++) {
        const mapped = mapModeViewport(configure, flow, current, size, selection)
        const target = flow.nodes.find(n => n.id === loop.id)
        expect((target?.position.x ?? 0) * zoom + mapped.x).toBeCloseTo(300)
        current = mapModeViewport(flow, configure, mapped, size, selection)
      }
      expect(current.x).toBeCloseTo(viewport.x)
      expect(current.y).toBeCloseTo(viewport.y)
    }
    expect({ graph, layout }).toEqual(before)
  })
})
