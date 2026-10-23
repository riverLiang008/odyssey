import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import GlobalNavigation from './GlobalNavigation.vue'

async function mountNavigation(collapsed: boolean) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/journeys', component: { template: '<div />' } },
      { path: '/assets/knowledge-spaces', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mount(GlobalNavigation, { props: { collapsed }, global: { plugins: [router] } })
}

describe('GlobalNavigation', () => {
  it('hides navigation labels while collapsed and exposes an expand control', async () => {
    const wrapper = await mountNavigation(true)

    expect(wrapper.get('.global-navigation').classes()).toContain('is-collapsed')
    expect(wrapper.get('.global-navigation__items').isVisible()).toBe(false)
    expect(wrapper.get('.global-navigation__toggle').attributes('aria-label')).toBe('Expand primary navigation')
  })

  it('emits a toggle intent from the collapse control', async () => {
    const wrapper = await mountNavigation(false)

    await wrapper.get('.global-navigation__toggle').trigger('click')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})
