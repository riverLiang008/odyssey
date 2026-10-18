import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { uuidSchema, type AgentVariable } from '@odyssey/schemas'
import AgentVariablesPanel from './AgentVariablesPanel.vue'

const id = uuidSchema.parse('00000000-0000-4000-8000-000000000080')
const variables: AgentVariable[] = [{ id, key: 'research_status', displayName: 'Research status', description: 'Current progress', dataType: 'json', ownership: 'shared', defaultValue: null, readOnly: false }]

describe('AgentVariablesPanel', () => {
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
})
