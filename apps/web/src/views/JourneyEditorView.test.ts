import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { editorRepositoryKey } from '@/app/editorRepository'
import { ODYSSEY_DRAG_MIME, serializeOdysseyDragPayload } from '@/canvas/interaction'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { uuidSchema } from '@odyssey/schemas'
import { InMemoryEditorRepository } from '@/repositories'
import { createAppRouter } from '@/router'
import { useJourneyEditorStore } from '@/stores/journeyEditor'
import JourneyEditorView from './JourneyEditorView.vue'

const mountedEditors: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of mountedEditors.splice(0)) wrapper.unmount()
  globalThis.document.body.replaceChildren()
})

function getTeleportedMenuButton(label: string): globalThis.HTMLButtonElement {
  const button = [...globalThis.document.body.querySelectorAll<globalThis.HTMLButtonElement>('.agent-menu button')]
    .find((candidate) => candidate.textContent?.trim() === label)
  if (!button) throw new Error(`${label} menu item is missing`)
  return button
}

async function clickTeleportedMenuButton(label: string): Promise<void> {
  getTeleportedMenuButton(label).click()
  await flushPromises()
}

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
  await router.push(`/journeys/${journey.journey.id}?tab=execution`)
  await router.isReady()
  const wrapper = mount(JourneyEditorView, {
    attachTo: globalThis.document.body,
    global: { plugins: [pinia, router], provide: { [editorRepositoryKey]: repository } },
  })
  mountedEditors.push(wrapper)
  await flushPromises()
  return { journey, pinia, repository, router, wrapper }
}

