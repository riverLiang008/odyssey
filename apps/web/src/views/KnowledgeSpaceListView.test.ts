import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { uuidSchema, type KnowledgeSpaceCategorySummary, type KnowledgeSpaceSummary } from '@odyssey/schemas'
import { editorRepositoryKey } from '@/app/editorRepository'
import { InMemoryEditorRepository } from '@/repositories'
import KnowledgeSpaceListView from './KnowledgeSpaceListView.vue'

const category: KnowledgeSpaceCategorySummary = {
  id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8995'),
  name: 'Research',
  colorToken: null,
  sortOrder: 0,
  isDefault: true,
}
const space: KnowledgeSpaceSummary = {
  id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996'),
  name: 'Product knowledge',
  description: 'Product notes',
  category,
  lifecycleStatus: 'ready',
  graphStatus: 'healthy',
  fileCount: 4,
  knowledgeFamilyCount: 2,
  openIssueCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

function createTestRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [
    { path: '/assets/knowledge-spaces', name: 'knowledge-spaces', component: KnowledgeSpaceListView },
    { path: '/assets/knowledge-spaces/new', name: 'knowledge-space-create', component: KnowledgeSpaceListView },
    { path: '/assets/knowledge-spaces/:knowledgeSpaceId', name: 'knowledge-space-detail', component: { template: '<p>Detail</p>' } },
  ] })
}

function mountList(router: ReturnType<typeof createTestRouter>, includeSpace = true, categories: KnowledgeSpaceCategorySummary[] = [category]) {
  const repository = new InMemoryEditorRepository({
    knowledgeSpaceCategories: categories,
    knowledgeSpaces: includeSpace ? [space] : [],
  })
  return mount(KnowledgeSpaceListView, { global: { plugins: [router], provide: { [editorRepositoryKey as symbol]: repository } } })
}

describe('KnowledgeSpaceListView', () => {
  it('groups real inventory by category and links the whole card to detail', async () => {
    const router = createTestRouter(); await router.push('/assets/knowledge-spaces'); await router.isReady()
    const wrapper = mountList(router); await flushPromises()
    expect(wrapper.text()).toContain('RESEARCH')
    expect(wrapper.text()).toContain('Product knowledge')
    expect(wrapper.get('.knowledge-space-card').attributes('href')).toBe(`/assets/knowledge-spaces/${space.id}`)
  })

  it('creates a Knowledge Space through the route-driven dialog and navigates to its server identity', async () => {
    const router = createTestRouter(); await router.push('/assets/knowledge-spaces/new'); await router.isReady()
    const wrapper = mountList(router, false); await flushPromises()
    await wrapper.get('input[placeholder="Research knowledge"]').setValue('Acceptance Knowledge')
    await wrapper.get('.knowledge-dialog').trigger('submit'); await flushPromises()
    expect(router.currentRoute.value.name).toBe('knowledge-space-detail')
    expect(typeof router.currentRoute.value.params.knowledgeSpaceId).toBe('string')
  })

  it('asks for a new category instead of rendering an empty select when none exist', async () => {
    const router = createTestRouter(); await router.push('/assets/knowledge-spaces/new'); await router.isReady()
    const wrapper = mountList(router, false, []); await flushPromises()
    expect(wrapper.find('.knowledge-dialog select').exists()).toBe(false)
    expect(wrapper.get('input[placeholder="Research"]').attributes('required')).toBeDefined()
  })
})
