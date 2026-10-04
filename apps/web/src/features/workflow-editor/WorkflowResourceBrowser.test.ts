import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import WorkflowResourceBrowser from './WorkflowResourceBrowser.vue'

describe('WorkflowResourceBrowser', () => {
  const tools = createAgentWorkflowEditorDocumentFixture('minimal').reusableTools
  const baseProps = { collapsed: false, category: 'tools' as const, query: '', page: 1, pageSize: 6, tools, knowledgeSpaces: [], knowledgeStatus: 'ready' as const, knowledgeTotal: 0 }

  it('offers a vertical Tool sidebar with filtering, search, and collapse controls', async () => {
    const wrapper = mount(WorkflowResourceBrowser, { props: baseProps })
    expect(wrapper.findAll('.resource-browser-items article')).toHaveLength(tools.length)
    await wrapper.get('input[aria-label="Search resources"]').setValue('missing')
    await wrapper.get('form[role="search"]').trigger('submit')
    expect(wrapper.emitted('search')).toEqual([['missing']])
    await wrapper.get('.resource-browser-collapse').trigger('click')
    expect(wrapper.emitted('collapse')).toEqual([[true]])
  })

  it('renders the category selected by the Product Header without mixing inventory state', async () => {
    const wrapper = mount(WorkflowResourceBrowser, { props: { ...baseProps, category: 'knowledge-spaces' as const, knowledgeStatus: 'loading' as const } })
    expect(wrapper.get('h2').text()).toBe('Knowledge Spaces')
    expect(wrapper.text()).toContain('Loading Knowledge Spaces')
    expect(wrapper.findAll('.resource-browser-items article')).toHaveLength(0)
  })

  it('shows an honest unavailable state for categories whose API is not ready', () => {
    const wrapper = mount(WorkflowResourceBrowser, { props: { ...baseProps, category: 'agent-variables' as const } })
    expect(wrapper.text()).toContain('Coming next')
    expect(wrapper.find('.resource-browser-items').exists()).toBe(false)
  })

  it('publishes the dragged resource before a target evaluates it', async () => {
    const wrapper = mount(WorkflowResourceBrowser, { props: baseProps })
    const dataTransfer = { effectAllowed: '', setData: () => undefined }
    await wrapper.get('.resource-browser-items article').trigger('dragstart', { dataTransfer })
    expect(wrapper.emitted('resourceDragStart')?.[0]).toEqual([{ kind: 'reusable-tool', resourceId: tools[0]?.id }])
    await wrapper.get('.resource-browser-items article').trigger('dragend')
    expect(wrapper.emitted('resourceDragEnd')).toHaveLength(1)
  })
})
