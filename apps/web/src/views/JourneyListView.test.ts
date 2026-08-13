import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { FIXTURE_IDS } from '@/fixtures'
import JourneyListView from './JourneyListView.vue'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/journeys', component: JourneyListView },
      { path: '/journeys/:journeyId', name: 'journey-editor', component: { template: '<p>Editor</p>' } },
    ],
  })
}

describe('JourneyListView', () => {
  it('renders the deterministic Journey summary and navigates through a named route', async () => {
    const router = createTestRouter()
    await router.push('/journeys')
    await router.isReady()
    const wrapper = mount(JourneyListView, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Your OdyJourneys')
    expect(wrapper.text()).toContain('Research System')
    await wrapper.get('[aria-label="Open Research System"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params.journeyId).toBe(FIXTURE_IDS.journey)
  })

  it('keeps unavailable list actions explicitly disabled', () => {
    const wrapper = mount(JourneyListView, { global: { stubs: ['RouterLink'] } })
    expect(wrapper.get('button.primary-action').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="Search journeys"]').attributes('disabled')).toBeDefined()
  })
})
