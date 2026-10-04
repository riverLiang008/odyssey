import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { journeyEditorDocumentSchema, uuidSchema, type CreateOrInstantiateAgentSuccess, type JourneyEditorDocument, type RepositoryResult } from '@odyssey/schemas'

import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { createInMemoryEditorRepositoryScenario, InMemoryEditorRepository } from '@/repositories'
import type { AgentLifecycleRepository } from '@/repositories'
import { useJourneyEditorStore } from './journeyEditor'

function patternIdFactory(start = 9000) {
  let sequence = start
  const next = () => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return { patternId: next, slotId: next, routeId: next }
}

function deferred<T>() {
  let settle: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => { settle = resolve })
  return { promise, resolve(value: T) { if (!settle) throw new Error('Deferred is not initialized'); settle(value) } }
}

describe('journeyEditor store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loads a document while keeping route/session/persistence out of the save input', async () => {
    const document = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [document] })
    const store = useJourneyEditorStore()
    await store.load(uuidSchema.parse(FIXTURE_IDS.journey), 'agent', repository)

    expect(store.document?.journey.name).toBe('Research System')
    expect(store.session.activeTab).toBe('agent')
    expect(store.persistence.loadStatus).toBe('ready')
    expect(store.toSaveInput()).toEqual({
      journeyId: document.journey.id,
      expectedRevision: document.journey.revision,
      pattern: document.pattern,
    })
    expect(Object.keys(store.toSaveInput() ?? {})).not.toContain('session')
  })

  it('aborts and invalidates pending loads when disposed', async () => {
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      latencyMs: 20,
    })
    const store = useJourneyEditorStore()
    const pending = store.load(uuidSchema.parse(FIXTURE_IDS.journey), 'execution', repository)
    store.dispose()
    await pending
    expect(store.document).toBeNull()
    expect(store.persistence.loadStatus).toBe('idle')
  })

  it('retries from a modeled network failure without retaining stale error state', async () => {
    const { repository, controls } = createInMemoryEditorRepositoryScenario({
      journeys: [createJourneyEditorDocumentFixture()],
    })
    const store = useJourneyEditorStore()
    const journeyId = uuidSchema.parse(FIXTURE_IDS.journey)
    controls.failNext('NETWORK_FAILED')
    await store.load(journeyId, 'execution', repository)
    expect(store.persistence.loadStatus).toBe('error')
    expect(store.persistence.error?.code).toBe('NETWORK_FAILED')

    await store.load(journeyId, 'execution', repository)
    expect(store.persistence.loadStatus).toBe('ready')
    expect(store.persistence.error).toBeNull()
    expect(store.document?.journey.id).toBe(journeyId)
  })

  it('ignores stale success and stale error from a repository that does not honor abort', async () => {
    const firstId = uuidSchema.parse(FIXTURE_IDS.journey)
    const secondId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998')
    const firstDocument = createJourneyEditorDocumentFixture()
    const secondDocument: JourneyEditorDocument = journeyEditorDocumentSchema.parse({
      ...createJourneyEditorDocumentFixture(),
      journey: { ...createJourneyEditorDocumentFixture().journey, id: secondId, name: 'Second Journey' },
    })
    const first = deferred<RepositoryResult<JourneyEditorDocument>>()
    const second = deferred<RepositoryResult<JourneyEditorDocument>>()
    const repository = {
      loadJourney: (id: typeof firstId) => id === firstId ? first.promise : second.promise,
      saveJourney: async () => { throw new Error('Unexpected save') },
      loadAgentWorkflow: async () => { throw new Error('Unexpected Agent load') },
    } satisfies import('@/repositories').JourneyEditorRepository
    const store = useJourneyEditorStore()

    const oldLoad = store.load(firstId, 'execution', repository)
    const newLoad = store.load(secondId, 'agent', repository)
    second.resolve({ ok: true, value: secondDocument })
    await newLoad
    first.resolve({ ok: false, error: { code: 'NETWORK_FAILED' } })
    await oldLoad

    expect(store.document?.journey.name).toBe('Second Journey')
    expect(store.session.activeTab).toBe('agent')
    expect(store.persistence.loadStatus).toBe('ready')
    expect(store.persistence.error).toBeNull()

    const staleSuccess = deferred<RepositoryResult<JourneyEditorDocument>>()
    const currentSuccess = deferred<RepositoryResult<JourneyEditorDocument>>()
    const successRepository = {
      ...repository,
      loadJourney: (id: typeof firstId) => id === firstId ? staleSuccess.promise : currentSuccess.promise,
    }
    const staleSuccessLoad = store.load(firstId, 'execution', successRepository)
    const currentSuccessLoad = store.load(secondId, 'execution', successRepository)
    currentSuccess.resolve({ ok: true, value: secondDocument })
    await currentSuccessLoad
    staleSuccess.resolve({ ok: true, value: firstDocument })
    await staleSuccessLoad
    expect(store.document?.journey.name).toBe('Second Journey')
    expect(store.session.activeTab).toBe('execution')

    const late = deferred<RepositoryResult<JourneyEditorDocument>>()
    const lateRepository = { ...repository, loadJourney: () => late.promise }
    const disposedLoad = store.load(firstId, 'execution', lateRepository)
    store.dispose()
    late.resolve({ ok: true, value: firstDocument })
    await disposedLoad
    expect(store.document).toBeNull()
    expect(store.persistence.loadStatus).toBe('idle')
  })

  it('orchestrates Pattern commands without duplicating domain rules', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const store = useJourneyEditorStore()
    await store.load(uuidSchema.parse(FIXTURE_IDS.journey), 'execution', repository)
    const firstSlotId = store.document!.pattern.slots[0]!.id
    const secondSlotId = store.document!.pattern.slots[1]!.id
    const firstAgentId = store.document!.pattern.slots[0]!.agentId!

    expect(store.unassignAgent(secondSlotId)?.ok).toBe(true)
    expect(store.moveAgent(firstSlotId, secondSlotId)?.ok).toBe(true)
    expect(store.document?.pattern.slots[1]?.agentId).toBe(firstAgentId)
    expect(store.persistence.mutationSeq).toBe(2)
    expect(store.session.lastPatternError).toBeNull()

    const failed = store.moveAgent(firstSlotId, secondSlotId)
    expect(failed?.ok).toBe(false)
    expect(store.session.lastPatternError?.code).toBe('SOURCE_SLOT_EMPTY')
    expect(store.persistence.mutationSeq).toBe(2)

    expect(store.addSlot('Stage 4', patternIdFactory())?.ok).toBe(true)
    expect(store.document?.pattern.slots).toHaveLength(4)
    expect(store.toSaveInput()?.pattern).toEqual(store.document?.pattern)
    expect(store.persistence.mutationSeq).toBe(3)

    const returned = store.addSlot('Stage 5', patternIdFactory(9100))
    expect(returned?.ok).toBe(true)
    if (returned?.ok) returned.value.slots[0]!.label = 'external mutation'
    expect(store.document?.pattern.slots[0]?.label).not.toBe('external mutation')
  })

  it('debounces Pattern edits and autosaves the latest Journey snapshot', async () => {
    vi.useFakeTimers()
    try {
      const fixture = createJourneyEditorDocumentFixture()
      const repository = new InMemoryEditorRepository({ journeys: [fixture] })
      const saveSpy = vi.spyOn(repository, 'saveJourney')
      const store = useJourneyEditorStore()
      await store.load(fixture.journey.id, 'execution', repository)
      store.addSlot('Autosaved stage', patternIdFactory())

      await vi.advanceTimersByTimeAsync(799)
      expect(saveSpy).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(saveSpy).toHaveBeenCalledTimes(1)
      expect(store.persistence.saveStatus).toBe('saved')
      expect(store.document?.journey.revision).toBe(fixture.journey.revision + 1)
      store.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes local Pattern edits before a server-authoritative lifecycle command', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const saveSpy = vi.spyOn(repository, 'saveJourney')
    const createSpy = vi.spyOn(repository, 'createJourneyAgent')
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)
    const result = store.addSlot('New Agent', patternIdFactory())
    if (!result?.ok) throw new Error('Expected Slot creation to succeed')
    const emptySlot = result.value.slots.at(-1)!

    expect(await store.createAgent(emptySlot.id, repository)).not.toBe(false)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy.mock.invocationCallOrder[0]).toBeLessThan(createSpy.mock.invocationCallOrder[0]!)
    expect(store.persistence.saveStatus).toBe('saved')
    expect(store.document?.journey.revision).toBeGreaterThanOrEqual(fixture.journey.revision + 1)
    store.dispose()
  })

  it('preflights and dispatches valid drops while keeping invalid dragover atomic', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)
    const source = fixture.pattern.slots[0]!
    const target = fixture.pattern.slots[1]!
    const before = JSON.parse(JSON.stringify(store.document))

    store.beginDrag({ version: 1, kind: 'assigned-agent', agentId: source.agentId!, sourceSlotId: source.id })
    expect(store.evaluateDrag({ kind: 'agent-slot', slotId: target.id })?.status).toBe('valid')
    expect(store.document).toEqual(before)
    expect(store.persistence.mutationSeq).toBe(0)
    expect(await store.dispatchDrop(repository, patternIdFactory())).toBe(true)
    expect(store.document?.pattern.slots[0]?.agentId).toBe(target.agentId)
    expect(store.document?.pattern.slots[1]?.agentId).toBe(source.agentId)
    expect(store.persistence.mutationSeq).toBe(1)
    expect(store.session.interaction.type).toBe('idle')

    const afterExchange = JSON.parse(JSON.stringify(store.document))
    store.beginDrag({ version: 1, kind: 'assigned-agent', agentId: target.agentId!, sourceSlotId: source.id })
    expect(store.evaluateDrag({ kind: 'agent-slot', slotId: source.id })?.status).toBe('duplicate')
    expect(store.session.lastDropError).toBeNull()
    expect(await store.dispatchDrop(repository, patternIdFactory())).toBe(false)
    expect(store.session.lastDropError).toBe('SAME_SLOT')
    expect(store.document).toEqual(afterExchange)
    expect(store.persistence.mutationSeq).toBe(1)
    expect(store.session.interaction.type).toBe('idle')
    store.beginDrag({ version: 1, kind: 'agent-template', templateId: uuidSchema.parse(FIXTURE_IDS.researchAgent) })
    store.rejectDragBoundary('MALFORMED_JSON')
    expect(store.session.interaction.type).toBe('idle')
    expect(store.session.lastDragBoundaryError).toBe('MALFORMED_JSON')
  })

  it('models selection, menu, staged destructive actions and stale Slot reconciliation as session state', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)
    const lastSlot = fixture.pattern.slots[2]!
    store.selectSlot(lastSlot.id)
    store.openMenu(lastSlot.id, { x: 10, y: 20 })
    expect(store.session.interaction).toEqual({ type: 'menu-open', slotId: lastSlot.id, anchor: { x: 10, y: 20 } })
    expect(store.unassignAgent(lastSlot.id)?.ok).toBe(true)
    expect(store.removeSlot(lastSlot.id, patternIdFactory())?.ok).toBe(true)
    expect(store.session.selectedSlotId).toBeNull()
    expect(store.session.interaction.type).toBe('idle')

    expect(store.toSaveInput()).not.toHaveProperty('interaction')
  })

  it('orchestrates atomic create, Save as Template, list and instantiate lifecycle operations', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    fixture.pattern.slots[1]!.agentId = null
    fixture.pattern.slots[2]!.agentId = null
    const repository = new InMemoryEditorRepository({
      journeys: [fixture],
      agentWorkflows: [
        createAgentWorkflowEditorDocumentFixture('research'),
        createAgentWorkflowEditorDocumentFixture('minimal'),
        createAgentWorkflowEditorDocumentFixture('loop'),
      ],
    })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'agent', repository)
    const createSlotId = fixture.pattern.slots[1]!.id
    expect(await store.createAgent(createSlotId, repository)).toBeTruthy()
    const createdAgentId = store.document?.pattern.slots[1]?.agentId
    expect(createdAgentId).toBeTruthy()
    if (!createdAgentId) throw new Error('Created Agent identity is missing')
    expect(store.persistence.mutationSeq).toBe(1)
    expect(await store.saveAsTemplate(createdAgentId, 'Reusable Agent', null, repository)).toBe(true)
    expect(store.agentTemplates).toHaveLength(1)
    await store.loadAgentTemplates(repository)
    expect(store.lifecycle.templateStatus).toBe('ready')
    const templateId = store.agentTemplates[0]!.id
    const targetSlotId = fixture.pattern.slots[2]!.id
    expect(await store.instantiateTemplate(templateId, targetSlotId, repository)).toBe(true)
    expect(store.document?.pattern.slots[2]?.agentId).toBeTruthy()
    expect(store.persistence.mutationSeq).toBe(2)
  })

  it('orchestrates Guardrail add/remove as server-owned aggregate replacements', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)

    const agentId = await store.addGuardrail('input', repository)
    expect(agentId).toBeTruthy()
    expect(store.document?.inputGuardrail).toEqual({ state: 'active', structure: 'single', agentId })
    expect(store.document?.agents.some((agent) => agent.id === agentId)).toBe(true)
    expect(store.guardrailOperation).toEqual({ type: 'idle' })
    expect(store.persistence.mutationSeq).toBe(1)

    if (!agentId) throw new Error('Guardrail Agent is missing')
    store.openGuardrailMenu('input', { x: 12, y: 24 })
    expect(store.session.guardrailInteraction).toEqual({ type: 'menu-open', side: 'input', agentId, anchor: { x: 12, y: 24 } })
    store.stageGuardrailRemoval('input', agentId)
    expect(await store.removeGuardrail('input', agentId, repository)).toBe(true)
    expect(store.document?.inputGuardrail).toEqual({ state: 'inactive' })
    expect(store.document?.agents.some((agent) => agent.id === agentId)).toBe(false)
    expect(store.session.previewAgentId).toBeNull()
    expect(store.persistence.mutationSeq).toBe(2)
  })

  it('loads one read-only Workflow Preview and closes it when an empty Slot is selected', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    fixture.pattern.slots[1]!.agentId = null
    const repository = new InMemoryEditorRepository({
      journeys: [fixture],
      agentWorkflows: [createAgentWorkflowEditorDocumentFixture('research')],
    })
    const loadAgentWorkflow = vi.spyOn(repository, 'loadAgentWorkflow')
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)

    expect(await store.selectSlotForPreview(fixture.pattern.slots[0]!.id, repository)).toBe(true)
    expect(store.previewState).toEqual({ type: 'ready', agentId: fixture.pattern.slots[0]!.agentId })
    expect(store.previewDocument?.agent.id).toBe(fixture.pattern.slots[0]!.agentId)
    expect(loadAgentWorkflow).toHaveBeenCalledOnce()

    expect(await store.selectSlotForPreview(fixture.pattern.slots[1]!.id, repository)).toBe(true)
    expect(store.session.selectedSlotId).toBe(fixture.pattern.slots[1]!.id)
    expect(store.session.previewAgentId).toBeNull()
    expect(store.previewState).toEqual({ type: 'closed' })
    expect(store.previewDocument).toBeNull()
    expect(loadAgentWorkflow).toHaveBeenCalledOnce()
    expect(store.toSaveInput()).not.toHaveProperty('preview')
  })

  it('persists unassignment before a Template is assigned to the same Slot again', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const workflow = createAgentWorkflowEditorDocumentFixture('research')
    const { repository } = createInMemoryEditorRepositoryScenario({
      journeys: [fixture],
      agentWorkflows: [workflow],
    })
    const originalAgentId = fixture.pattern.slots[0]!.agentId
    if (!originalAgentId) throw new Error('Configured fixture Slot is missing its Agent')
    const savedTemplate = await repository.saveAgentAsTemplate({
      journeyId: fixture.journey.id,
      agentId: originalAgentId,
      name: 'Reusable research Agent',
      description: null,
    })
    if (!savedTemplate.ok) throw new Error(savedTemplate.error.code)

    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)
    const slotId = fixture.pattern.slots[0]!.id
    const initialRevision = store.document?.journey.revision

    expect(await store.unassignAgentAndSave(slotId, repository)).toBe(true)
    expect(store.document?.pattern.slots[0]?.agentId).toBeNull()
    expect(store.document?.journey.revision).toBe((initialRevision ?? 0) + 1)
    const unassignedRevision = store.document?.journey.revision ?? 0

    expect(await store.instantiateTemplate(savedTemplate.value.id, slotId, repository)).toBe(true)
    expect(store.document?.pattern.slots[0]?.agentId).not.toBeNull()
    expect(store.document?.pattern.slots[0]?.agentId).not.toBe(originalAgentId)
    expect(store.document?.journey.revision).toBeGreaterThanOrEqual(unassignedRevision)
  })

  it('keeps an occupied Slot unchanged when persisted unassignment fails', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const { repository, controls } = createInMemoryEditorRepositoryScenario({ journeys: [fixture] })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)
    const slotId = fixture.pattern.slots[0]!.id
    const agentId = fixture.pattern.slots[0]!.agentId
    controls.failNext('NETWORK_FAILED')

    expect(await store.unassignAgentAndSave(slotId, repository)).toBe(false)
    expect(store.document?.pattern.slots[0]?.agentId).toBe(agentId)
    expect(store.persistence.saveStatus).toBe('error')
    expect(store.persistence.error).toEqual({ code: 'NETWORK_FAILED' })
  })

  it('ignores an older Preview response after switching Agent identity', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const firstAgent = createAgentWorkflowEditorDocumentFixture('research')
    const secondAgent = createAgentWorkflowEditorDocumentFixture('minimal')
    const first = deferred<RepositoryResult<typeof firstAgent>>()
    const second = deferred<RepositoryResult<typeof secondAgent>>()
    const base = new InMemoryEditorRepository({ journeys: [fixture] })
    const repository = {
      loadJourney: base.loadJourney.bind(base),
      saveJourney: base.saveJourney.bind(base),
      loadAgentWorkflow: (_journeyId: typeof fixture.journey.id, agentId: typeof firstAgent.agent.id) =>
        agentId === firstAgent.agent.id ? first.promise : second.promise,
    } satisfies import('@/repositories').JourneyEditorRepository
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)

    const firstLoad = store.openWorkflowPreview(firstAgent.agent.id, repository)
    const secondLoad = store.openWorkflowPreview(secondAgent.agent.id, repository)
    second.resolve({ ok: true, value: secondAgent })
    expect(await secondLoad).toBe(true)
    first.resolve({ ok: true, value: firstAgent })
    expect(await firstLoad).toBe(false)

    expect(store.previewState).toEqual({ type: 'ready', agentId: secondAgent.agent.id })
    expect(store.previewDocument?.agent.id).toBe(secondAgent.agent.id)
  })

  it('invalidates lifecycle ownership on dispose and blocks concurrent operations', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    fixture.pattern.slots[1]!.agentId = null
    const editorRepository = new InMemoryEditorRepository({ journeys: [fixture] })
    const pending = deferred<RepositoryResult<CreateOrInstantiateAgentSuccess>>()
    const createJourneyAgent = vi.fn(() => pending.promise)
    const lifecycleRepository = {
      listAgentTemplates: async () => ({ ok: true, value: [] } as const),
      loadAgentTemplate: async () => { throw new Error('Unexpected Template load') },
      createJourneyAgent,
      saveAgentAsTemplate: async () => { throw new Error('Unexpected Template save') },
      instantiateAgentTemplate: async () => { throw new Error('Unexpected Template instantiate') },
      removeOccupiedSlot: async () => { throw new Error('Unexpected occupied Slot removal') },
    } satisfies AgentLifecycleRepository
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'agent', editorRepository)
    const slotId = fixture.pattern.slots[1]!.id
    const first = store.createAgent(slotId, lifecycleRepository)
    expect(await store.createAgent(slotId, lifecycleRepository)).toBe(false)
    expect(createJourneyAgent).toHaveBeenCalledOnce()
    store.dispose()
    pending.resolve({ ok: true, value: {
      journey: fixture,
      agent: createAgentWorkflowEditorDocumentFixture('research'),
    } })
    expect(await first).toBe(false)
    expect(store.document).toBeNull()
    expect(store.lifecycle.operationStatus).toBe('idle')
    expect(store.agentTemplates).toEqual([])
  })

  it('resets lifecycle state when loading a new Journey identity', async () => {
    const first = createJourneyEditorDocumentFixture()
    const secondId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998')
    const second = journeyEditorDocumentSchema.parse({
      ...createJourneyEditorDocumentFixture(),
      journey: { ...createJourneyEditorDocumentFixture().journey, id: secondId, name: 'Second Journey' },
    })
    const repository = new InMemoryEditorRepository({ journeys: [first, second] })
    const store = useJourneyEditorStore()
    await store.load(first.journey.id, 'agent', repository)
    store.lifecycle.operationStatus = 'error'
    store.lifecycle.templateStatus = 'error'
    store.lifecycle.error = { code: 'NETWORK_FAILED' }
    await store.load(secondId, 'execution', repository)
    expect(store.lifecycle).toEqual({ templateStatus: 'idle', operationStatus: 'idle', error: null })
  })
})
