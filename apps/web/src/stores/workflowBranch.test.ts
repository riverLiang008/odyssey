import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { uuidSchema, type BranchNode } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import type { BranchEditIntent } from '@/domain/workflow/branchDrafts'
import { useWorkflowEditorStore } from './workflowEditor'
const id = (n: number) => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${String(n).padStart(12, '0')}`)
beforeEach(() => setActivePinia(createPinia()))
describe('Branch editor application', () => {
  it('saves root Branch edits, preserves unrelated nodes/layout and reloads the same handles', async () => {
    const doc = createAgentWorkflowEditorDocumentFixture('research')
    const repo = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [doc] })
    const store = useWorkflowEditorStore(); await store.load(doc.agent.journeyId, doc.agent.id, repo)
    const node = store.document?.workflow.nodes.find(n => n.type === 'branch')
    if (!node || node.type !== 'branch') throw new Error('Expected Branch')
    const layout = structuredClone(doc.layout), others = doc.workflow.nodes.filter(n => n.id !== node.id)
    const intent: BranchEditIntent = { baseline: structuredClone(node), node: { ...structuredClone(node), name: 'Reviewed evidence' }, baselineEdges: doc.workflow.edges.filter(e => e.sourceNodeId === node.id), confirmedRemovedCaseIds: [] }
    expect(store.applyWorkflowBranchEdit({ kind: 'root' }, intent)).toBe(true)
    expect(store.document?.layout).toEqual(layout)
    expect(store.document?.workflow.nodes.filter(n => n.id !== node.id)).toEqual(others)
    expect(store.persistence.mutationSeq).toBe(1)
    expect(await store.save(repo)).toBe(true)
    await store.load(doc.agent.journeyId, doc.agent.id, repo)
    expect(store.document?.workflow.nodes.find(n => n.id === node.id)).toEqual(intent.node)
    expect(store.document?.workflow.edges.filter(e => e.sourceNodeId === node.id)).toEqual(intent.baselineEdges)
    store.dispose()
  })
  it('updates a Loop-body Branch atomically without changing root routing, and blocks Flow mutation', async () => {
    const doc = createAgentWorkflowEditorDocumentFixture('loop'), loop = doc.workflow.nodes.find(n => n.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Expected Loop')
    const node: BranchNode = { id: id(60), type: 'branch', name: 'Inner branch', config: { cases: [{ id: id(61), label: 'Match', match: 'all', conditions: [{ id: id(62), left: { kind: 'literal', value: 1 }, operator: 'eq', right: { kind: 'literal', value: 1 } }] }], defaultCase: { id: id(63), label: 'Default' } } }
    loop.config.body.graph.nodes.push(node)
    loop.config.body.layout.nodePlacements.push({ nodeId: node.id, x: 120, y: 150 })
    const end = loop.config.body.graph.nodes.find(n => n.type === 'loop_end')
    if (!end) throw new Error('Expected Loop End')
    loop.config.body.graph.edges.push({ id: id(64), sourceNodeId: node.id, sourceHandleId: id(61), targetNodeId: end.id })
    const repo = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [doc] })
    const store = useWorkflowEditorStore(); await store.load(doc.agent.journeyId, doc.agent.id, repo)
    const intent: BranchEditIntent = { baseline: node, node: { ...node, config: { ...node.config, cases: [] } }, baselineEdges: loop.config.body.graph.edges.filter(e => e.sourceNodeId === node.id), confirmedRemovedCaseIds: [id(61)] }
    const rootEdges = structuredClone(doc.workflow.edges)
    const applied = store.applyWorkflowBranchEdit({ kind: 'loop-body', loopNodeId: loop.id }, intent)
    expect(applied, JSON.stringify({ load: store.persistence, error: store.lastDomainError })).toBe(true)
    const updated = store.document?.workflow.nodes.find(n => n.id === loop.id)
    expect(updated?.type === 'loop' && updated.config.body.graph.edges.some(e => e.id === id(64))).toBe(false)
    expect(store.document?.workflow.edges).toEqual(rootEdges)
    expect(updated?.type === 'loop' && updated.config.body.layout).toEqual(loop.config.body.layout)
    store.setMode('flow')
    expect(store.applyWorkflowBranchEdit({ kind: 'loop-body', loopNodeId: loop.id }, intent)).toBe(false)
    store.dispose()
  })
})
