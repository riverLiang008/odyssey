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
        category: { id: '0195f076-b6e6-7ef0-98db-d721990f8995', name: 'Research', colorToken: null, sortOrder: 0, isDefault: true },
        lifecycleStatus: 'ready',
        graphStatus: 'healthy',
        fileCount: 0,
        knowledgeFamilyCount: 0,
        openIssueCount: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
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
      value: { document: saved, journeyId: journey.journey.id, revision: saved.journey.revision, updatedAt: saved.journey.updatedAt },
    })
    expect(await repository.deleteJourney({ journeyId: journey.journey.id, expectedRevision: saved.journey.revision })).toEqual({ ok: true, value: { journeyId: journey.journey.id } })

    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(`http://localhost:8000/api/v1/journeys/${journey.journey.id}`)
    const saveBody = JSON.parse(String((fetchImplementation.mock.calls[1]?.[1] as RequestInit).body)) as Record<string, unknown>
    expect(saveBody).toEqual({ expectedRevision: journey.journey.revision, pattern: journey.pattern })
    expect((fetchImplementation.mock.calls[2]?.[1] as RequestInit).headers).toEqual({ 'If-Match': `"${saved.journey.revision}"` })
  })

  it('maps Knowledge Space metadata, lifecycle, and quoted If-Match delete contracts', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const categoryId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8995')
    const rootFolderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    const detail = {
      id: knowledgeSpaceId,
      name: 'Updated knowledge',
      description: 'Description',
      category: { id: categoryId, name: 'Research', colorToken: null, sortOrder: 0, isDefault: true },
      lifecycleStatus: 'ready',
      graphStatus: 'not_indexed',
      fileCount: 0,
      knowledgeFamilyCount: 0,
      openIssueCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
      rootFolderId,
      revision: 2,
      lastDocumentIndexedAt: null,
      lastStewardRunAt: null,
    } as const
    const archived = { ...detail, lifecycleStatus: 'archived' as const, revision: 3 }
    const restored = { ...detail, revision: 4 }
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json(detail))
      .mockResolvedValueOnce(json(archived))
      .mockResolvedValueOnce(json(restored))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect((await repository.updateKnowledgeSpace({ knowledgeSpaceId, expectedRevision: 1, name: detail.name, description: detail.description, categoryId })).ok).toBe(true)
    expect((await repository.archiveKnowledgeSpace({ knowledgeSpaceId, expectedRevision: 2 })).ok).toBe(true)
    expect((await repository.unarchiveKnowledgeSpace({ knowledgeSpaceId, expectedRevision: 3 })).ok).toBe(true)
    expect(await repository.deleteKnowledgeSpace({ knowledgeSpaceId, expectedRevision: 4 })).toEqual({ ok: true, value: { knowledgeSpaceId } })

    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}`)
    expect(JSON.parse(String((fetchImplementation.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ expectedRevision: 1, name: detail.name, description: detail.description, categoryId })
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/commands/archive`)
    expect(fetchImplementation.mock.calls[2]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/commands/unarchive`)
    expect((fetchImplementation.mock.calls[3]?.[1] as RequestInit).headers).toEqual({ 'If-Match': '"4"' })
  })

  it('loads a persisted file tree and creates a folder with optimistic concurrency', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const rootFolderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    const childFolderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8993')
    const root = { id: rootFolderId, knowledgeSpaceId, parentFolderId: null, name: 'Product knowledge', sortOrder: 0, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }
    const child = { ...root, id: childFolderId, parentFolderId: rootFolderId, name: 'Sources' }
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json({ knowledgeSpaceId, rootFolderId, revision: 1, folders: [root], resources: [] }))
      .mockResolvedValueOnce(json({ folder: child, knowledgeSpaceRevision: 2 }, 201))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect((await repository.loadKnowledgeFileTree(knowledgeSpaceId)).ok).toBe(true)
    expect(await repository.createKnowledgeFolder({ knowledgeSpaceId, expectedRevision: 1, parentFolderId: rootFolderId, name: 'Sources' })).toEqual({ ok: true, value: { folder: child, knowledgeSpaceRevision: 2 } })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/file-tree`)
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/folders`)
    expect(JSON.parse(String((fetchImplementation.mock.calls[1]?.[1] as RequestInit).body))).toEqual({ expectedRevision: 1, parentFolderId: rootFolderId, name: 'Sources' })
  })

  it('prepares, directly uploads, and finalizes a Knowledge file', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const rootFolderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992')
    const artifactId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8991')
    const file = new File(['hello'], 'notes.md')
    const resource = {
      id: resourceId,
      knowledgeSpaceId,
      folderId: rootFolderId,
      name: 'notes.md',
      status: 'indexing',
      mimeType: 'text/markdown',
      sizeBytes: 5,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:01.000Z',
    }
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json({ resourceId, artifactId, uploadUrl: 'http://objects.test/upload', method: 'PUT', requiredHeaders: { 'Content-Type': 'text/markdown' }, expiresAt: '2025-01-01T00:15:00.000Z' }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ resource, knowledgeSpaceRevision: 2 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.uploadKnowledgeFile({ knowledgeSpaceId, folderId: rootFolderId, expectedRevision: 1, file })).toEqual({ ok: true, value: { resource, knowledgeSpaceRevision: 2 } })
    expect(JSON.parse(String((fetchImplementation.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ folderId: rootFolderId, fileName: 'notes.md', contentType: 'text/markdown', sizeBytes: 5 })
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe('http://objects.test/upload')
    expect(fetchImplementation.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', body: file, headers: { 'Content-Type': 'text/markdown' } })
    expect(JSON.parse(String((fetchImplementation.mock.calls[2]?.[1] as RequestInit).body))).toEqual({ artifactId, expectedRevision: 1 })
  })

  it('moves a Knowledge resource with optimistic concurrency', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992')
    const targetFolderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8993')
    const resource = { id: resourceId, knowledgeSpaceId, folderId: targetFolderId, name: 'notes.md', status: 'indexing', mimeType: 'text/markdown', sizeBytes: 5, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:01.000Z' }
    const fetchImplementation = vi.fn().mockResolvedValueOnce(json({ resource, knowledgeSpaceRevision: 3 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.moveKnowledgeResource({ knowledgeSpaceId, resourceId, targetFolderId, expectedRevision: 2 })).toEqual({ ok: true, value: { resource, knowledgeSpaceRevision: 3 } })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/resources/${resourceId}/commands/move`)
    expect(JSON.parse(String((fetchImplementation.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ targetFolderId, expectedRevision: 2 })
  })

  it('deletes a Knowledge resource with optimistic concurrency', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992')
    const fetchImplementation = vi.fn().mockResolvedValueOnce(json({ resourceId, knowledgeSpaceRevision: 4 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.deleteKnowledgeResource({ knowledgeSpaceId, resourceId, expectedRevision: 3 })).toEqual({
      ok: true,
      value: { resourceId, knowledgeSpaceRevision: 4 },
    })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/resources/${resourceId}`)
    expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', headers: { 'If-Match': '"3"' } })
  })

  it('replaces Markdown content with optimistic concurrency', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992')
    const folderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    const resource = { id: resourceId, knowledgeSpaceId, folderId, name: 'notes.md', status: 'indexing', mimeType: 'text/markdown', sizeBytes: 9, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:02.000Z' }
    const fetchImplementation = vi.fn().mockResolvedValueOnce(json({ resource, knowledgeSpaceRevision: 4 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.updateKnowledgeResourceContent({ knowledgeSpaceId, resourceId, expectedRevision: 3, content: '# Updated' })).toEqual({ ok: true, value: { resource, knowledgeSpaceRevision: 4 } })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/resources/${resourceId}/content`)
    expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(String((fetchImplementation.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ expectedRevision: 3, content: '# Updated' })
  })

  it('loads a validated Knowledge resource and its text preview', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992')
    const folderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    const detail = {
      id: resourceId, knowledgeSpaceId, folderId, name: 'notes.md', status: 'indexing', mimeType: 'text/markdown', sizeBytes: 14,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:01.000Z', summary: null, guide: null,
      checksumSha256: 'ab'.repeat(32), lastIndexedAt: null, downloadUrl: 'http://objects.test/notes.md', downloadExpiresAt: '2025-01-01T00:15:00.000Z',
    }
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json(detail))
      .mockResolvedValueOnce(new Response('# Hello Odyssey', { status: 200, headers: { 'Content-Type': 'text/markdown' } }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.loadKnowledgeResource(knowledgeSpaceId, resourceId)).toEqual({
      ok: true,
      value: { detail, preview: { type: 'text', content: '# Hello Odyssey', truncated: false } },
    })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`http://localhost:8000/api/v1/knowledge-spaces/${knowledgeSpaceId}/resources/${resourceId}`)
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(detail.downloadUrl)
  })

  it('keeps document metadata available when its text preview cannot be fetched', async () => {
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992')
    const folderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8994')
    const detail = {
      id: resourceId, knowledgeSpaceId, folderId, name: 'notes.md', status: 'indexing', mimeType: 'text/markdown', sizeBytes: 14,
      createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:01.000Z', summary: null, guide: null,
      checksumSha256: 'ab'.repeat(32), lastIndexedAt: null, downloadUrl: 'http://objects.test/notes.md', downloadExpiresAt: '2025-01-01T00:15:00.000Z',
    }
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(json(detail))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    expect(await repository.loadKnowledgeResource(knowledgeSpaceId, resourceId)).toEqual({
      ok: true,
      value: { detail, preview: { type: 'failed', error: { code: 'NETWORK_FAILED' } } },
    })
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

  it('reports the invalid Agent workflow request path before transport', async () => {
    const agent = createAgentWorkflowEditorDocumentFixture('minimal')
    const fetchImplementation = vi.fn()
    const repository = new HttpEditorRepository({ baseUrl: 'http://localhost:8000/api/v1', fetchImplementation })

    const result = await repository.saveAgentWorkflow({
      journeyId: agent.agent.journeyId,
      agentId: agent.agent.id,
      expectedRevision: agent.agent.revision,
      workflow: { ...agent.workflow, nodes: [{ ...agent.workflow.nodes[0]!, name: '' }, ...agent.workflow.nodes.slice(1)] },
      layout: agent.layout,
      variables: agent.variables,
      reusableTools: agent.reusableTools,
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', issues: [{ path: ['workflow', 'nodes', 0, 'name'] }] },
    })
    expect(fetchImplementation).not.toHaveBeenCalled()
  })
})
