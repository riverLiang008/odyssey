import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { uuidSchema, type AgentWorkflowEditorDocument, type RepositoryResult } from '@odyssey/schemas'

import {
  createAgentWorkflowEditorDocumentFixture,
  createJourneyEditorDocumentFixture,
  FIXTURE_IDS,
} from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import { useWorkflowEditorStore } from './workflowEditor'

const UNKNOWN_AGENT_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8999')

function deferred<T>() {
  let settle: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => { settle = resolve })
  return { promise, resolve(value: T) { if (!settle) throw new Error('Deferred is not initialized'); settle(value) } }
}

describe('workflowEditor store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('validates Journey ownership before loading the Agent aggregate', async () => {
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [createAgentWorkflowEditorDocumentFixture('research')],
    })
    const store = useWorkflowEditorStore()
    await store.load(uuidSchema.parse(FIXTURE_IDS.journey), UNKNOWN_AGENT_ID, repository)
    expect(store.document).toBeNull()
    expect(store.persistence.loadStatus).toBe('not-found')
    expect(store.persistence.error?.code).toBe('NOT_FOUND')
  })

  it('loads an owned workflow and excludes all session state from save input', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('research')
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [agentDocument],
    })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    store.setMode('configure')
    store.setFocusMode(true)
    store.setPanel({ type: 'agent-variables' })

    expect(store.persistence.loadStatus).toBe('ready')
    expect(store.toSaveInput()).toEqual({
      journeyId: agentDocument.agent.journeyId,
      agentId: agentDocument.agent.id,
      expectedRevision: agentDocument.agent.revision,
      workflow: agentDocument.workflow,
      layout: agentDocument.layout,
      variables: agentDocument.variables,
      reusableTools: agentDocument.reusableTools,
    })
    expect(Object.keys(store.toSaveInput() ?? {})).not.toContain('session')
  })

  it('rejects a repository response whose Agent identity differs from the URL', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const requested = createAgentWorkflowEditorDocumentFixture('research')
    const wrong = createAgentWorkflowEditorDocumentFixture('minimal')
    const repository = {
      loadJourney: async () => ({ ok: true, value: journey } as const),
      loadAgentWorkflow: async () => ({ ok: true, value: wrong } as const),
      saveJourney: async () => { throw new Error('Unexpected save') },
      saveAgentWorkflow: async () => { throw new Error('Unexpected save') },
    } satisfies import('@/repositories').EditorRepository
    const store = useWorkflowEditorStore()

    await store.load(requested.agent.journeyId, requested.agent.id, repository)
    expect(store.document).toBeNull()
    expect(store.persistence.loadStatus).toBe('error')
    expect(store.persistence.error?.code).toBe('RESPONSE_INVALID')
    expect(store.toSaveInput()).toBeNull()
  })

  it('ignores stale and disposed Agent completions even when the repository ignores abort', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const oldAgent = createAgentWorkflowEditorDocumentFixture('research')
    const newAgent = createAgentWorkflowEditorDocumentFixture('minimal')
    const oldResult = deferred<RepositoryResult<AgentWorkflowEditorDocument>>()
    const newResult = deferred<RepositoryResult<AgentWorkflowEditorDocument>>()
    const repository = {
      loadJourney: async () => ({ ok: true, value: journey } as const),
      loadAgentWorkflow: (_journeyId: typeof journey.journey.id, agentId: typeof oldAgent.agent.id) =>
        agentId === oldAgent.agent.id ? oldResult.promise : newResult.promise,
      saveJourney: async () => { throw new Error('Unexpected save') },
      saveAgentWorkflow: async () => { throw new Error('Unexpected save') },
    } satisfies import('@/repositories').EditorRepository
    const store = useWorkflowEditorStore()

    const oldLoad = store.load(journey.journey.id, oldAgent.agent.id, repository)
    await Promise.resolve()
    const newLoad = store.load(journey.journey.id, newAgent.agent.id, repository)
    await Promise.resolve()
    newResult.resolve({ ok: true, value: newAgent })
    await newLoad
    oldResult.resolve({ ok: false, error: { code: 'NETWORK_FAILED' } })
    await oldLoad
    expect(store.document?.agent.id).toBe(newAgent.agent.id)
    expect(store.persistence.loadStatus).toBe('ready')
    expect(store.persistence.error).toBeNull()

    const staleSuccess = deferred<RepositoryResult<AgentWorkflowEditorDocument>>()
    const currentSuccess = deferred<RepositoryResult<AgentWorkflowEditorDocument>>()
    const successRepository = {
      ...repository,
      loadAgentWorkflow: (_journeyId: typeof journey.journey.id, agentId: typeof oldAgent.agent.id) =>
        agentId === oldAgent.agent.id ? staleSuccess.promise : currentSuccess.promise,
    }
    const staleSuccessLoad = store.load(journey.journey.id, oldAgent.agent.id, successRepository)
    await Promise.resolve()
    const currentSuccessLoad = store.load(journey.journey.id, newAgent.agent.id, successRepository)
    await Promise.resolve()
    currentSuccess.resolve({ ok: true, value: newAgent })
    await currentSuccessLoad
    staleSuccess.resolve({ ok: true, value: oldAgent })
    await staleSuccessLoad
    expect(store.document?.agent.id).toBe(newAgent.agent.id)
    expect(store.persistence.loadStatus).toBe('ready')

    const lateResult = deferred<RepositoryResult<AgentWorkflowEditorDocument>>()
    const disposedRepository = { ...repository, loadAgentWorkflow: () => lateResult.promise }
    const disposedLoad = store.load(journey.journey.id, oldAgent.agent.id, disposedRepository)
    await Promise.resolve()
    store.dispose()
    lateResult.resolve({ ok: true, value: oldAgent })
    await disposedLoad
    expect(store.document).toBeNull()
    expect(store.persistence.loadStatus).toBe('idle')
  })
})
