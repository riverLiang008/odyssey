import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { editorRepositoryKey } from '@/app/editorRepository'
import { createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import JourneyListView from './JourneyListView.vue'

function createTestRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [
    { path: '/journeys', name: 'journeys', component: JourneyListView },
    { path: '/journeys/new', name: 'journey-create', component: JourneyListView },
    { path: '/journeys/:journeyId', name: 'journey-editor', component: { template: '<p>Editor</p>' } },
  ] })
}
function mountList(router = createTestRouter()) {
  const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()] })
  return mount(JourneyListView, { global: { plugins: [router], provide: { [editorRepositoryKey as symbol]: repository } } })
}

describe('JourneyListView', () => {
  it('loads repository summaries and navigates through a named route', async () => {
    const router = createTestRouter(); await router.push('/journeys'); await router.isReady()
    const wrapper = mountList(router); await flushPromises()
    expect(wrapper.text()).toContain('Research System')
    await wrapper.get('[aria-label="Open Research System"]').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.params.journeyId).toBe(FIXTURE_IDS.journey)
  })
  it('offers Journey creation and keeps unimplemented filters disabled', async () => {
    const router = createTestRouter(); await router.push('/journeys'); await router.isReady()
    const wrapper = mountList(router); await flushPromises()
    expect(wrapper.text()).toContain('New OdyJourney')
    expect(wrapper.get('[aria-label="Search journeys"]').attributes('disabled')).toBeDefined()
  })
  it('renders creation as a route-driven dialog over the list', async () => {
    const router = createTestRouter(); await router.push('/journeys/new'); await router.isReady()
    const wrapper = mountList(router); await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Create OdyJourney')
    expect(wrapper.text()).toContain('Research System')
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(0)
    await wrapper.get('.create-journey-dialog__actions .secondary-action').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.name).toBe('journeys')
  })
})
