import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { uuidSchema, type AgentWorkflowEditorDocument, type RepositoryResult, type UUID } from '@odyssey/schemas'

import {
  createAgentWorkflowEditorDocumentFixture,
  createJourneyEditorDocumentFixture,
  FIXTURE_IDS,
} from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import { cryptoWorkflowIdFactory } from '@/domain/workflow'
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
      listSystemToolDefinitions: async () => ({ ok: true, value: [] } as const),
      listKnowledgeSpaces: async () => ({ ok: true, value: { items: [], page: 1, pageSize: 20, total: 0 } } as const),
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
      listSystemToolDefinitions: async () => ({ ok: true, value: [] } as const),
      listKnowledgeSpaces: async () => ({ ok: true, value: { items: [], page: 1, pageSize: 20, total: 0 } } as const),
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

  it('applies Workflow commands atomically without changing layout, revision, or save projection shape', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [agentDocument],
    })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const layoutBefore = structuredClone(store.document!.layout)
    const revisionBefore = store.document!.agent.revision
    const taskId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8991')
    const result = store.addWorkflowNode({ id: taskId, type: 'task', name: 'Draft', config: { localVariables: [], steps: [] } })

    expect(result?.ok).toBe(true)
    expect(store.document?.layout).toEqual(layoutBefore)
    expect(store.document?.agent.revision).toBe(revisionBefore)
    expect(store.toSaveInput()?.workflow.nodes.some((node) => node.id === taskId)).toBe(true)
    expect(Object.keys(store.toSaveInput() ?? {})).not.toEqual(expect.arrayContaining(['session', 'validation', 'lastDomainError']))
  })

  it('preserves the document on rejected commands and reconciles selection after removal', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [agentDocument],
    })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const start = store.document!.workflow.nodes.find((node) => node.type === 'start')!
    const before = structuredClone(store.document)
    const rejected = store.removeWorkflowNode(start.id)
    expect(rejected?.ok).toBe(false)
    expect(store.document).toEqual(before)
    expect(store.lastDomainError?.code).toBe('BOUNDARY_NODE_IMMUTABLE')

    const taskId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8992') as UUID
    store.addWorkflowNode({ id: taskId, type: 'task', name: 'Selected', config: { localVariables: [], steps: [] } })
    store.selectNode(taskId)
    store.setPanel({ type: 'dsl-edit' })
    const removed = store.removeWorkflowNode(taskId)
    expect(removed?.ok).toBe(true)
    expect(store.session.selectedNodeId).toBeNull()
    expect(store.session.panel).toBeNull()
    expect(store.lastDomainError).toBeNull()
  })

  it('updates Loop settings without changing its nested CanvasLayout', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('loop')
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [agentDocument],
    })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const loop = store.document!.workflow.nodes.find((node) => node.type === 'loop')!
    if (loop.type !== 'loop') throw new Error('Expected Loop')
    const layoutBefore = structuredClone(loop.config.body.layout)

    const settingsResult = store.updateWorkflowLoopSettings(loop.id, {
      maxTurns: loop.config.maxTurns + 1,
      exitCondition: loop.config.exitCondition,
    })
    expect(settingsResult?.ok).toBe(true)
    const updatedLoop = store.document!.workflow.nodes.find((node) => node.id === loop.id)
    expect(updatedLoop?.type === 'loop' ? updatedLoop.config.body.layout : null).toEqual(layoutBefore)
  })

  it('isolates root and Loop child selection while keeping mode and focus out of persistence', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('loop')
    const repository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [agentDocument],
    })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const loop = store.document!.workflow.nodes.find((node) => node.type === 'loop')!
    if (loop.type !== 'loop') throw new Error('Expected Loop')
    const rootSelection = store.document!.workflow.nodes[0]!.id
    const childSelection = loop.config.body.graph.nodes[0]!.id

    store.selectNode(rootSelection)
    store.setPanel({ type: 'node-inspector', nodeId: rootSelection })
    store.switchCanvasContext({ kind: 'loop-body', loopNodeId: loop.id })
    expect(store.session.selectedNodeId).toBeNull()
    store.selectNode(childSelection)
    store.setPanel({ type: 'node-inspector', nodeId: childSelection })
    store.switchCanvasContext({ kind: 'root' })
    expect(store.session.selectedNodeId).toBe(rootSelection)
    store.switchCanvasContext({ kind: 'loop-body', loopNodeId: loop.id })
    expect(store.session.selectedNodeId).toBe(childSelection)

    const beforeMutation = store.persistence.mutationSeq
    expect(store.setWorkflowLoopBodyViewport(loop.id, { x: 31, y: -14, zoom: 1.2 })?.ok).toBe(true)
    expect(store.persistence.mutationSeq).toBe(beforeMutation + 1)
    const saved = store.toSaveInput()
    expect(saved?.workflow.nodes.find((node) => node.id === loop.id)?.type).toBe('loop')
    expect(Object.keys(saved ?? {})).not.toContain('session')
  })

  it('expands a Loop inline as session state without changing the save document', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('loop')
    const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [agentDocument] })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const loop = store.document!.workflow.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Expected Loop')
    const before = structuredClone(store.toSaveInput())
    const mutationBefore = store.persistence.mutationSeq

    expect(store.expandLoopInline(loop.id)).toBe(true)
    expect(store.session.loopPresentation).toEqual({ type: 'expanded-inline', loopNodeId: loop.id })
    expect(store.session.context).toEqual({ kind: 'loop-body', loopNodeId: loop.id })
    expect(store.toSaveInput()).toEqual(before)
    expect(store.persistence.mutationSeq).toBe(mutationBefore)

    store.collapseInlineLoop()
    expect(store.session.loopPresentation).toEqual({ type: 'collapsed' })
    expect(store.session.context).toEqual({ kind: 'root' })
    expect(store.toSaveInput()).toEqual(before)
  })

  it('binds resources through one root or Loop transaction and preserves rejected state', async () => {
    const rootDocument = createAgentWorkflowEditorDocumentFixture('research')
    const rootRepository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [rootDocument],
    })
    const rootStore = useWorkflowEditorStore()
    await rootStore.load(rootDocument.agent.journeyId, rootDocument.agent.id, rootRepository)
    const rootAction = rootStore.document!.workflow.nodes.find((node) => node.type === 'agent_action')
    if (!rootAction || rootAction.type !== 'agent_action') throw new Error('Expected root Agent Action')
    const toolId = uuidSchema.parse(FIXTURE_IDS.reusableTool)
    expect(rootStore.unbindWorkflowAgentActionReusableTool({ kind: 'root' }, rootAction.id, toolId)?.ok).toBe(true)
    const rootMutation = rootStore.persistence.mutationSeq
    expect(rootStore.bindWorkflowAgentActionReusableTool({ kind: 'root' }, rootAction.id, toolId)?.ok).toBe(true)
    expect(rootStore.persistence.mutationSeq).toBe(rootMutation + 1)
    const rootBeforeReject = structuredClone(rootStore.document)
    const rootRejectedMutation = rootStore.persistence.mutationSeq
    expect(rootStore.bindWorkflowAgentActionReusableTool({ kind: 'root' }, rootAction.id, toolId)).toMatchObject({ ok: false, error: { code: 'RESOURCE_ALREADY_BOUND' } })
    expect(rootStore.document).toEqual(rootBeforeReject)
    expect(rootStore.persistence.mutationSeq).toBe(rootRejectedMutation)

    setActivePinia(createPinia())
    const loopDocument = createAgentWorkflowEditorDocumentFixture('loop')
    const loopRepository = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [loopDocument],
    })
    const loopStore = useWorkflowEditorStore()
    await loopStore.load(loopDocument.agent.journeyId, loopDocument.agent.id, loopRepository)
    const loop = loopStore.document!.workflow.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Expected Loop')
    const childId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998')
    expect(loopStore.createWorkflowLoopBodyNode(loop.id, {
      id: childId,
      type: 'agent_action',
      name: 'Child action',
      config: {
        model: 'gpt-4o',
        goal: { kind: 'literal', value: 'Check the result.' },
        knowledgeSpaceIds: [],
        reusableToolIds: [],
      },
    }, { x: 100, y: 100 })?.ok).toBe(true)
    const loopMutation = loopStore.persistence.mutationSeq
    expect(loopStore.bindWorkflowAgentActionReusableTool({ kind: 'loop-body', loopNodeId: loop.id }, childId, toolId)?.ok).toBe(true)
    expect(loopStore.persistence.mutationSeq).toBe(loopMutation + 1)
    const savedLoop = loopStore.toSaveInput()?.workflow.nodes.find((node) => node.id === loop.id)
    const savedChild = savedLoop?.type === 'loop'
      ? savedLoop.config.body.graph.nodes.find((node) => node.id === childId)
      : null
    expect(savedChild?.type === 'agent_action' ? savedChild.config.reusableToolIds : []).toEqual([toolId])
  })

  it('does not mark newer local edits saved when an older explicit-save snapshot completes', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
    const base = new InMemoryEditorRepository({
      journeys: [createJourneyEditorDocumentFixture()],
      agentWorkflows: [agentDocument],
    })
    const saveResult = deferred<Awaited<ReturnType<typeof base.saveAgentWorkflow>>>()
    const repository = {
      listSystemToolDefinitions: async () => ({ ok: true, value: [] } as const),
      listKnowledgeSpaces: base.listKnowledgeSpaces.bind(base),
      loadJourney: base.loadJourney.bind(base),
      loadAgentWorkflow: base.loadAgentWorkflow.bind(base),
      saveJourney: base.saveJourney.bind(base),
      saveAgentWorkflow: vi.fn(() => saveResult.promise),
    } satisfies import('@/repositories').EditorRepository
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const firstNodeId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8995')
    const secondNodeId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    store.createWorkflowNode({ id: firstNodeId, type: 'task', name: 'First', config: { localVariables: [], steps: [] } }, { x: 10, y: 10 })
    const saving = store.save(repository)
    store.createWorkflowNode({ id: secondNodeId, type: 'task', name: 'Second', config: { localVariables: [], steps: [] } }, { x: 20, y: 20 })
    saveResult.resolve({ ok: true, value: { journeyId: agentDocument.agent.journeyId, agentId: agentDocument.agent.id, revision: 2, updatedAt: '2025-02-01T00:00:00.000Z' } })
    expect(await saving).toBe(true)
    expect(store.persistence.saveStatus).toBe('idle')
    expect(store.persistence.savedMutationSeq).toBeLessThan(store.persistence.mutationSeq)
    expect(store.document?.workflow.nodes.some((node) => node.id === secondNodeId)).toBe(true)
  })

  it('debounces local edits and persists them without an explicit Save click', async () => {
    vi.useFakeTimers()
    try {
      const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
      const base = new InMemoryEditorRepository({
        journeys: [createJourneyEditorDocumentFixture()],
        agentWorkflows: [agentDocument],
      })
      const repository = {
        listSystemToolDefinitions: async () => ({ ok: true, value: [] } as const),
      listKnowledgeSpaces: base.listKnowledgeSpaces.bind(base),
        loadJourney: base.loadJourney.bind(base),
        loadAgentWorkflow: base.loadAgentWorkflow.bind(base),
        saveJourney: base.saveJourney.bind(base),
        saveAgentWorkflow: vi.fn(base.saveAgentWorkflow.bind(base)),
      } satisfies import('@/repositories').EditorRepository
      const store = useWorkflowEditorStore()
      await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
      store.createWorkflowNode({ id: cryptoWorkflowIdFactory.nodeId(), type: 'task', name: 'Autosaved', config: { localVariables: [], steps: [] } }, { x: 10, y: 10 })

      await vi.advanceTimersByTimeAsync(799)
      expect(repository.saveAgentWorkflow).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(repository.saveAgentWorkflow).toHaveBeenCalledTimes(1)
      expect(store.persistence.saveStatus).toBe('saved')
      expect(store.document?.agent.revision).toBe(2)
      store.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('runs one coalesced follow-up save when editing during an in-flight autosave', async () => {
    vi.useFakeTimers()
    try {
      const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
      const base = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [agentDocument] })
      const firstSave = deferred<RepositoryResult<{ journeyId: UUID; agentId: UUID; revision: number; updatedAt: string }>>()
      const repository = {
        listSystemToolDefinitions: async () => ({ ok: true, value: [] } as const),
      listKnowledgeSpaces: base.listKnowledgeSpaces.bind(base),
        loadJourney: base.loadJourney.bind(base),
        loadAgentWorkflow: base.loadAgentWorkflow.bind(base),
        saveJourney: base.saveJourney.bind(base),
        saveAgentWorkflow: vi.fn()
          .mockImplementationOnce(() => firstSave.promise)
          .mockResolvedValueOnce({ ok: true, value: { journeyId: agentDocument.agent.journeyId, agentId: agentDocument.agent.id, revision: 3, updatedAt: '2025-02-02T00:00:00.000Z' } }),
      } satisfies import('@/repositories').EditorRepository
      const store = useWorkflowEditorStore()
      await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
      store.createWorkflowNode({ id: cryptoWorkflowIdFactory.nodeId(), type: 'task', name: 'First', config: { localVariables: [], steps: [] } }, { x: 10, y: 10 })
      await vi.advanceTimersByTimeAsync(800)
      expect(repository.saveAgentWorkflow).toHaveBeenCalledTimes(1)

      store.createWorkflowNode({ id: cryptoWorkflowIdFactory.nodeId(), type: 'task', name: 'Second', config: { localVariables: [], steps: [] } }, { x: 20, y: 20 })
      await vi.advanceTimersByTimeAsync(800)
      expect(repository.saveAgentWorkflow).toHaveBeenCalledTimes(1)
      firstSave.resolve({ ok: true, value: { journeyId: agentDocument.agent.journeyId, agentId: agentDocument.agent.id, revision: 2, updatedAt: '2025-02-01T00:00:00.000Z' } })
      await Promise.resolve()
      await vi.runOnlyPendingTimersAsync()

      expect(repository.saveAgentWorkflow).toHaveBeenCalledTimes(2)
      expect(store.persistence.saveStatus).toBe('saved')
      expect(store.document?.agent.revision).toBe(3)
      store.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('replaces stale domain feedback with the current Canvas rejection and clears it on retry', () => {
    const store = useWorkflowEditorStore()
    store.rejectCanvasInteraction('INVALID_CONNECTION')
    expect(store.lastCanvasError).toBe('INVALID_CONNECTION')
    expect(store.lastDomainError).toBeNull()
    store.clearWorkflowErrors()
    expect(store.lastCanvasError).toBeNull()
    expect(store.lastDomainError).toBeNull()
  })

  it('commits each valid creation draft as one document mutation and keeps invalid drafts open', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
    const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [agentDocument] })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const before = store.persistence.mutationSeq
    expect(store.stageCreationDraft('agent_action', { x: 240, y: 180 })).toBe(true)
    expect(store.submitAgentActionDraft({ name: 'Synthesize', model: '', goal: 'Create a brief' }, cryptoWorkflowIdFactory)).toEqual({ ok: false, error: { code: 'MODEL_REQUIRED' } })
    expect(store.persistence.mutationSeq).toBe(before)
    expect(store.session.creationDraft.type).toBe('agent-action')
    expect(store.submitAgentActionDraft({ name: 'Synthesize', model: 'gpt-4.1', goal: 'Create a brief' }, cryptoWorkflowIdFactory).ok).toBe(true)
    expect(store.persistence.mutationSeq).toBe(before + 1)
    expect(store.session.creationDraft.type).toBe('closed')

    const afterAction = store.persistence.mutationSeq
    expect(store.stageCreationDraft('loop', { x: 440, y: 180 })).toBe(true)
    expect(store.submitLoopDraft({ name: 'Review', maxTurns: 3, variableId: agentDocument.variables[0]!.id, operator: 'gte', comparisonValue: '2' }, cryptoWorkflowIdFactory).ok).toBe(true)
    expect(store.persistence.mutationSeq).toBe(afterAction + 1)
    const loop = store.document?.workflow.nodes.find((node) => node.type === 'loop')
    expect(loop?.type === 'loop' && loop.config.body.graph.nodes.map((node) => node.type)).toEqual(['loop_start', 'loop_end'])
    expect(store.session.loopPresentation).toEqual({ type: 'expanded-inline', loopNodeId: loop?.id })
    expect(store.session.context).toEqual({ kind: 'loop-body', loopNodeId: loop?.id })
  })

  it('uses Configure as the default authoring mode and blocks creation drafts in Flow view', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('minimal')
    const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [agentDocument] })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    expect(store.session.mode).toBe('configure')
    expect(store.stageCreationDraft('agent_action', { x: 120, y: 100 })).toBe(true)
    store.closeCreationDraft()
    store.setMode('flow')
    expect(store.stageCreationDraft('agent_action', { x: 120, y: 100 })).toBe(false)
  })

  it('creates Agent Actions inside a Loop but refuses nested Loop drafts', async () => {
    const agentDocument = createAgentWorkflowEditorDocumentFixture('loop')
    const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [agentDocument] })
    const store = useWorkflowEditorStore()
    await store.load(agentDocument.agent.journeyId, agentDocument.agent.id, repository)
    const loop = agentDocument.workflow.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Loop fixture missing')
    store.switchCanvasContext({ kind: 'loop-body', loopNodeId: loop.id })
    expect(store.stageCreationDraft('loop', { x: 10, y: 10 })).toBe(false)
    const before = store.persistence.mutationSeq
    expect(store.stageCreationDraft('agent_action', { x: 220, y: 160 })).toBe(true)
    expect(store.submitAgentActionDraft({ name: 'Child review', model: 'gpt-4.1', goal: 'Review evidence' }, cryptoWorkflowIdFactory).ok).toBe(true)
    expect(store.persistence.mutationSeq).toBe(before + 1)
    const updatedLoop = store.document?.workflow.nodes.find((node) => node.id === loop.id)
    expect(updatedLoop?.type === 'loop' && updatedLoop.config.body.graph.nodes.some((node) => node.type === 'agent_action' && node.name === 'Child review')).toBe(true)
  })
})
