import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RouteBoundary from './RouteBoundary.vue'

describe('RouteBoundary', () => {
  it('announces loading without exposing a retry action', () => {
    const wrapper = mount(RouteBoundary, {
      props: { status: 'loading', subject: 'Journey', backTo: '/journeys', backLabel: 'Return' },
      global: { stubs: ['RouterLink'] },
    })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Loading Journey')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('maps repository failures to user copy and emits retry', async () => {
    const wrapper = mount(RouteBoundary, {
      props: {
        status: 'error', subject: 'Journey', error: { code: 'NETWORK_FAILED' },
        backTo: '/journeys', backLabel: 'Return to Journeys',
      },
      global: { stubs: ['RouterLink'] },
    })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Check your connection')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('presents not-found separately from transport errors', () => {
    const wrapper = mount(RouteBoundary, {
      props: { status: 'not-found', subject: 'Agent workflow', backTo: '/journeys', backLabel: 'Return' },
      global: { stubs: ['RouterLink'] },
    })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('Agent workflow not found')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
