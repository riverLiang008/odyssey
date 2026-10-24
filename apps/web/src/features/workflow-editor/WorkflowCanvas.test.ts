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
}))
vi.mock('@vue-flow/core', async importOriginal => ({
  ...await importOriginal<typeof import('@vue-flow/core')>(),
  useVueFlow: vi.fn(() => ({
    onInit: vi.fn(),
    onNodesInitialized: (callback: () => Promise<void>) => { flow.initialized = callback },
    fitView: flow.fitView,
    project: vi.fn(), setCenter: vi.fn(), setViewport: flow.setViewport, viewport: ref({ x: 0, y: 0, zoom: 1 }),
  })),
}))

describe('WorkflowCanvas initial viewport', () => {
  beforeEach(() => { flow.fitView.mockClear(); flow.setViewport.mockClear(); flow.initialized = null })

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
