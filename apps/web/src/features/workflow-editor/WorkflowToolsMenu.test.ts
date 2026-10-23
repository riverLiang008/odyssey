import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import WorkflowToolsMenu from './WorkflowToolsMenu.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WorkflowToolsMenu', () => {
  it('opens accessibly and exports from the menu', async () => {
    const wrapper = mount(WorkflowToolsMenu, { attachTo: document.body })
    const trigger = wrapper.get('button[aria-label="Workflow tools"]')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(wrapper.findAll('[role="menuitem"]')[0]?.element)
    const exportItem = wrapper.findAll('[role="menuitem"]').find((item) => item.text().includes('Export'))
    expect(exportItem).toBeDefined()
    if (!exportItem) return
    await exportItem.trigger('click')

    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('can explicitly disable import while keeping the menu explanation', async () => {
    const wrapper = mount(WorkflowToolsMenu, { props: { importEnabled: false } })
    await wrapper.get('button[aria-label="Workflow tools"]').trigger('click')

    const importItem = wrapper.findAll('[role="menuitem"]')[0]
    expect(importItem?.attributes('disabled')).toBeDefined()
    expect(importItem?.text()).toContain('Unavailable')
    expect(wrapper.text()).toContain('Review it before sharing')
  })

  it('emits the import intent when enabled', async () => {
    const wrapper = mount(WorkflowToolsMenu)
    await wrapper.get('button[aria-label="Workflow tools"]').trigger('click')
    await wrapper.findAll('[role="menuitem"]')[0]?.trigger('click')

    expect(wrapper.emitted('import')).toHaveLength(1)
  })

  it('closes with Escape and returns focus to the trigger', async () => {
    const wrapper = mount(WorkflowToolsMenu, { attachTo: document.body })
    const trigger = wrapper.get<HTMLButtonElement>('button[aria-label="Workflow tools"]')
    await trigger.trigger('click')
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })
})
