import { flushPromises, mount } from '@vue/test-utils'
import { markRaw, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import { useVueFlow } from '@vue-flow/core'
import WorkflowCanvas from './WorkflowCanvas.vue'

const flow = vi.hoisted(() => ({
  initialized: null as (() => Promise<void>) | null,
  fitView: vi.fn().mockResolvedValue(true),
  setViewport: vi.fn().mockResolvedValue(true),
  project: vi.fn(),
}))
vi.mock('@vue-flow/core', async importOriginal => ({
  ...await importOriginal<typeof import('@vue-flow/core')>(),
  useVueFlow: vi.fn(() => ({
    onInit: vi.fn(),
    onNodesInitialized: (callback: () => Promise<void>) => { flow.initialized = callback },
    fitView: flow.fitView,
    project: flow.project, setCenter: vi.fn(), setViewport: flow.setViewport, viewport: ref({ x: 0, y: 0, zoom: 1 }),
  })),
}))

describe('WorkflowCanvas initial viewport', () => {
  it('keeps Configure read-only at the canvas boundary while allowing selection', async () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const before = structuredClone(document)
    const wrapper = mount(WorkflowCanvas, {
      props: { graph: markRaw(document.workflow), layout: markRaw(document.layout), mode: 'configure', canvasId: 'read-only-test', readOnly: true },
      global: { stubs: { VueFlow: { name: 'ReadOnlyFlowStub', props: ['nodes', 'edges', 'nodesDraggable', 'nodesConnectable'], template: '<div />' } } },
    })
    const flowComponent = wrapper.findComponent({ name: 'ReadOnlyFlowStub' })
    expect(flowComponent.props('nodesDraggable')).toBe(false)
    expect(flowComponent.props('nodesConnectable')).toBe(false)
    expect(flowComponent.props('nodes').every((node: { draggable: boolean; connectable: boolean; deletable: boolean }) => !node.draggable && !node.connectable && !node.deletable)).toBe(true)
    expect(wrapper.vm.createFromClientPoint('task', 100, 100)).toBe(false)
    const first = document.workflow.nodes[0]
    if (!first) throw new Error('Missing start')
    flowComponent.vm.$emit('node-drag-stop', { node: { id: first.id, position: { x: 999, y: 999 }, data: {} } })
    flowComponent.vm.$emit('move-end', { flowTransform: { x: 80, y: 90, zoom: 1 } })
    expect(wrapper.emitted('intent')).toBeUndefined()
    flowComponent.vm.$emit('node-click', { event: { target: null }, node: { id: first.id, data: {} } })
    expect(wrapper.emitted('intent')).toEqual([[{ kind: 'root' }, { type: 'select-node', nodeId: first.id }]])
    expect(document).toEqual(before)
    wrapper.unmount()
  })

  it('renders the node card as the direct Vue Flow slot root so compound dimensions are preserved', () => {
    const document = createAgentWorkflowEditorDocumentFixture('loop')
    const wrapper = mount(WorkflowCanvas, {
      props: { graph: markRaw(document.workflow), layout: markRaw(document.layout), mode: 'configure', canvasId: 'slot-root-test', readOnly: true },
      global: {
        stubs: {
          VueFlow: {
            props: ['nodes'],
            template: '<div class="flow-stub"><slot v-if="nodes[0]" name="node-workflow" v-bind="nodes[0]" /></div>',
          },
          WorkflowNodeRenderer: {
            inheritAttrs: true,
            template: '<article class="workflow-node-card" />',
          },
        },
      },
    })

    const card = wrapper.get('.flow-stub > .workflow-node-card')
    expect(card.attributes('inert')).toBeDefined()
    wrapper.unmount()
  })
  beforeEach(() => { flow.fitView.mockClear(); flow.setViewport.mockClear(); flow.initialized = null })

  it.each(['branch', 'task', 'agent_action', 'loop'] as const)('routes dropped %s through the Loop creation boundary', nodeType => {
    const document = createAgentWorkflowEditorDocumentFixture('loop')
    const loop = document.workflow.nodes.find(node => node.type === 'loop')
    const first = document.workflow.nodes[0]
    if (!loop || !first) throw new Error('Fixture requires Loop and boundary nodes')
    document.layout.nodePlacements = [
      { nodeId: first.id, x: 0, y: 0 },
      { nodeId: loop.id, x: 10, y: 20, width: 720, height: 480 },
    ]
    const before = structuredClone(document)
    flow.project.mockReturnValue({ x: 100, y: 300 })
    const wrapper = mount(WorkflowCanvas, {
      props: { graph: markRaw(document.workflow), layout: markRaw(document.layout), mode: 'configure', canvasId: 'creation-test' },
      global: { stubs: { VueFlow: true } },
    })
    try {
      vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue(new globalThis.DOMRect(0, 0, 1000, 800))
      expect(wrapper.vm.createFromClientPoint(nodeType, 100, 300)).toBe(nodeType !== 'loop')
      if (nodeType === 'loop') {
        expect(wrapper.emitted('create')).toBeUndefined()
        expect(wrapper.emitted('reject')).toEqual([['INVALID_DROP_PAYLOAD']])
      } else {
        expect(wrapper.emitted('create')).toEqual([[{ kind: 'loop-body', loopNodeId: loop.id }, nodeType, { x: expect.closeTo(75.5, 3), y: expect.closeTo(253, 3) }]])
      }
      expect(document).toEqual(before)
    } finally { wrapper.unmount() }
  })

  it.each([false, true])('centers measured boundary nodes, saved viewport: %s', async savedViewport => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    document.workflow.edges = []
    document.layout.viewport = { x: savedViewport ? 100 : 0, y: 0, zoom: 1 }
    const before = structuredClone(document)
    const wrapper = mount(WorkflowCanvas, {
      props: { graph: markRaw(document.workflow), layout: markRaw(document.layout), mode: 'configure', canvasId: 'initial-test' },
      global: { stubs: { VueFlow: true } },
    })
    expect(flow.fitView).not.toHaveBeenCalled()
    expect(useVueFlow).toHaveBeenCalledWith('initial-test')
    await flow.initialized?.()
    if (savedViewport) expect(flow.fitView).not.toHaveBeenCalled()
    else expect(flow.fitView).toHaveBeenCalledWith({ minZoom: 1, maxZoom: 1, duration: 0 })
    expect(document).toEqual(before)
    expect(wrapper.emitted('intent')).toBeUndefined()
    wrapper.unmount()
  })

  it('maps the live canvas viewport on mode change without emitting a persisted edit', async () => {
    const document = createAgentWorkflowEditorDocumentFixture('loop')
    const wrapper = mount(WorkflowCanvas, {
      props: { graph: markRaw(document.workflow), layout: markRaw(document.layout), mode: 'configure', canvasId: 'mode-test' },
      global: { stubs: { VueFlow: true } },
    })
    await wrapper.setProps({ mode: 'flow' })
    await flushPromises()
    expect(flow.setViewport).toHaveBeenCalledOnce()
    expect(flow.setViewport).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1 }))
    expect(wrapper.emitted('intent')).toBeUndefined()
    wrapper.unmount()
  })
})
