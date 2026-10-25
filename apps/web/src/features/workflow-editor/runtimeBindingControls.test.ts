import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToolValueInput from './ToolValueInput.vue'
import WorkflowSidePanelHost from './WorkflowSidePanelHost.vue'
import { uuidSchema } from '@odyssey/schemas'

describe('runtime binding controls', () => {
  it('preserves and changes a typed system input without displaying it as literal text', async () => {
    const wrapper = mount(ToolValueInput, { props: { modelValue: { kind: 'system', key: 'document_id' }, variables: [], label: 'Query' } })
    expect(wrapper.find('textarea').exists()).toBe(false)
    await wrapper.get('select').setValue('change_event')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ kind: 'system', key: 'change_event' }])
  })
  it('allows event KS binding without an inventory and disables changes in read-only mode', async () => {
    const wrapper = mount(WorkflowSidePanelHost, { props: { node: { id: uuidSchema.parse('00000000-0000-4000-8000-000000000001'), type: 'agent_action', name: 'Curator', config: { model: 'test', goal: { kind: 'literal', value: '' }, knowledgeSpaceIds: [], reusableToolIds: [] } }, edge: null, knowledgeSpaces: [] } })
    const button = wrapper.findAll('button').find(button => button.text().startsWith('Use event Knowledge Space'))
    expect(button).toBeDefined()
    await button?.trigger('click')
    expect(wrapper.emitted('bindKnowledgeSpace')?.[0]).toEqual([{ kind: 'system_knowledge_space', key: 'target_knowledge_space' }])
    await wrapper.setProps({ readOnly: true })
    expect(button?.attributes('disabled')).toBeDefined()
  })
})
