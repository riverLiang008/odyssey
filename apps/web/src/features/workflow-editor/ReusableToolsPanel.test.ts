import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import ReusableToolsPanel from './ReusableToolsPanel.vue'

describe('ReusableToolsPanel', () => {
  const tools = createAgentWorkflowEditorDocumentFixture('minimal').reusableTools

  it('closes from the shared icon control', async () => {
    const wrapper = mount(ReusableToolsPanel, { props: { agentName: 'Research Agent', tools, referenceCount: () => 0 } })
    await wrapper.get('button[aria-label="Close resources"]').trigger('click')
    expect(wrapper.emitted('collapse')).toHaveLength(1)
  })

  it('filters the Agent-owned inventory and exposes edit', async () => {
    const wrapper = mount(ReusableToolsPanel, { props: { agentName: 'Research Agent', tools, referenceCount: () => 0 } })
    expect(wrapper.text()).toContain('Saved within Research Agent')
    await wrapper.get('input').setValue('missing')
    expect(wrapper.text()).toContain('No matching reusable Tools.')
    await wrapper.get('input').setValue('Search Product')
    const editButton = wrapper.findAll('button').find((button) => button.text() === 'Edit')
    await editButton!.trigger('click')
    expect(wrapper.emitted('edit')?.[0]).toEqual([tools[0]!.id])
  })

  it('prevents deletion while an Agent Action references the Tool', () => {
    const wrapper = mount(ReusableToolsPanel, { props: { agentName: 'Research Agent', tools, referenceCount: () => 2 } })
    const deleteButton = wrapper.findAll('button').find((button) => button.text() === 'Delete')
    expect(deleteButton?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('2 uses')
  })

  it('emits the reusable Tool drag payload', async () => {
    const wrapper = mount(ReusableToolsPanel, { props: { agentName: 'Research Agent', tools, referenceCount: () => 0 } })
    await wrapper.get('article').trigger('dragstart', { dataTransfer: { effectAllowed: '', setData: () => undefined } })
    expect(wrapper.emitted('resourceDragStart')?.[0]).toEqual([{ kind: 'reusable-tool', resourceId: tools[0]!.id }])
  })
})