describe('JourneyEditorView integration', () => {
  it('selects an empty Slot without creating an Agent or navigating', async () => {
    const { pinia, repository, router, wrapper } = await mountEditor()
    expect(wrapper.text()).not.toContain('Synchronize Workflow exits')
    const createJourneyAgent = vi.spyOn(repository, 'createJourneyAgent')
    const emptySlot = wrapper.get('.agent-slot.is-empty .agent-slot__select')
    await emptySlot.trigger('click')
    await flushPromises()
    const store = useJourneyEditorStore(pinia)
    expect(store.session.selectedSlotId).toBe(store.document?.pattern.slots[1]?.id)
    expect(store.document?.pattern.slots[1]?.agentId).toBeNull()
    expect(store.persistence.mutationSeq).toBe(0)
    expect(createJourneyAgent).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('journey-editor')
  })

  it('opens one read-only Preview from a configured Slot and navigates only from Open canvas', async () => {
    const { router, wrapper } = await mountEditor()
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('journey-editor')
    expect(wrapper.findAll('.workflow-preview')).toHaveLength(1)
    expect(wrapper.get('.workflow-preview').text()).toContain('Read only')
    expect(wrapper.find('.workflow-preview [draggable="true"]').exists()).toBe(false)

    await vi.waitFor(() => {
      expect(wrapper.get('[aria-label="Open canvas"]').attributes('disabled')).toBeUndefined()
    })
    const navigated = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => { remove(); resolve() })
    })
    await wrapper.get('[aria-label="Open canvas"]').trigger('click')
    await navigated
    expect(router.currentRoute.value.name).toBe('agent-workflow')
  })

  it('creates a minimum Agent only from an empty Slot Open workflow action', async () => {
    const { pinia, repository, router, wrapper } = await mountEditor()
    const createJourneyAgent = vi.spyOn(repository, 'createJourneyAgent')
    await wrapper.get('.agent-slot.is-empty .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    const navigated = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => { remove(); resolve() })
    })
    await clickTeleportedMenuButton('Open workflow')
    await navigated
    const store = useJourneyEditorStore(pinia)
    expect(createJourneyAgent).toHaveBeenCalledOnce()
    expect(store.document?.pattern.slots[1]?.agentId).toBeTruthy()
    expect(router.currentRoute.value.name).toBe('agent-workflow')
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
  })

  it('uses a no-drop cursor without inserting an alert during invalid drag hover', async () => {
    const { pinia, wrapper } = await mountEditor()
    const store = useJourneyEditorStore(pinia)
    const source = store.document?.pattern.slots.find((slot) => slot.agentId)
    if (!source?.agentId) throw new Error('Configured source Slot is missing')

    store.beginDrag({ version: 1, kind: 'assigned-agent', agentId: source.agentId, sourceSlotId: source.id })
    store.evaluateDrag({ kind: 'system-canvas' })
    await flushPromises()

    expect(wrapper.get('.journey-canvas-stack').classes()).toContain('is-drop-forbidden')
    expect(wrapper.find('.journey-feedback').exists()).toBe(false)
    expect(store.session.lastDropError).toBeNull()
  })

  it('shows a transient centered toast after a rejected drop', async () => {
    vi.useFakeTimers()
    try {
      const { pinia, wrapper } = await mountEditor()
      const store = useJourneyEditorStore(pinia)
      store.rejectDrop('SAME_SLOT')
      await wrapper.vm.$nextTick()

      const toast = globalThis.document.body.querySelector('.journey-interaction-toast')
      expect(toast?.textContent).toBe('This Agent is already in that Slot.')
      expect(wrapper.find('.journey-feedback').exists()).toBe(false)

      await vi.advanceTimersByTimeAsync(3200)
      await wrapper.vm.$nextTick()
      expect(globalThis.document.body.querySelector('.journey-interaction-toast')).toBeNull()
      expect(store.session.lastDropError).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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
  })

  it('routes the context-menu Open workflow intent through the typed route helper', async () => {
    const { router, wrapper } = await mountEditor()
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    await flushPromises()
    const navigated = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => { remove(); resolve() })
    })
    await clickTeleportedMenuButton('Open workflow')
    await navigated
    expect(router.currentRoute.value.name).toBe('agent-workflow')
  })

  it('opens Save as template from the configured Slot menu instead of a persistent footer form', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.find('[aria-label="Template name"]').exists()).toBe(false)
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    await clickTeleportedMenuButton('Save as template')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Save agent as template')
    expect(wrapper.get('[aria-label="Template name"]').element).toBe(globalThis.document.activeElement)
  })

  it('persists Remove agent before presenting the Slot as empty', async () => {
    const { journey, pinia, repository, wrapper } = await mountEditor()
    const saveJourney = vi.spyOn(repository, 'saveJourney')
    const configuredSlot = wrapper.get('.agent-slot.is-configured .agent-slot__select')
    await configuredSlot.trigger('contextmenu', { clientX: 40, clientY: 60 })
    await clickTeleportedMenuButton('Remove agent')

    const store = useJourneyEditorStore(pinia)
    expect(saveJourney).toHaveBeenCalledOnce()
    expect(store.document?.pattern.slots[0]?.agentId).toBeNull()
    const reloaded = await repository.loadJourney(journey.journey.id)
    expect(reloaded.ok && reloaded.value.pattern.slots[0]?.agentId).toBeNull()
  })

  it('adds a dynamic Linear Slot from the capability-driven context menu', async () => {
    const { pinia, wrapper } = await mountEditor()
    const store = useJourneyEditorStore(pinia)
    const before = store.document?.pattern.slots.length
    await wrapper.get('.agent-slot.is-configured .agent-slot__select').trigger('contextmenu', { clientX: 40, clientY: 60 })
    await clickTeleportedMenuButton('Add slot after')
    expect(store.document?.pattern.slots.length).toBe((before ?? 0) + 1)
    expect(store.document?.pattern.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3])
  })

  it('uses Execution as the default editor surface without Pattern replacement controls', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.text()).toContain('Execution templates')
    expect(wrapper.text()).toContain('No execution templates available')
    expect(wrapper.text()).not.toContain('Research pipeline')
    expect(wrapper.text()).not.toContain('Current Pattern')
    expect(wrapper.text()).not.toContain('Replace Pattern?')
  })

  it('adds and removes an optional Guardrail through the repository command path', async () => {
    const { pinia, repository, wrapper } = await mountEditor()
    const add = vi.spyOn(repository, 'addGuardrail')
    const remove = vi.spyOn(repository, 'removeGuardrail')
    await wrapper.get('[aria-label="Add input Guardrail"]').trigger('click')
    await flushPromises()
    const store = useJourneyEditorStore(pinia)
    expect(add).toHaveBeenCalledOnce()
    expect(store.document?.inputGuardrail.state).toBe('active')

    await wrapper.get('.guardrail-module--input .guardrail-module__agent').trigger('contextmenu', { clientX: 40, clientY: 60 })
    const guardrailMenu = globalThis.document.querySelector<globalThis.HTMLElement>('.guardrail-menu')
    expect(guardrailMenu?.style.position).toBe('fixed')
    expect(guardrailMenu?.parentElement).toBe(globalThis.document.body)
    await clickTeleportedMenuButton('Remove guardrail')
    expect(wrapper.get('[role="dialog"]').text()).toContain('permanently deletes its Agent and Workflow')
    await wrapper.get('[role="dialog"] button').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledOnce()
    expect(store.document?.inputGuardrail).toEqual({ state: 'inactive' })
    expect(wrapper.find('[aria-label="Add input Guardrail"]').exists()).toBe(true)
  })
})
