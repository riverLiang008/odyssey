import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ToolSelect from './ToolSelect.vue'

describe('ToolSelect', () => {
  it('opens a styled listbox and emits the selected value', async () => {
    const wrapper = mount(ToolSelect, {
      props: {
        modelValue: '',
        controlLabel: 'Output variable',
        options: [{ value: '', label: 'No output binding' }, { value: 'variable-1', label: 'task.result' }],
      },
    })

    await wrapper.get('.tool-select-trigger').trigger('click')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['variable-1']])
  })
})
