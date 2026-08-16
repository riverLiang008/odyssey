import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { editorRepositoryKey } from '@/app/editorRepository'
import { ODYSSEY_DRAG_MIME, serializeOdysseyDragPayload } from '@/canvas/interaction'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { uuidSchema } from '@odyssey/schemas'
import { InMemoryEditorRepository } from '@/repositories'
import { createAppRouter } from '@/router'
import { useJourneyEditorStore } from '@/stores/journeyEditor'
import JourneyEditorView from './JourneyEditorView.vue'

async function mountEditor() {
  const journey = createJourneyEditorDocumentFixture()
  journey.pattern.slots[1]!.agentId = null
  const repository = new InMemoryEditorRepository({
    journeys: [journey],
    agentWorkflows: [
      createAgentWorkflowEditorDocumentFixture('research'),
      createAgentWorkflowEditorDocumentFixture('minimal'),
      createAgentWorkflowEditorDocumentFixture('loop'),
    ],
  })
  const pinia = createPinia()
  const router = createAppRouter(createMemoryHistory())
  await router.push(`/journeys/${journey.journey.id}?tab=pattern`)
  await router.isReady()
  const wrapper = mount(JourneyEditorView, {
    attachTo: globalThis.document.body,
    global: { plugins: [pinia, router], provide: { [editorRepositoryKey]: repository } },
  })
  await flushPromises()
  return { journey, pinia, router, wrapper }
}

describe('JourneyEditorView integration', () => {
  it('creates a minimum Agent from an empty Slot and navigates directly to its Workflow', async () => {
    const { pinia, router, wrapper } = await mountEditor()
    const emptySlot = wrapper.get('.agent-slot.is-empty .agent-slot__select')
    const navigated = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => { remove(); resolve() })
    })
    await emptySlot.trigger('click')
    await flushPromises()
    await navigated
    const store = useJourneyEditorStore(pinia)
    expect(store.document?.agents.some((agent) => agent.name === 'Agent 2')).toBe(true)
    expect(store.persistence.mutationSeq).toBe(1)
    expect(router.currentRoute.value.name).toBe('agent-workflow')
    expect(wrapper.find('[aria-label="Agent name"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reparses the current Canvas DataTransfer and rejects a stale in-memory drag', async () => {
    const { pinia, wrapper } = await mountEditor()
    const store = useJourneyEditorStore(pinia)
    store.beginDrag({ version: 1, kind: 'agent-template', templateId: uuidSchema.parse(FIXTURE_IDS.researchAgent) })
    store.evaluateDrag({ kind: 'system-canvas' })
    await wrapper.get('.journey-canvas-stack').trigger('drop', {
      dataTransfer: { getData: (mime: string) => mime === ODYSSEY_DRAG_MIME ? '' : '' },
    })
    expect(store.session.interaction.type).toBe('idle')
    expect(store.session.lastDragBoundaryError).toBe('MALFORMED_JSON')
    expect(store.persistence.mutationSeq).toBe(0)
    wrapper.unmount()
  })

  it('consumes a nested Slot drop once and finishes the drag session', async () => {
    const { journey, pinia, wrapper } = await mountEditor()
    const store = useJourneyEditorStore(pinia)
    const source = journey.pattern.slots[0]!
    const target = journey.pattern.slots[1]!
    if (!source.agentId) throw new Error('Source Agent is missing')
    const payload = { version: 1, kind: 'assigned-agent', agentId: source.agentId, sourceSlotId: source.id } as const
    await wrapper.get('.agent-slot.is-empty').trigger('drop', {
      dataTransfer: { getData: () => serializeOdysseyDragPayload(payload) },
    })
    await flushPromises()
    expect(store.document?.pattern.slots.find((slot) => slot.id === target.id)?.agentId).toBe(source.agentId)
    expect(store.persistence.mutationSeq).toBe(1)
    expect(store.session.interaction.type).toBe('idle')
    wrapper.unmount()
  })

  it('routes the context-menu Open workflow intent through the typed route helper', async () => {
    const { router, wrapper } = await mountEditor()
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    await flushPromises()
    const navigated = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => { remove(); resolve() })
    })
    await wrapper.get('.agent-menu button').trigger('click')
    await navigated
    expect(router.currentRoute.value.name).toBe('agent-workflow')
    wrapper.unmount()
  })

  it('opens Save as template from the configured Slot menu instead of a persistent footer form', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.find('[aria-label="Template name"]').exists()).toBe(false)
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    const saveItem = wrapper.findAll('.agent-menu button').find((button) => button.text() === 'Save as template')
    if (!saveItem) throw new Error('Save as template menu item is missing')
    await saveItem.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Save agent as template')
    expect(wrapper.get('[aria-label="Template name"]').element).toBe(globalThis.document.activeElement)
    wrapper.unmount()
  })

  it('adds a dynamic Linear Slot from the capability-driven context menu', async () => {
    const { pinia, wrapper } = await mountEditor()
    const store = useJourneyEditorStore(pinia)
    const before = store.document?.pattern.slots.length
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    const addAfter = wrapper.findAll('.agent-menu button').find((button) => button.text() === 'Add slot after')
    if (!addAfter) throw new Error('Add slot after menu item is missing')
    await addAfter.trigger('click')
    expect(store.document?.pattern.slots.length).toBe((before ?? 0) + 1)
    expect(store.document?.pattern.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3])
    wrapper.unmount()
  })

  it('shows the current Pattern as immutable information without replacement controls', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.text()).toContain('Current Pattern')
    expect(wrapper.text()).toContain('Pattern is fixed after this Journey is created')
    expect(wrapper.find('.template-card').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Replace Pattern?')
    wrapper.unmount()
  })
})
