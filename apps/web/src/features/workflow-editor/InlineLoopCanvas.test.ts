import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { uuidSchema, type LoopNode, type UUID, type WorkflowGraph } from '@odyssey/schemas'
import InlineLoopCanvas from './InlineLoopCanvas.vue'

function id(value: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${value.toString().padStart(12, '0')}`)
}

const rootGraph: WorkflowGraph = {
  schemaVersion: '1.0.0',
  nodes: [
    { id: id(1), type: 'start', name: 'Start', config: {} },
    { id: id(10), type: 'agent_action', name: 'Root Agent Action', config: { model: 'gpt-5', goal: { kind: 'literal', value: 'Prepare input' }, knowledgeSpaceIds: [], reusableToolIds: [] } },
    { id: id(2), type: 'loop', name: 'Review Loop', config: {
      maxTurns: 3,
      exitCondition: { kind: 'variable_comparison', variableId: id(8), operator: 'gte', value: 3 },
      body: {
        graph: { nodes: [{ id: id(4), type: 'loop_start', name: 'Loop Start', config: {} }, { id: id(5), type: 'loop_end', name: 'Loop End', config: {} }], edges: [{ id: id(6), sourceNodeId: id(4), targetNodeId: id(5) }] },
        layout: { nodePlacements: [{ nodeId: id(4), x: 0, y: 0 }, { nodeId: id(5), x: 220, y: 0 }], viewport: { x: 0, y: 0, zoom: 1 } },
      },
    } },
    { id: id(3), type: 'end', name: 'End', config: {} },
  ],
  edges: [{ id: id(7), sourceNodeId: id(1), targetNodeId: id(10) }, { id: id(11), sourceNodeId: id(10), targetNodeId: id(2) }, { id: id(9), sourceNodeId: id(2), targetNodeId: id(3) }],
}
const loop = rootGraph.nodes[2] as LoopNode

describe('InlineLoopCanvas', () => {
  it('keeps Root boundaries outside a named Loop body host', async () => {
    const wrapper = shallowMount(InlineLoopCanvas, { props: { rootGraph, loop, mode: 'flow', canvasId: `loop-${loop.id}` } })
    expect(wrapper.findAll('.inline-root-boundary')).toHaveLength(2)
    expect(wrapper.get('.inline-loop-container').text()).toContain('Loop Body')
    expect(wrapper.get('.inline-loop-container').attributes('aria-label')).toBe('Review Loop Loop body')
    const childCanvas = wrapper.findComponent({ name: 'WorkflowCanvas' })
    expect(childCanvas.props('graph')).toEqual(loop.config.body.graph)
    expect(childCanvas.props('normalizeInitialViewport')).toBe(true)
    expect(wrapper.get('.inline-root-sibling').text()).toContain('Root Agent Action')

    await wrapper.get('.inline-root-sibling').trigger('click')
    expect(wrapper.emitted('selectRoot')).toEqual([[id(10)]])

    await wrapper.get('.inline-root-sibling').trigger('contextmenu', { clientX: 120, clientY: 180 })
    expect(wrapper.emitted('nodeContextMenu')?.[0]).toEqual([id(10), { kind: 'root' }, { x: 120, y: 180 }])

    await wrapper.get('.inline-loop-heading button').trigger('click')
    expect(wrapper.emitted('collapse')).toHaveLength(1)
  })
})
