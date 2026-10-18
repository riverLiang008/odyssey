import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ToolValueInput from './ToolValueInput.vue'

describe('ToolValueInput', () => {
  it('uses an accessible styled menu to change the value source mode', async () => {
    const wrapper = mount(ToolValueInput, {
      props: { modelValue: { kind: 'literal', value: '' }, variables: [], label: 'URL', compact: true },
    })

    const trigger = wrapper.get('.tool-value-mode-trigger')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
    expect(wrapper.findAll('[role="option"]')[2]?.attributes('disabled')).toBeDefined()

    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.get('.tool-value-mode-trigger').text()).toContain('Static JSON')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ kind: 'literal', value: null }])
  })
})
