import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('introduces the Odyssey foundation', () => {
    const wrapper = mount(HomeView)
    expect(wrapper.text()).toContain('Your ideas,')
    expect(wrapper.text()).toContain('in motion.')
    expect(wrapper.text()).toContain('Journey canvas')
  })
})
