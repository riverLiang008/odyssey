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
    const pending = store.load(uuidSchema.parse(FIXTURE_IDS.journey), 'pattern', repository)
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
    await store.load(journeyId, 'pattern', repository)
    expect(store.persistence.loadStatus).toBe('error')
    expect(store.persistence.error?.code).toBe('NETWORK_FAILED')

    await store.load(journeyId, 'pattern', repository)
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
      saveAgentWorkflow: async () => { throw new Error('Unexpected Agent save') },
    } satisfies import('@/repositories').EditorRepository
    const store = useJourneyEditorStore()

    const oldLoad = store.load(firstId, 'pattern', repository)
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
    const staleSuccessLoad = store.load(firstId, 'pattern', successRepository)
    const currentSuccessLoad = store.load(secondId, 'execution', successRepository)
    currentSuccess.resolve({ ok: true, value: secondDocument })
    await currentSuccessLoad
    staleSuccess.resolve({ ok: true, value: firstDocument })
    await staleSuccessLoad
    expect(store.document?.journey.name).toBe('Second Journey')
    expect(store.session.activeTab).toBe('execution')

    const late = deferred<RepositoryResult<JourneyEditorDocument>>()
    const lateRepository = { ...repository, loadJourney: () => late.promise }
    const disposedLoad = store.load(firstId, 'pattern', lateRepository)
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
    await store.load(uuidSchema.parse(FIXTURE_IDS.journey), 'pattern', repository)
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

  it('preflights and dispatches valid drops while keeping invalid dragover atomic', async () => {
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'pattern', repository)
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
    expect(await store.dispatchDrop(repository, patternIdFactory())).toBe(false)
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
    await store.load(fixture.journey.id, 'pattern', repository)
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
    await store.load(secondId, 'pattern', repository)
    expect(store.lifecycle).toEqual({ templateStatus: 'idle', operationStatus: 'idle', error: null })
  })
})
