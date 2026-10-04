import { describe, expect, it, vi } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures'
import { HttpEditorRepository } from './httpEditorRepository'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('HttpEditorRepository', () => {
  it('loads a runtime-validated paged Knowledge Space inventory', async () => {
    const page = {
      items: [{
        id: '0195f076-b6e6-7ef0-98db-d721990f8996',
        name: 'Product knowledge',
        description: null,
        knowledgeSpaceCategoryId: '0195f076-b6e6-7ef0-98db-d721990f8995',
        lifecycleStatus: 'ready',
        graphStatus: 'healthy',
        updatedAt: '2025-02-01T00:00:00.000Z',
      }],
      page: 1,
      pageSize: 20,
      total: 1,
    }
    const fetchImplementation = vi.fn().mockResolvedValue(json(page))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })
    expect(await repository.listKnowledgeSpaces({ query: 'product', page: 1, pageSize: 20 })).toEqual({ ok: true, value: page })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe('http://localhost:8000/api/v1/knowledge-spaces?query=product&page=1&pageSize=20')
  })

  it('maps Journey list, save, and quoted If-Match delete contracts', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const summary = {
      id: journey.journey.id,
      name: journey.journey.name,
      description: journey.journey.description,
      status: journey.journey.status,
      patternKind: journey.pattern.kind,
      agentCount: journey.agents.length,
      revision: journey.journey.revision,
      createdAt: journey.journey.createdAt,
      updatedAt: journey.journey.updatedAt,
    }
    const saved = structuredClone(journey)
    saved.journey.revision += 1
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json([summary]))
      .mockResolvedValueOnce(json(saved))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1/', fetchImplementation })

    expect(await repository.listJourneys()).toEqual({ ok: true, value: [summary] })
    expect(await repository.saveJourney({ journeyId: journey.journey.id, expectedRevision: journey.journey.revision, pattern: journey.pattern })).toEqual({
      ok: true,
      value: { journeyId: journey.journey.id, revision: saved.journey.revision, updatedAt: saved.journey.updatedAt },
    })
    expect(await repository.deleteJourney({ journeyId: journey.journey.id, expectedRevision: saved.journey.revision })).toEqual({ ok: true, value: { journeyId: journey.journey.id } })

    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(`http://localhost:8000/api/v1/journeys/${journey.journey.id}`)
    const saveBody = JSON.parse(String((fetchImplementation.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>
    expect(saveBody).toEqual({ expectedRevision: journey.journey.revision, pattern: journey.pattern })
    expect((fetchImplementation.mock.calls[2]?.[1] as RequestInit).headers).toEqual({ 'If-Match': `"${saved.journey.revision}"` })
  })

  it('sends only expected revision when creating a minimum Agent', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const slot = journey.pattern.slots.at(-1)!
    slot.agentId = null
    const agent = createAgentWorkflowEditorDocumentFixture('minimal')
    agent.agent.journeyId = journey.journey.id
    agent.agent.id = uuidSchema.parse('0195f076-b6e6-7ef0-98db-777777777777')
    const returnedJourney = structuredClone(journey)
    returnedJourney.journey.revision += 1
    returnedJourney.agents.push({ id: agent.agent.id, name: agent.agent.name, description: agent.agent.description, revision: agent.agent.revision, updatedAt: agent.agent.updatedAt })
    returnedJourney.pattern.slots.at(-1)!.agentId = agent.agent.id
    const fetchImplementation = vi.fn().mockResolvedValue(json({ journey: returnedJourney, agent }, 201))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    const result = await repository.createJourneyAgent({ journeyId: journey.journey.id, slotId: slot.id, expectedRevision: journey.journey.revision })
    expect(result.ok).toBe(true)
    expect(JSON.parse(String((fetchImplementation.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ expectedRevision: journey.journey.revision })
  })

  it('maps atomic Guardrail add and remove commands with runtime-validated aggregates', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const agent = createAgentWorkflowEditorDocumentFixture('minimal')
    agent.agent.journeyId = journey.journey.id
    agent.agent.id = uuidSchema.parse('0195f076-b6e6-7ef0-98db-666666666666')
    const active = structuredClone(journey)
    active.journey.revision += 1
    active.agents.push({ id: agent.agent.id, name: agent.agent.name, description: agent.agent.description, revision: agent.agent.revision, updatedAt: agent.agent.updatedAt })
    active.inputGuardrail = { state: 'active', structure: 'single', agentId: agent.agent.id }
    const inactive = structuredClone(active)
    inactive.journey.revision += 1
    inactive.agents = inactive.agents.filter((summary) => summary.id !== agent.agent.id)
    inactive.inputGuardrail = { state: 'inactive' }
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json({ journey: active, agent }, 201))
      .mockResolvedValueOnce(json(inactive))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect((await repository.addGuardrail({ journeyId: journey.journey.id, side: 'input', expectedRevision: journey.journey.revision })).ok).toBe(true)
    expect((await repository.removeGuardrail({ journeyId: journey.journey.id, side: 'input', expectedRevision: active.journey.revision, expectedAgentId: agent.agent.id })).ok).toBe(true)
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/journeys/${journey.journey.id}/guardrails/input/commands/add`)
    expect(JSON.parse(String((fetchImplementation.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ expectedRevision: journey.journey.revision })
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(`http://localhost:8000/api/v1/journeys/${journey.journey.id}/guardrails/input/commands/remove`)
    expect(JSON.parse(String((fetchImplementation.mock.calls[1]?.[1] as RequestInit).body))).toEqual({ expectedRevision: active.journey.revision, expectedAgentId: agent.agent.id })
  })

  it('normalizes revision conflicts and fails closed for malformed error envelopes', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: 'REVISION_CONFLICT', details: { expectedRevision: 2, currentRevision: 3 } } }, 409))
      .mockResolvedValueOnce(json({ error: { code: 'REVISION_CONFLICT', details: {} } }, 409))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.loadJourney(journey.journey.id)).toEqual({ ok: false, error: { code: 'REVISION_CONFLICT', expectedRevision: 2, currentRevision: 3 } })
    expect(await repository.loadJourney(journey.journey.id)).toEqual({ ok: false, error: { code: 'RESPONSE_INVALID' } })
  })

  it('normalizes aborted and network-failed fetches', async () => {
    const journeyId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-888888888888')
    const aborted = new HttpEditorRepository({
      baseUrl: 'http://localhost:8000/api/v1',
      fetchImplementation: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
    })
    const offline = new HttpEditorRepository({
      baseUrl: 'http://localhost:8000/api/v1',
      fetchImplementation: vi.fn().mockRejectedValue(new TypeError('offline')),
    })
    expect(await aborted.loadJourney(journeyId)).toEqual({ ok: false, error: { code: 'ABORTED' } })
    expect(await offline.loadJourney(journeyId)).toEqual({ ok: false, error: { code: 'NETWORK_FAILED' } })
  })
})
