import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowDslEditor from './WorkflowDslEditor.vue'

describe('WorkflowDslEditor', () => {
  const props = { source: 'workflow "x" version "0.1" {}', phase: 'ready', diagnostics: [], dirty: true, readOnly: false, blocked: false, applyError: '' }
  it('groups replacement guidance and confirms rechecking without applying', async () => {
    const wrapper = mount(WorkflowDslEditor, { props: { ...props, phase: 'context-required', diagnostics: [{ code: 'ODSL507', severity: 'info', messageKey: 'ODSL507', span: { start: 0, end: 0 } }] } })
    const card = wrapper.get('[aria-label="Review Canvas replacement"]')
    expect(card.text()).toContain('Review before applying')
    expect(card.text()).toContain('Rechecking does not change the Canvas')
    expect(wrapper.find('.resource-browser-hint[role="status"]').exists()).toBe(false)
    await card.get('.dsl-review-trigger').trigger('click')
    expect(wrapper.emitted('reviewReplacement')).toBeUndefined()
    await card.get('.dsl-review-actions button:last-child').trigger('click')
    expect(card.find('.dsl-review-details').exists()).toBe(false)
    await card.get('.dsl-review-trigger').trigger('click')
    await card.get('.dsl-review-confirm').trigger('click')
    expect(wrapper.emitted('reviewReplacement')).toHaveLength(1)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
  it('disables replacement confirmation when saving starts and supports Escape to collapse', async () => {
    const wrapper = mount(WorkflowDslEditor, { props: { ...props, phase: 'stale' } })
    await wrapper.get('.dsl-review-trigger').trigger('click')
    await wrapper.setProps({ blocked: true })
    expect(wrapper.get('.dsl-review-confirm').attributes('disabled')).toBeDefined()
    await wrapper.get('.dsl-review-confirm').trigger('click')
    expect(wrapper.emitted('reviewReplacement')).toBeUndefined()
    await wrapper.get('.dsl-review-card').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.dsl-review-details').exists()).toBe(false)
  })
  it('explains incomplete validation even when there are no errors or warnings', async () => {
    const wrapper = mount(WorkflowDslEditor, { props: { ...props, phase: 'context-required', diagnostics: [{ code: 'ODSL504', severity: 'info', messageKey: 'ODSL504_EXIT_ROUTING', span: { start: 0, end: 0 } }] } })
    expect(wrapper.get('.primary-panel-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.dsl-problems-toggle').text()).toContain('0 errors · 0 warnings · 1 infos')
    expect(wrapper.get('.dsl-problems-toggle').text()).toContain('Validation incomplete')
    await wrapper.get('.dsl-problems-toggle').trigger('click')
    expect(wrapper.find('.dsl-problems').exists()).toBe(false)
    expect(wrapper.text()).toContain('Workflow Ends are out of sync with the Journey Pattern')
    expect(wrapper.text()).toContain('Your draft is preserved')
  })
  it('edits text, explicitly applies, and confirms discarding a draft', async () => {
    const wrapper = mount(WorkflowDslEditor, { props })
    await wrapper.get('textarea').setValue('changed')
    expect(wrapper.emitted('edit')).toEqual([['changed']])
    await wrapper.get('.primary-panel-button').trigger('click')
    expect(wrapper.emitted('apply')).toHaveLength(1)
    await wrapper.findAll('.dsl-actions button').find(button => button.text() === 'Revert')?.trigger('click')
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

