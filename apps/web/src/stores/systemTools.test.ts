import fixtures from '../../../../packages/schemas/fixtures/system-tools.json'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { toolStepSchema, uuidSchema, type SystemToolDefinition, type TaskNode } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import { useWorkflowEditorStore } from './workflowEditor'
const id = (n: number) => uuidSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const definition: SystemToolDefinition = { id: id(50), kind: 'script_execution', source: 'built_in', name: 'Script', category: 'Computation', description: 'Code', configurationSchema: {}, inputSchema: {}, outputSchema: {} }
async function setup() {
  const doc = createAgentWorkflowEditorDocumentFixture('loop')
  const rootTask: TaskNode = { id: id(1), name: 'Root', type: 'task', config: { steps: [], localVariables: [{ id: id(2), key: 'output', dataType: 'json', defaultValue: null }] } }
  doc.workflow.nodes.push(rootTask)
  doc.layout.nodePlacements.push({ nodeId: rootTask.id, x: 250, y: 300 })
  const loop = doc.workflow.nodes.find((n) => n.type === 'loop')
  if (!loop || loop.type !== 'loop') throw new Error('Missing Loop')
  const task = loop.config.body.graph.nodes.find((n) => n.type === 'task')
  if (!task || task.type !== 'task') throw new Error('Missing Task')
  task.config = { localVariables: [{ id: id(3), key: 'child_output', dataType: 'json', defaultValue: null }], steps: [] }
  const repo = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [doc] })
  repo.listSystemToolDefinitions = async () => ({ ok: true, value: fixtures.valid.map((s) => ({ ...definition, id: uuidSchema.parse(s.id), kind: toolStepSchema.parse(s).kind })).concat(definition) })
  repo.listKnowledgeSpaces = async () => ({ ok: true, value: { page: 1, pageSize: 100, total: 1, items: [{ id: id(10), name: 'Test Knowledge', description: null, knowledgeSpaceCategoryId: id(11), lifecycleStatus: 'ready', graphStatus: 'healthy', updatedAt: '2026-10-04T00:00:00Z' }] } })
  const store = useWorkflowEditorStore()
  await store.load(doc.agent.journeyId, doc.agent.id, repo)
  return { store, repo, doc, loop, task, rootTask }
}
const step = (target = id(2)) => toolStepSchema.parse({ id: id(100), kind: 'script_execution', configuration: { language: 'python', script: 'result = 1' }, outputMapping: { sourceKey: 'result', targetVariableId: target }, failureBehavior: { kind: 'fail_task' } })
describe('System Tool editor transactions', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('cancel leaves document and mutation sequence unchanged; save is atomic and refresh restores configuration', async () => {
    const { store, repo, doc, rootTask } = await setup()
    const before = store.toSaveInput()
    expect(store.openSystemTool({ kind: 'root' }, rootTask.id, definition.id)).toBe(true)
    store.cancelSystemTool()
    expect(store.toSaveInput()).toEqual(before)
    expect(store.persistence.mutationSeq).toBe(0)
    store.openSystemTool({ kind: 'root' }, rootTask.id, definition.id)
    expect(store.saveSystemTool(step())).toBe(true)
    expect(store.persistence.mutationSeq).toBe(1)
    expect(store.systemToolDraft).toBeNull()
    expect(await store.save()).toBe(true)
    await store.load(doc.agent.journeyId, doc.agent.id, repo)
    expect(store.toolTask({ kind: 'root' }, rootTask.id)?.config.steps).toEqual([step()])
    expect(JSON.stringify(store.toSaveInput())).not.toMatch(/selected|dragging|computedPosition|dimensions/)
    store.dispose()
  })
  it('round trips all five Tool kinds in order, including edit, reorder and delete', async () => {
    const { store, repo, doc, rootTask } = await setup()
    const root = { kind: 'root' as const }
    const steps = fixtures.valid.map((input) => toolStepSchema.parse(input))
    for (const candidate of steps) {
      expect(store.openSystemTool(root, rootTask.id, candidate.id)).toBe(true)
      expect(store.saveSystemTool(candidate)).toBe(true)
    }
    expect(store.persistence.mutationSeq).toBe(5)
    await store.save()
    await store.load(doc.agent.journeyId, doc.agent.id, repo)
    expect(store.toolTask(root, rootTask.id)?.config.steps).toEqual(steps)
    const first = steps[0]
    if (!first) throw new Error('Missing fixture')
    store.editSystemTool(root, rootTask.id, first.id)
    expect(store.saveSystemTool({ ...first, label: 'Edited' })).toBe(true)
    expect(store.changeSystemTool(root, rootTask.id, { type: 'move', stepId: first.id, direction: 1 })).toBe(true)
    expect(store.changeSystemTool(root, rootTask.id, { type: 'delete', stepId: first.id })).toBe(true)
    await store.save()
    await store.load(doc.agent.journeyId, doc.agent.id, repo)
    expect(store.toolTask(root, rootTask.id)?.config.steps).toEqual(steps.slice(1))
    store.dispose()
  })
  it('isolates root and nested Task variables, rejects Flow and invalid operations without sequence changes', async () => {
    const { store, loop, task, rootTask } = await setup()
    const child = { kind: 'loop-body' as const, loopNodeId: loop.id }
    store.openSystemTool(child, task.id, definition.id)
    expect(store.saveSystemTool(step())).toBe(false)
    expect(store.persistence.mutationSeq).toBe(0)
    expect(store.saveSystemTool(step(id(3)))).toBe(true)
    expect(store.toolTask({ kind: 'root' }, rootTask.id)?.config.steps).toEqual([])
    expect(store.toolTask(child, task.id)?.config.steps).toHaveLength(1)
    const seq = store.persistence.mutationSeq
    expect(store.changeSystemTool(child, task.id, { type: 'move', stepId: id(100), direction: -1 })).toBe(false)
    expect(store.persistence.mutationSeq).toBe(seq)
    store.setMode('flow')
    expect(store.changeSystemTool(child, task.id, { type: 'delete', stepId: id(100) })).toBe(false)
    expect(store.openSystemTool(child, task.id, definition.id)).toBe(false)
    expect(store.persistence.mutationSeq).toBe(seq)
    store.dispose()
  })
})
