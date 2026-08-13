import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('introduces the Odyssey foundation', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: HomeView }, { path: '/journeys', component: { template: '<p>Journeys</p>' } }] })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(HomeView, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Your ideas,')
    expect(wrapper.text()).toContain('in motion.')
    expect(wrapper.text()).toContain('Journey canvas')
    expect(wrapper.get('.brand img').attributes('src')).toContain('odyssey-logo.png')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/journeys')
  })
})
