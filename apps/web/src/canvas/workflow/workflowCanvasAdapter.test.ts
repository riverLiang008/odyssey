import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { createCanvasLayoutFixture, createWorkflowGraphFixture } from '@/fixtures'
import {
  connectionToIntent,
  parseWorkflowNodeDragPayload,
  serializeWorkflowNodeDragPayload,
} from './workflowCanvasIntents'
import { fromWorkflowCanvasPosition, projectWorkflowCanvas } from './workflowCanvasAdapter'

describe('workflow canvas adapter', () => {
  it('projects canonical graph and layout without mutating either', () => {
    const graph = createWorkflowGraphFixture('research')
    const layout = createCanvasLayoutFixture(graph)
    const before = structuredClone({ graph, layout })
    const projection = projectWorkflowCanvas(graph, layout)
    expect(projection.nodes).toHaveLength(graph.nodes.length)
    expect(projection.edges).toHaveLength(graph.edges.length)
    expect(projection.viewport).toEqual(layout.viewport)
    const branch = projection.nodes.find((node) => node.data?.node.type === 'branch')
    expect(branch?.data?.branchHandles).toHaveLength(2)
    expect({ graph, layout }).toEqual(before)
  })

  it('adds view-only spacing in Configure mode without changing persisted layout', () => {
    const graph = createWorkflowGraphFixture('research')
    const layout = createCanvasLayoutFixture(graph)
    const before = structuredClone(layout)
    const flowProjection = projectWorkflowCanvas(graph, layout, 'flow')
    const configureProjection = projectWorkflowCanvas(graph, layout, 'configure')
    const origin = flowProjection.nodes.reduce((result, node) => ({ x: Math.min(result.x, node.position.x), y: Math.min(result.y, node.position.y) }), { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY })
    const flowNode = flowProjection.nodes.find((node) => node.position.x > origin.x || node.position.y > origin.y)
    const configureNode = configureProjection.nodes.find((node) => node.id === flowNode?.id)

    expect(flowNode).toBeDefined()
    const flowDistance = Math.hypot((flowNode?.position.x ?? origin.x) - origin.x, (flowNode?.position.y ?? origin.y) - origin.y)
    const configureDistance = Math.hypot((configureNode?.position.x ?? origin.x) - origin.x, (configureNode?.position.y ?? origin.y) - origin.y)
    expect(configureDistance).toBeGreaterThan(flowDistance)
    expect(layout).toEqual(before)
  })

  it('round-trips dragged Configure positions back to canonical layout coordinates', () => {
    const graph = createWorkflowGraphFixture('research')
    const layout = createCanvasLayoutFixture(graph)
    const configureProjection = projectWorkflowCanvas(graph, layout, 'configure')

    for (const canvasNode of configureProjection.nodes) {
      const canonicalPlacement = layout.nodePlacements.find((placement) => placement.nodeId === canvasNode.id)
      expect(canonicalPlacement).toBeDefined()
      expect(fromWorkflowCanvasPosition(canvasNode.position, layout, 'configure')).toEqual({
        x: canonicalPlacement?.x,
        y: canonicalPlacement?.y,
      })
    }
  })

  it('does not transform positions in Flow presentation mode', () => {
    const graph = createWorkflowGraphFixture('research')
    const layout = createCanvasLayoutFixture(graph)
    expect(fromWorkflowCanvasPosition({ x: 321, y: 654 }, layout, 'flow')).toEqual({ x: 321, y: 654 })
  })

  it('maps only valid domain identities and drops the renderer target handle', () => {
    const graph = createWorkflowGraphFixture('research')
    const branch = graph.nodes.find((node) => node.type === 'branch')
    const target = graph.nodes.find((node) => node.type === 'end')
    if (!branch || branch.type !== 'branch' || !target) throw new Error('Fixture mismatch')
    const edgeId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    expect(connectionToIntent({ source: branch.id, sourceHandle: branch.config.defaultCase.id, target: target.id, targetHandle: 'renderer-only' }, edgeId)).toEqual({
      edgeId,
      sourceNodeId: branch.id,
      sourceHandleId: branch.config.defaultCase.id,
      targetNodeId: target.id,
    })
  })

  it('round-trips typed Palette drag payloads and rejects foreign data', () => {
    expect(parseWorkflowNodeDragPayload(serializeWorkflowNodeDragPayload('task'))).toEqual({
      kind: 'workflow-node-template',
      nodeType: 'task',
    })
    expect(parseWorkflowNodeDragPayload('branch')).toEqual({ kind: 'workflow-node-template', nodeType: 'branch' })
    expect(parseWorkflowNodeDragPayload('{"kind":"resource","nodeType":"task"}')).toBeNull()
    expect(parseWorkflowNodeDragPayload('unknown')).toBeNull()
  })

  it('projects a Loop body inline as constrained visual children without flattening domain ownership', () => {
    const graph = createWorkflowGraphFixture('loop')
    const layout = createCanvasLayoutFixture(graph)
    const loop = graph.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Fixture mismatch')
    const placement = layout.nodePlacements.find((candidate) => candidate.nodeId === loop.id)
    if (!placement) throw new Error('Fixture mismatch')
    Object.assign(placement, { width: 760, height: 520 })
    const before = structuredClone({ graph, layout })

    const projection = projectWorkflowCanvas(graph, layout)
    const loopView = projection.nodes.find((node) => node.id === loop.id)
    const bodyViews = projection.nodes.filter((node) => node.data?.context?.kind === 'loop-body')

    expect(loopView?.data?.compoundLoop).toBe(true)
    expect(loopView?.style).toMatchObject({ width: '760px', height: '520px' })
    expect(bodyViews).toHaveLength(loop.config.body.graph.nodes.length)
    expect(bodyViews.every((node) => node.parentNode === loop.id && node.extent === 'parent')).toBe(true)
    expect(projection.edges).toHaveLength(graph.edges.length + loop.config.body.graph.edges.length)
    expect({ graph, layout }).toEqual(before)
  })
})
