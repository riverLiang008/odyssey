import { defineComponent, h, inject } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell.vue'
import { appShellPresentationKey } from './appShellPresentation'

const FocusRoute = defineComponent({
  setup() {
    const presentation = inject(appShellPresentationKey)
    return () => h('div', [
      h('button', { onClick: () => presentation?.setFocusMode(true) }, 'Enter editor focus'),
      h('button', { onClick: () => presentation?.setProductHeaderVisible(false) }, 'Use editor header'),
    ])
  },
})

describe('AppShell presentation contract', () => {
  it('lets a routed editor put the complete shell into Focus Mode', async () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          GlobalNavigation: { template: '<nav class="global-navigation">Navigation</nav>' },
          ProductHeader: { template: '<header class="product-header">Header</header>' },
          RouterView: FocusRoute,
        },
      },
    })

    expect(wrapper.get('.app-shell').classes()).not.toContain('is-focus-mode')
    await wrapper.get('button:first-of-type').trigger('click')
    expect(wrapper.get('.app-shell').classes()).toContain('is-focus-mode')
  })

  it('lets the Workflow Editor replace the generic Product Header with its unified header', async () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          GlobalNavigation: { template: '<nav class="global-navigation">Navigation</nav>' },
          ProductHeader: { template: '<header class="product-header">Header</header>' },
          RouterView: FocusRoute,
        },
      },
    })
    expect(wrapper.find('.product-header').exists()).toBe(true)
    await wrapper.get('button:last-of-type').trigger('click')
    expect(wrapper.find('.product-header').exists()).toBe(false)
  })
})
