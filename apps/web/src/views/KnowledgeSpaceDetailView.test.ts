import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { uuidSchema, type KnowledgeSpaceCategorySummary } from '@odyssey/schemas'
import { editorRepositoryKey } from '@/app/editorRepository'
import { InMemoryEditorRepository } from '@/repositories'
import KnowledgeSpaceDetailView from './KnowledgeSpaceDetailView.vue'

const category: KnowledgeSpaceCategorySummary = {
  id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8995'),
  name: 'Research',
  colorToken: null,
  sortOrder: 0,
  isDefault: true,
}

async function mountDetail() {
  const repository = new InMemoryEditorRepository({ knowledgeSpaceCategories: [category] })
  const created = await repository.createKnowledgeSpace({ name: 'Product knowledge', description: null, categoryId: category.id })
  if (!created.ok) throw new Error('Knowledge Space fixture could not be created')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/assets/knowledge-spaces', name: 'knowledge-spaces', component: { template: '<p>List</p>' } },
    { path: '/assets/knowledge-spaces/:knowledgeSpaceId', name: 'knowledge-space-detail', component: KnowledgeSpaceDetailView },
    { path: '/assets/knowledge-spaces/:knowledgeSpaceId/documents/:resourceId', name: 'knowledge-document-detail', component: KnowledgeSpaceDetailView },
  ] })
  await router.push(`/assets/knowledge-spaces/${created.value.id}`)
  await router.isReady()
  const wrapper = mount(KnowledgeSpaceDetailView, { global: { plugins: [router], provide: { [editorRepositoryKey as symbol]: repository } } })
  await flushPromises()
  return { wrapper, router, repository, knowledgeSpaceId: created.value.id }
}

