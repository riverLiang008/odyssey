import { describe, expect, it, vi } from 'vitest'
import { createDemoRepository } from './demoRepository'
import { demoAgents, demoDocuments, demoGraph, demoJourneys } from './demoData'
import { printWorkflowDsl } from '@/domain/workflow-dsl/printer'

describe('Public demo boundary', () => {
  it('publishes coherent cases, reviewed documents and non-empty relationships without HTTP', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network must not be used'))
    try {
      const repository = createDemoRepository()
      expect(demoJourneys.map(item => item.journey.name)).toEqual(['Document Curator', 'Knowledge QA'])
      expect(demoDocuments).toHaveLength(7)
      expect(demoGraph.edges.length).toBeGreaterThan(0)
      const listed = await repository.listJourneys()
      expect(listed.ok && listed.value.length).toBe(2)
      for (const agent of demoAgents) {
        const loaded = await repository.loadAgentWorkflow(agent.agent.journeyId, agent.agent.id)
        expect(loaded.ok).toBe(true)
        expect(printWorkflowDsl(agent, []).source).toContain('workflow')
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally { fetch.mockRestore() }
  })
  it('rejects mutations and returns defensive copies rather than changing published examples', async () => {
    const repository = createDemoRepository(), journey = demoJourneys[0]
    if (!journey) throw new Error('Missing demo')
    const before = structuredClone(demoJourneys)
    expect((await repository.deleteJourney({ journeyId: journey.journey.id, expectedRevision: 1 })).ok).toBe(false)
    expect((await repository.createJourney({ name: 'Not allowed', description: null, patternTemplateKey: 'solo_component' })).ok).toBe(false)
    const loaded = await repository.loadJourney(journey.journey.id)
    if (loaded.ok) loaded.value.journey.name = 'Local object mutation'
    expect(demoJourneys).toEqual(before)
    expect((await createDemoRepository().loadJourney(journey.journey.id))).toEqual({ ok: true, value: journey })
  })
})
