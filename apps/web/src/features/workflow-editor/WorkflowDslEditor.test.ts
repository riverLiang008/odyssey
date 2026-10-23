import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowDslEditor from './WorkflowDslEditor.vue'

describe('WorkflowDslEditor', () => {
  const props = { source: 'workflow "x" version "0.1" {}', phase: 'ready', diagnostics: [], dirty: true, readOnly: false, blocked: false, applyError: '' }
  it('edits text, explicitly applies, and confirms discarding a draft', async () => {
    const wrapper = mount(WorkflowDslEditor, { props })
    await wrapper.get('textarea').setValue('changed')
    expect(wrapper.emitted('edit')).toEqual([['changed']])
    await wrapper.get('.primary-panel-button').trigger('click')
    expect(wrapper.emitted('apply')).toHaveLength(1)
    await wrapper.findAll('.dsl-actions button')[2]?.trigger('click')
    expect(wrapper.emitted('revert')).toBeUndefined()
    await wrapper.get('.dsl-revert-confirm button').trigger('click')
    expect(wrapper.emitted('revert')).toHaveLength(1)
  })
  it('disables Apply in invalid/readonly/conflict states and exposes diagnostic navigation', async () => {
    const wrapper = mount(WorkflowDslEditor, { props: { ...props, phase: 'invalid', diagnostics: [{ code: 'ODSL101', severity: 'error', messageKey: 'ODSL101', span: { start: 1, end: 2 } }] } })
    expect(wrapper.get('.primary-panel-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    await wrapper.get('.dsl-problems button').trigger('click')
    expect(wrapper.get('textarea').element.selectionStart).toBe(1)
    await wrapper.setProps({ phase: 'ready', readOnly: true })
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
    expect(wrapper.get('.primary-panel-button').attributes('disabled')).toBeDefined()
  })
})