describe('KnowledgeSpaceDetailView', () => {
  it('updates metadata with the current revision', async () => {
    const { wrapper } = await mountDetail()
    await wrapper.get('.knowledge-detail-actions button').trigger('click')
    await wrapper.get('.knowledge-dialog input').setValue('Updated knowledge')
    await wrapper.get('.knowledge-dialog').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Updated knowledge')
    expect(wrapper.find('.knowledge-dialog').exists()).toBe(false)
  })

  it('creates inside the selected folder and exposes the same action from the context menu', async () => {
    const { wrapper } = await mountDetail()
    const initialRows = wrapper.findAll('.knowledge-folder-row')
    expect(initialRows).toHaveLength(1)
    expect(initialRows[0]?.text()).toBe('Product knowledge')
    expect(initialRows[0]?.classes()).toContain('is-root')
    expect(initialRows[0]?.classes()).toContain('is-selected')
    await wrapper.get('button[aria-label="Create folder in selected folder"]').trigger('click')
    await wrapper.get('.knowledge-dialog input').setValue('Sources')
    await wrapper.get('.knowledge-dialog').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.knowledge-dialog').exists()).toBe(false)
    expect(wrapper.get('.knowledge-folder-tree').text()).toContain('Sources')
    const sources = wrapper.findAll('.knowledge-folder-row').find((row) => row.text().includes('Sources'))
    if (!sources) throw new Error('Created folder missing')
    expect(sources.classes()).toContain('is-selected')
    await sources.trigger('contextmenu', { clientX: 120, clientY: 180 })
    expect(wrapper.get('.knowledge-folder-context-menu').attributes('style')).toContain('120px')
    await wrapper.get('.knowledge-folder-context-menu button').trigger('click')
    expect(wrapper.get('#create-folder-title').text()).toBe('New folder')
    expect(wrapper.get('.knowledge-dialog header p').text()).toContain('Sources')
    await wrapper.get('.knowledge-dialog input').setValue('Archive')
    await wrapper.get('.knowledge-dialog').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.knowledge-folder-tree').text()).toContain('Archive')
  })

  it('uploads into the selected folder and renders the persisted resource', async () => {
    const { wrapper, router } = await mountDetail()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['hello'], 'notes.md', { type: 'text/markdown' })] })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.get('.knowledge-folder-tree').text()).toContain('notes.md')
    expect(wrapper.text()).toContain('1Files')
    expect(wrapper.find('button[aria-label="Collapse Product knowledge"]').exists()).toBe(true)
    await wrapper.get('.knowledge-resource-button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('knowledge-document-detail'))
    await vi.waitFor(() => expect(wrapper.get('.knowledge-document-detail').text()).toContain('notes.md'))
    expect(wrapper.find('.knowledge-document-inspector').exists()).toBe(false)
    expect(wrapper.get('.knowledge-document-preview').text()).toContain('hello')
    expect(wrapper.find('.knowledge-open-document').exists()).toBe(false)
    await wrapper.get('.knowledge-document-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('knowledge-space-detail'))
    expect(wrapper.find('.knowledge-document-detail').exists()).toBe(false)
    expect(wrapper.find('.knowledge-overview-card').exists()).toBe(true)
  })

  it('switches Markdown between rendered preview and editable source, then saves it', async () => {
    const { wrapper } = await mountDetail()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['# Original'], 'notes.md', { type: 'text/markdown' })] })
    await input.trigger('change')
    await flushPromises()
    await wrapper.get('.knowledge-resource-button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.knowledge-markdown').exists()).toBe(true))
    expect(wrapper.get('.knowledge-markdown h1').text()).toBe('Original')

    await wrapper.findAll('.knowledge-document-mode-switch button')[1]?.trigger('click')
    const editor = wrapper.get<HTMLTextAreaElement>('.knowledge-markdown-editor textarea')
    await editor.setValue('# Updated\n\n> Saved')
    await wrapper.get('.knowledge-markdown-editor .knowledge-primary-action').trigger('click')
    await flushPromises()

    expect(wrapper.find('.knowledge-markdown-editor').exists()).toBe(false)
    expect(wrapper.get('.knowledge-markdown h1').text()).toBe('Updated')
    expect(wrapper.get('.knowledge-markdown blockquote').text()).toBe('Saved')
  })

  it('validates and applies a graph manifest through the explicit import state machine', async () => {
    const { wrapper } = await mountDetail()
    const upload = wrapper.get('input[type="file"]')
    Object.defineProperty(upload.element, 'files', { configurable: true, value: [new File(['# Notes'], 'notes.md', { type: 'text/markdown' })] })
    await upload.trigger('change')
    await flushPromises()

    await wrapper.get('.knowledge-graph-action').trigger('click')
    const manifest = {
      schemaVersion: 1,
      key: 'notes-graph',
      documents: [{ key: 'notes', path: 'notes.md', summary: 'Notes summary', guide: null, tags: ['research'], status: 'indexed' }],
      tags: [{ key: 'research', name: 'Research', colorToken: null }],
      relations: [],
      issues: [],
      graph: { status: 'healthy' },
    }
    const manifestInput = wrapper.get('.knowledge-manifest-dialog input[type="file"]')
    Object.defineProperty(manifestInput.element, 'files', { configurable: true, value: [new File([JSON.stringify(manifest)], 'manifest.json', { type: 'application/json' })] })
    await manifestInput.trigger('change')
    await vi.waitFor(() => expect(wrapper.get('.knowledge-manifest-preview').text()).toContain('1Matched documents'))
    await wrapper.get('.knowledge-manifest-dialog .knowledge-primary-action').trigger('click')
    await flushPromises()

    expect(wrapper.find('.knowledge-manifest-dialog').exists()).toBe(false)
    expect(wrapper.get('.knowledge-toast').text()).toBe('Graph manifest imported')
    expect(wrapper.get('.knowledge-status').text()).toContain('healthy')
  })

  it('rejects malformed manifest JSON before calling Apply', async () => {
    const { wrapper } = await mountDetail()
    await wrapper.get('.knowledge-graph-action').trigger('click')
    const manifestInput = wrapper.get('.knowledge-manifest-dialog input[type="file"]')
    Object.defineProperty(manifestInput.element, 'files', { configurable: true, value: [new File(['{"schemaVersion":'], 'broken.json', { type: 'application/json' })] })
    await manifestInput.trigger('change')
    await vi.waitFor(() => expect(wrapper.get('.knowledge-manifest-status').text()).toContain('Choose a valid JSON file'))
    expect(wrapper.get<HTMLButtonElement>('.knowledge-manifest-dialog .knowledge-primary-action').element.disabled).toBe(true)
  })

  it('keeps document detail visible when only its preview fails', async () => {
    const { wrapper, repository, knowledgeSpaceId } = await mountDetail()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['hello'], 'notes.md', { type: 'text/markdown' })] })
    await input.trigger('change')
    await flushPromises()
    const tree = await repository.loadKnowledgeFileTree(knowledgeSpaceId)
    if (!tree.ok || !tree.value.resources[0]) throw new Error('Uploaded resource missing')
    const resourceId = tree.value.resources[0].id
    const inspection = await repository.loadKnowledgeResource(knowledgeSpaceId, resourceId)
    if (!inspection.ok) throw new Error('Document detail fixture missing')
    vi.spyOn(repository, 'loadKnowledgeResource').mockResolvedValue({
      ok: true,
      value: { detail: inspection.value.detail, preview: { type: 'failed', error: { code: 'NETWORK_FAILED' } } },
    })

    await wrapper.get('.knowledge-resource-button').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('.knowledge-document-detail').text()).toContain('notes.md'))
    expect(wrapper.get('.knowledge-document-preview-failure').text()).toContain('Preview is temporarily unavailable')
    expect(wrapper.find('.knowledge-document-metadata').exists()).toBe(true)
    expect(wrapper.find('.knowledge-document-state.is-error').exists()).toBe(false)
  })

  it('deletes a file from its context menu and updates the Knowledge Space', async () => {
    const { wrapper } = await mountDetail()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['obsolete'], 'obsolete.md', { type: 'text/markdown' })] })
    await input.trigger('change')
    await flushPromises()
    const resource = wrapper.get('.knowledge-resource-button')

    await resource.trigger('contextmenu', { clientX: 140, clientY: 220 })
    expect(wrapper.get('.knowledge-resource-context-menu').text()).toContain('Delete file')
    await wrapper.get('.knowledge-resource-context-menu button').trigger('click')
    expect(wrapper.get('#delete-knowledge-resource-title').text()).toContain('obsolete.md')
    await wrapper.get('.knowledge-danger-action').trigger('click')
    await flushPromises()

    expect(wrapper.find('.knowledge-dialog').exists()).toBe(false)
    expect(wrapper.get('.knowledge-folder-tree').text()).not.toContain('obsolete.md')
    expect(wrapper.text()).toContain('0Files')
  })

  it('moves a file into another folder by drag and drop', async () => {
    const { wrapper, repository, knowledgeSpaceId } = await mountDetail()
    await wrapper.get('button[aria-label="Create folder in selected folder"]').trigger('click')
    await wrapper.get('.knowledge-dialog input').setValue('Sources')
    await wrapper.get('.knowledge-dialog').trigger('submit')
    await flushPromises()
    const folder = wrapper.findAll('.knowledge-folder-row').find((row) => row.text().includes('Sources'))
    if (!folder) throw new Error('Target folder missing')
    const rootFolder = wrapper.findAll('.knowledge-folder-row').find((row) => row.classes().includes('is-root'))
    if (!rootFolder) throw new Error('Root folder missing')
    await rootFolder.trigger('click')
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['hello'], 'move-me.md', { type: 'text/markdown' })] })
    await input.trigger('change')
    await flushPromises()
    const resourceName = wrapper.findAll('.knowledge-resource-row .knowledge-folder-name').find((row) => row.text() === 'move-me.md')
    if (!resourceName) throw new Error('Uploaded resource missing')
    const dataTransfer = { setData: () => undefined, effectAllowed: 'none', dropEffect: 'none' }
    await resourceName.trigger('dragstart', { dataTransfer })
    await folder.trigger('dragover', { dataTransfer })
    expect(folder.classes()).toContain('is-drop-target')
    await folder.trigger('drop', { dataTransfer })
    await flushPromises()

    const tree = await repository.loadKnowledgeFileTree(knowledgeSpaceId)
    if (!tree.ok) throw new Error('File tree could not be loaded')
    const targetFolder = tree.value.folders.find((candidate) => candidate.name === 'Sources')
    expect(tree.value.resources.find((resource) => resource.name === 'move-me.md')?.folderId).toBe(targetFolder?.id)
    expect(wrapper.text()).not.toContain('Move failed')
  })

  it('archives before exposing protected permanent deletion', async () => {
    const { wrapper, router } = await mountDetail()
    expect(wrapper.text()).not.toContain('Delete permanently')
    const archive = wrapper.findAll('.knowledge-detail-actions button').find((button) => button.text() === 'Archive')
    if (!archive) throw new Error('Archive action missing')
    await archive.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Restore')
    const deleteAction = wrapper.findAll('.knowledge-detail-actions button').find((button) => button.text() === 'Delete')
    if (!deleteAction) throw new Error('Delete action missing')
    await deleteAction.trigger('click')
    await wrapper.get('.knowledge-danger-action').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('knowledge-spaces')
  })
})
