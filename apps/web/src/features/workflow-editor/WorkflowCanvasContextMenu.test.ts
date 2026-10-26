import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkflowCanvasContextMenu from './WorkflowCanvasContextMenu.vue'

describe('Workflow Canvas context menu', () => {
  it('focuses actions, skips disabled items and restores the invoker on Escape', async () => {
    const invoker = globalThis.document.createElement('button')
    globalThis.document.body.append(invoker)
    invoker.focus()
    const wrapper = mount(WorkflowCanvasContextMenu, { attachTo: globalThis.document.body, props: { label: 'Actions' },
      slots: { default: '<button role="menuitem">First</button><button role="menuitem" disabled>Disabled</button><button role="menuitem">Last</button>' } })
    try {
      const buttons = wrapper.findAll<HTMLButtonElement>('button')
      expect(globalThis.document.activeElement).toBe(buttons[0]?.element)
      await wrapper.trigger('keydown', { key: 'ArrowDown' })
      expect(globalThis.document.activeElement).toBe(buttons[2]?.element)
      await wrapper.trigger('keydown', { key: 'Home' })
      expect(globalThis.document.activeElement).toBe(buttons[0]?.element)
      await wrapper.trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally { wrapper.unmount() }
    expect(globalThis.document.activeElement).toBe(invoker)
    invoker.remove()
  })

  it('does not steal focus from an outside click when dismissed', () => {
    const outside = globalThis.document.createElement('input')
    globalThis.document.body.append(outside)
    const wrapper = mount(WorkflowCanvasContextMenu, { attachTo: globalThis.document.body, props: { label: 'Actions' }, slots: { default: '<button role="menuitem">Delete</button>' } })
    outside.focus()
    wrapper.unmount()
    expect(globalThis.document.activeElement).toBe(outside)
    outside.remove()
  })
})
