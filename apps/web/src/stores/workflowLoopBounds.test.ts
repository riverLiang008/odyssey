import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import { useWorkflowEditorStore } from './workflowEditor'

describe('Loop measurement application transaction', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('preserves configuration, saves reconciled bounds, and does not dirty a stable measurement', async () => {
    const document = createAgentWorkflowEditorDocumentFixture('loop')
    const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [document] })
    const store = useWorkflowEditorStore()
    await store.load(document.agent.journeyId, document.agent.id, repository)
    const loop = document.workflow.nodes.find(n => n.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Missing fixture')
    const sizes = loop.config.body.graph.nodes.map(n => ({ nodeId: n.id, width: 390, height: 500 }))
    store.reconcileLoopBounds(loop.id, sizes)
    const updated = store.document?.workflow.nodes.find(n => n.id === loop.id)
    expect(updated?.type === 'loop' && updated.config.body.graph).toEqual(loop.config.body.graph)
    expect(await store.save()).toBe(true)
    const saved = store.toSaveInput()
    const state = { ...store.persistenceState }
    store.reconcileLoopBounds(loop.id, sizes)
    expect(store.toSaveInput()).toEqual(saved)
    expect(store.persistenceState).toEqual(state)
    store.resizeWorkflowNode(loop.id, { width: 420, height: 300 })
    expect(store.document?.layout.nodePlacements.find(p => p.nodeId === loop.id)).toMatchObject({ width: 430, height: 594 })
    expect(await store.save()).toBe(true)
    await store.load(document.agent.journeyId, document.agent.id, repository)
    expect(store.document?.layout.nodePlacements.find(p => p.nodeId === loop.id)).toMatchObject({ width: 430, height: 594 })
    store.dispose()
  })
})
