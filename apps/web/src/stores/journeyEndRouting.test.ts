import { uuidSchema } from '@odyssey/schemas'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures/editorFixtures'
import { InMemoryEditorRepository } from '@/repositories/inMemoryEditorRepository'
import { useJourneyEditorStore } from './journeyEditor'

describe('Pattern End synchronization confirmation', () => {
  it('pauses on destructive impact and resubmits only the explicit revision-bound confirmation', async () => {
    setActivePinia(createPinia())
    const fixture = createJourneyEditorDocumentFixture()
    const repository = new InMemoryEditorRepository({ journeys: [fixture] })
    const save = vi.spyOn(repository, 'saveJourney').mockResolvedValueOnce({ ok: false, error: {
      code: 'STATE_CONFLICT', reason: 'END_ROUTING_CONFIRMATION_REQUIRED',
      routingImpact: [{ agentId: uuidSchema.parse(FIXTURE_IDS.researchAgent), revision: 2, removedEndIds: [uuidSchema.parse(FIXTURE_IDS.researchAgent)], removedEdgeIds: [uuidSchema.parse(FIXTURE_IDS.researchAgent)], legacy: false }],
    } }).mockResolvedValueOnce({ ok: true, value: { journeyId: fixture.journey.id, revision: fixture.journey.revision + 1, updatedAt: fixture.journey.updatedAt } })
    const store = useJourneyEditorStore()
    await store.load(fixture.journey.id, 'execution', repository)
    expect(store.unassignAgent(fixture.pattern.slots[0]!.id)?.ok).toBe(true)
    expect(await store.save()).toBe(false)
    expect(store.routingImpact).toHaveLength(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(await store.confirmRoutingChanges()).toBe(true)
    expect(save.mock.calls[1]?.[0].routingConfirmation).toEqual([{ agentId: FIXTURE_IDS.researchAgent, revision: 2, removedEndIds: [uuidSchema.parse(FIXTURE_IDS.researchAgent)], removedEdgeIds: [uuidSchema.parse(FIXTURE_IDS.researchAgent)] }])
    expect(store.routingImpact).toEqual([])
    store.dispose()
  })
})
