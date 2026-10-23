import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import WorkflowPreview from './WorkflowPreview.vue'
import { VueFlow } from '@vue-flow/core'

describe('WorkflowPreview', () => {
  it('renders a compact topology without exposing mutation controls', async () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const wrapper = mount(WorkflowPreview, {
      props: { agentId: document.agent.id, agentName: document.agent.name, status: 'ready', document, error: null },
      attachTo: globalThis.document.body,
    })

    await flushPromises()
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('2 nodes and 1 edges')
    expect(wrapper.findAll('.workflow-preview-node')).toHaveLength(2)
    expect(wrapper.find('[draggable="true"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Configure')
    expect(wrapper.find('.workflow-preview-canvas__surface').attributes('inert')).toBeDefined()
    const flow = wrapper.getComponent(VueFlow)
    expect(flow.props('nodesDraggable')).toBe(false)
    expect(flow.props('nodesConnectable')).toBe(false)
    expect(flow.props('elementsSelectable')).toBe(false)
    expect(flow.props('deleteKeyCode')).toBeNull()
    expect(wrapper.findAll('.workflow-node-card.is-protected')).toHaveLength(2)
    await wrapper.get('[aria-label="Open canvas"]').trigger('click')
    expect(wrapper.emitted('open')).toEqual([[document.agent.id]])
    wrapper.unmount()
  })

  it('renders the actual Configure cards and keeps resource and task controls inert', async () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const before = structuredClone(document)
    const wrapper = mount(WorkflowPreview, {
      props: { agentId: document.agent.id, agentName: document.agent.name, status: 'ready', document, error: null },
      attachTo: globalThis.document.body,
    })
    await flushPromises()
    expect(wrapper.find('.workflow-node-card.is-configure-expanded').exists()).toBe(true)
    expect(wrapper.find('.workflow-preview-canvas__surface').attributes('inert')).toBeDefined()
    expect(wrapper.find('[draggable="true"]').exists()).toBe(false)
    expect(document).toEqual(before)
    wrapper.unmount()
  })

  it('exposes local loading, error/retry and explicit close behavior', async () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const wrapper = mount(WorkflowPreview, {
      props: { agentId: document.agent.id, agentName: document.agent.name, status: 'loading', document: null, error: null },
      attachTo: globalThis.document.body,
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Loading Workflow')
    expect(wrapper.get('[aria-label="Open canvas"]').attributes('disabled')).toBeDefined()

    await wrapper.setProps({ status: 'error', error: { code: 'NETWORK_FAILED' } })
    expect(wrapper.get('[role="alert"]').text()).toContain('NETWORK_FAILED')
    await wrapper.get('[role="alert"] button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    globalThis.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
