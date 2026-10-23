import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkflowResourceNav from './WorkflowResourceNav.vue'

describe('WorkflowResourceNav', () => {
  it('keeps every resource reachable in compact Focus Mode', async () => {
    const wrapper = mount(WorkflowResourceNav, { props: { category: 'tools', panelCollapsed: true, focusMode: true, compact: true } })
    const resourceButtons = wrapper.findAll('.resource-nav-item')
    expect(resourceButtons.map((button) => button.attributes('aria-label'))).toEqual(['Tools', 'Knowledge Spaces', 'Agent Variables', 'DSL Edit', 'Reusable Tools'])
    expect(resourceButtons.map((button) => button.attributes('data-tooltip'))).toEqual(['Tools', 'Knowledge Spaces', 'Agent Variables', 'DSL Edit', 'Reusable Tools'])
    await resourceButtons[2]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['agent-variables']])
  })

  it('exposes an accessible compact-mode toggle', async () => {
    const wrapper = mount(WorkflowResourceNav, { props: { category: 'dsl-edit', panelCollapsed: false, focusMode: true, compact: true } })
    const toggle = wrapper.get('.resource-nav-collapse')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.emitted('toggleCompact')).toHaveLength(1)
  })

  it('renders the existing text navigation outside Focus Mode', () => {
    const wrapper = mount(WorkflowResourceNav, { props: { category: 'dsl-edit', panelCollapsed: false, focusMode: false, compact: false } })
    expect(wrapper.find('.resource-nav-collapse').exists()).toBe(false)
    expect(wrapper.get('[aria-label="DSL Edit"]').classes()).toContain('is-active')
  })
})
