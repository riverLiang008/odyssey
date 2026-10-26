import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppSelect from './AppSelect.vue'

describe('AppSelect', () => {
  it('skips disabled placeholders and restores focus after Escape and selection', async () => {
    const wrapper = mount(AppSelect, { attachTo: globalThis.document.body, props: {
      modelValue: '', controlLabel: 'Variable', options: [
        { value: '', label: 'Choose variable', disabled: true },
        { value: 'approved', label: 'Approved' },
      ],
    } })
    try {
      const trigger = wrapper.get<HTMLButtonElement>('.app-select__trigger')
      await trigger.trigger('keydown', { key: 'ArrowDown' })
      await flushPromises()
      const option = wrapper.get<HTMLButtonElement>('[role="option"]:not(:disabled)')
      expect(globalThis.document.activeElement).toBe(option.element)
      await option.trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
      expect(globalThis.document.activeElement).toBe(trigger.element)
      await trigger.trigger('click')
      await wrapper.get('[role="option"]:not(:disabled)').trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:modelValue')).toEqual([['approved']])
      expect(globalThis.document.activeElement).toBe(trigger.element)
    } finally { wrapper.unmount() }
  })
  it('opens the styled listbox and emits a selected value', async () => {
    const wrapper = mount(AppSelect, {
      props: {
        modelValue: 'updated',
        controlLabel: 'Sort Knowledge Spaces',
        options: [
          { value: 'updated', label: 'Recently updated' },
          { value: 'name', label: 'Name' },
        ],
      },
    })

    await wrapper.get('.app-select__trigger').trigger('click')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('Recently updated')

    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['name']])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })
})
