import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { uuidSchema, type AgentVariable } from '@odyssey/schemas'
import AgentVariablesPanel from './AgentVariablesPanel.vue'

const id = uuidSchema.parse('00000000-0000-4000-8000-000000000080')
const variables: AgentVariable[] = [{ id, key: 'research_status', displayName: 'Research status', description: 'Current progress', dataType: 'json', ownership: 'shared', defaultValue: null, readOnly: false }]

describe('AgentVariablesPanel', () => {
  it('closes from the shared icon control', async () => {
    const wrapper = mount(AgentVariablesPanel, { props: { variables, referenceCount: () => 0 } })
    expect(wrapper.get('.variable-header-actions').find('.variable-add').exists()).toBe(true)
    expect(wrapper.get('.variable-header-actions').find('button[aria-label="Close resources"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Close resources"]').trigger('click')
    expect(wrapper.emitted('collapse')).toHaveLength(1)
  })

  it('groups variables and emits a valid create intent', async () => {
    const wrapper = mount(AgentVariablesPanel, { props: { variables, referenceCount: () => 0 } })
    expect(wrapper.text()).toContain('Shared · 1')
    expect(wrapper.text()).toContain('agent.research_status')
    await wrapper.get('button.variable-add').trigger('click')
    await wrapper.get('input[placeholder="research_status"]').setValue('review_complete')
    await wrapper.get('button[type="submit"]').trigger('submit')
    const created = wrapper.emitted('save')?.[0]?.[0] as AgentVariable
    expect(created).toMatchObject({ key: 'review_complete', displayName: 'Review Complete', ownership: 'user_managed', readOnly: false })
  })
  it('shows reference impact and disables deletion', async () => {
    const wrapper = mount(AgentVariablesPanel, { props: { variables, referenceCount: () => 2 } })
    await wrapper.get('button.variable-row').trigger('click')
    expect(wrapper.text()).toContain('Used by 2 workflow reference(s)')
    expect(wrapper.get('button.variable-delete').attributes('disabled')).toBeDefined()
  })

  it('uses the styled listbox for the variable data type', async () => {
    const wrapper = mount(AgentVariablesPanel, { props: { variables, referenceCount: () => 0 } })
    await wrapper.get('button.variable-add').trigger('click')
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('button[aria-label="Data type: String"]').trigger('click')
    expect(wrapper.get('[role="listbox"]').attributes('aria-label')).toBe('Data type')
    await wrapper.findAll('[role="option"]')[2]!.trigger('click')
    expect(wrapper.get('button[aria-label="Data type: Boolean"]').text()).toContain('Boolean')
  })

  it('uses the header back control as the single way to cancel editing', async () => {
    const wrapper = mount(AgentVariablesPanel, { props: { variables, referenceCount: () => 0 } })
    await wrapper.get('button.variable-row').trigger('click')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Cancel')).toBe(false)
    await wrapper.get('button[aria-label="Back to Agent Variables"]').trigger('click')
    expect(wrapper.text()).toContain('Agent Variables')
    expect(wrapper.find('form.variable-form').exists()).toBe(false)
  })

  it('uses distinct secondary and danger actions for delete confirmation', async () => {
    const wrapper = mount(AgentVariablesPanel, { props: { variables, referenceCount: () => 0 } })
    await wrapper.get('button.variable-row').trigger('click')
    await wrapper.get('button.variable-delete').trigger('click')
    expect(wrapper.get('.delete-confirm__keep').text()).toBe('Keep variable')
    expect(wrapper.get('.delete-confirm__danger').text()).toBe('Confirm delete')
    await wrapper.get('.delete-confirm__keep').trigger('click')
    expect(wrapper.find('.delete-confirm').exists()).toBe(false)
  })
})
