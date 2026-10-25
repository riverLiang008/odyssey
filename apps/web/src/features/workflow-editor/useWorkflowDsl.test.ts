import { effectScope, nextTick, ref, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { uuidSchema, type KnowledgeSpaceSummary, type AgentWorkflowEditorDocument } from '@odyssey/schemas'
import { useWorkflowDsl } from './useWorkflowDsl'

describe('DSL synchronization session', () => {
  afterEach(() => vi.useRealTimers())
  function setup(withJourney = false, initialKnowledgeStatus: 'loading' | 'ready' | 'error' = 'ready') {
    vi.useFakeTimers()
    const document = shallowRef<AgentWorkflowEditorDocument | null>(createAgentWorkflowEditorDocumentFixture('research'))
    const knowledge = ref([{ id: uuidSchema.parse(FIXTURE_IDS.knowledgeSpace), name: 'Product Docs', lifecycleStatus: 'ready', graphStatus: 'healthy' }] as KnowledgeSpaceSummary[])
    const sequence = ref(0)
    const knowledgeStatus = ref(initialKnowledgeStatus)
    const scope = effectScope()
    const apply = vi.fn((candidate, _expectedMutationSeq: number) => { void _expectedMutationSeq; if (document.value) document.value = { ...document.value, ...candidate }; sequence.value++; return { ok: true } })
    const session = scope.run(() => useWorkflowDsl({ document, journey: ref(withJourney ? createJourneyEditorDocumentFixture() : null), knowledge, knowledgeStatus, mutationSeq: () => sequence.value, apply }))
    if (!session) throw new Error('Scope initialization failed')
    return { document, knowledge, knowledgeStatus, sequence, scope, session, apply }
  }
  it('previews an explicit 0.2 upgrade without mutating Canvas until Apply', () => {
    const { session, document, scope, apply } = setup()
    const before = structuredClone(document.value)
    session.upgrade()
    expect(session.source.value).toContain('version "0.2"')
    expect(session.source.value).toContain('$agent.')
    expect(document.value).toEqual(before)
    expect(apply).not.toHaveBeenCalled()
    session.apply()
    expect(document.value?.workflow.schemaVersion).toBe('1.2.0')
    expect(document.value?.layout).toEqual(before?.layout)
    expect(document.value?.workflow.nodes.map(node => node.id)).toEqual(before?.workflow.nodes.map(node => node.id))
    scope.stop()
  })
  it.each(['loading', 'error'] as const)('rechecks an unapplied draft when the initial inventory becomes ready from %s', async (status) => {
    const { session, knowledgeStatus, scope, apply } = setup(false, status)
    const draft = session.source.value.replace('Research the requested topic.', 'Draft before resources arrive.')
    session.edit(draft)
    await vi.advanceTimersByTimeAsync(250)
    expect(session.state.value.type).toBe('context-required')
    knowledgeStatus.value = 'ready'
    await nextTick()
    expect(session.state.value.type).toBe('ready')
    expect(session.source.value).toBe(draft)
    expect(apply).not.toHaveBeenCalled()
    session.apply()
    expect(apply).toHaveBeenCalledOnce()
    scope.stop()
  })
  it('does not rebase initial resource loading over a changed Canvas', async () => {
    const { session, knowledgeStatus, document, sequence, scope, apply } = setup(false, 'loading')
    session.edit(session.source.value + '\n// draft')
    if (!document.value) throw new Error('Missing document')
    document.value = { ...document.value, workflow: { ...document.value.workflow, nodes: document.value.workflow.nodes.map(node => node.type === 'agent_action' ? { ...node, name: 'New Canvas action' } : node) } }
    sequence.value++
    knowledgeStatus.value = 'ready'
    await nextTick()
    expect(session.state.value.type).toBe('stale')
    session.apply()
    expect(apply).not.toHaveBeenCalled()
    scope.stop()
  })
  it('blocks unsynchronized Pattern exits and still reports syntax errors without mutating Canvas', async () => {
    const { session, scope, apply } = setup(true)
    expect(session.state.value.type).toBe('context-required')
    expect(session.diagnostics.value).toContainEqual(expect.objectContaining({ code: 'ODSL504', messageKey: 'ODSL504_EXIT_ROUTING' }))
    const draft = session.source.value + '\n"unfinished'
    session.edit(draft)
    await vi.advanceTimersByTimeAsync(250)
    expect(session.diagnostics.value.some(item => item.severity === 'error')).toBe(true)
    session.apply()
    expect(apply).not.toHaveBeenCalled()
    expect(session.source.value).toBe(draft)
    scope.stop()
  })
  it('opens without mutation, refreshes for Canvas edits, applies once and retains source', async () => {
    const fixture = setup()
    const { session, document, scope, apply } = fixture
    expect(session.state.value.type).toBe('synced')
    expect(apply).not.toHaveBeenCalled()
    if (document.value) { document.value.workflow.nodes[1].name = 'Updated on Canvas'; document.value = structuredClone(document.value) }
    await nextTick()
    await vi.advanceTimersByTimeAsync(150)
    expect(session.source.value).toContain('Updated on Canvas')
    const edited = session.source.value.replace('Research the requested topic.', 'A new goal.')
    session.edit(edited)
    await vi.advanceTimersByTimeAsync(250)
    expect(session.state.value.type).toBe('ready')
    session.apply()
    await nextTick()
    expect(apply).toHaveBeenCalledOnce()
    expect(session.source.value).toBe(edited)
    expect(session.state.value.type).toBe('synced')
    expect(session.dirty.value).toBe(false)
    scope.stop()
  })
  it('keeps a draft valid through layout changes and applies with the latest Canvas layout', async () => {
    const { session, document, sequence, scope, apply } = setup()
    const draft = session.source.value.replace('Research the requested topic.', 'Edited goal.')
    session.edit(draft)
    if (!document.value) throw new Error('Missing document')
    const latest = structuredClone(document.value.layout)
    latest.viewport = { x: 123, y: -56, zoom: 0.75 }
    latest.nodePlacements = latest.nodePlacements.map((placement) => ({ ...placement, x: placement.x + 57 }))
    document.value = { ...document.value, layout: latest }
    sequence.value++
    await nextTick()
    await vi.advanceTimersByTimeAsync(250)
    expect(session.source.value).toBe(draft)
    expect(session.state.value.type).toBe('ready')
    session.apply()
    expect(apply).toHaveBeenCalledOnce()
    expect(apply.mock.calls[0]?.[1]).toBe(1)
    expect(document.value.layout).toEqual(latest)
    scope.stop()
  })
  it('preserves IDs across consecutive DSL renames and prints Canvas renames into edges', async () => {
    const { session, document, scope } = setup()
    if (!document.value) throw new Error('Missing document')
    const action = document.value.workflow.nodes.find((node) => node.type === 'agent_action')
    if (!action) throw new Error('Missing action')
    const originalId = action.id
    let currentName = action.name
    for (const nextName of ['调研步骤', '最终调研步骤']) {
      session.edit(session.source.value.replaceAll(JSON.stringify(currentName), JSON.stringify(nextName)))
      await vi.advanceTimersByTimeAsync(250)
      expect(session.state.value.type).toBe('ready')
      session.apply()
      await nextTick()
      expect(document.value.workflow.nodes.find((node) => node.id === originalId)?.name).toBe(nextName)
      currentName = nextName
    }
    const latest = structuredClone(document.value)
    const renamed = latest.workflow.nodes.find((node) => node.id === originalId)
    if (!renamed) throw new Error('Missing retained action')
    renamed.name = 'Canvas rename'
    document.value = latest
    await nextTick()
    await vi.advanceTimersByTimeAsync(150)
    expect(session.source.value).toContain('agent_action "Canvas rename" {')
    expect(session.source.value).toContain('start -> "Canvas rename";')
    expect(session.state.value.type).toBe('synced')
    scope.stop()
  })
  it('preserves invalid draft and refuses to apply after Canvas or inventory changes', async () => {
    const { session, document, sequence, scope, apply } = setup()
    const draft = session.source.value + '\nunfinished'
    session.edit(draft)
    await vi.advanceTimersByTimeAsync(250)
    expect(session.state.value.type).toBe('invalid')
    session.apply()
    expect(apply).not.toHaveBeenCalled()
    if (document.value) document.value.workflow.nodes[1].name = 'Other change'
    sequence.value++
    await nextTick()
    expect(session.state.value.type).toBe('stale')
    expect(session.source.value).toBe(draft)
    session.apply()
    expect(apply).not.toHaveBeenCalled()
    session.revert()
    expect(session.dirty.value).toBe(false)
    scope.stop()
  })
  it('rejects a same-name resource replacement and cancels a pending check on disposal', async () => {
    const { session, knowledge, scope, apply } = setup()
    session.edit(session.source.value + '\n// draft')
    knowledge.value = knowledge.value.map((entry) => ({ ...entry, id: uuidSchema.parse(crypto.randomUUID()) }))
    await nextTick()
    expect(session.state.value.type).toBe('stale')
    scope.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(apply).not.toHaveBeenCalled()
    expect(session.state.value.type).toBe('stale')
  })
})


