import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import UnsavedChangesDialog from './UnsavedChangesDialog.vue'

afterEach(() => globalThis.document.body.replaceChildren())

describe('UnsavedChangesDialog', () => {
  it('focuses the safe action and exposes explicit stay and leave intents', () => {
    const wrapper = mount(UnsavedChangesDialog, { attachTo: globalThis.document.body })
    const buttons = [...globalThis.document.body.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons.map((button) => button.textContent)).toEqual(['Stay and retry', 'Leave without saving'])
    expect(globalThis.document.activeElement).toBe(buttons[0])
    buttons[1]?.click()
    expect(wrapper.emitted('leave')).toHaveLength(1)
    wrapper.unmount()
  })

  it('treats Escape as Stay', () => {
    const wrapper = mount(UnsavedChangesDialog, { attachTo: globalThis.document.body })
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('stay')).toHaveLength(1)
    wrapper.unmount()
  })
})
