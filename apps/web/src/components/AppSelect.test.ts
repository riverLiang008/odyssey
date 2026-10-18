import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppSelect from './AppSelect.vue'

describe('AppSelect', () => {
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
