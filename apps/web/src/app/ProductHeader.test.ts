import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import ProductHeader from './ProductHeader.vue'

describe('ProductHeader', () => {
  it('exposes the design documentation as an accessible external resource', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/journeys', name: 'journeys', component: { template: '<div />' } }],
    })
    await router.push('/journeys')
    await router.isReady()

    const wrapper = mount(ProductHeader, { global: { plugins: [router] } })
    const resource = wrapper.get('a[aria-label="Open Odyssey design documentation"]')

    expect(resource.attributes('href')).toBe('https://riverliang008.github.io/odyssey-architecture/')
    expect(resource.attributes('target')).toBe('_blank')
    expect(resource.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.findAll('.product-header__resource-link')).toHaveLength(1)
  })
})
