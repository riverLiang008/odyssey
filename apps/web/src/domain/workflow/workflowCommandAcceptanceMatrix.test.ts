import { describe, expect, it } from 'vitest'
import { uuidSchema, type LoopNode, type UUID, type WorkflowGraph } from '@odyssey/schemas'

import {
  addBranchCase,
  addNode,
  connectNodes,
  removeBranchCase,
  removeEdge,
  removeNode,
  reorderBranchCase,
  updateBranchCase,
  updateLoopBody,
  updateLoopSettings,
  updateNodeConfig,
} from './workflowCommands'
import type { WorkflowCommandResult } from './workflowErrors'
import { createMinimalAgentWorkflow, createMinimalLoopBody } from './workflowFactories'
import type { WorkflowIdFactory } from './workflowIdFactory'

function id(value: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${value.toString().padStart(12, '0')}`)
}

function ids(start = 1): WorkflowIdFactory {
  let next = start
  const create = () => id(next++)
  return { nodeId: create, edgeId: create, branchHandleId: create }
}

function expectRejectedAtomic<T>(source: T, before: T, result: WorkflowCommandResult<unknown>, code: string) {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe(code)
  expect(source).toEqual(before)
}

function branchGraph(): { graph: WorkflowGraph; branchId: UUID; caseId: UUID; defaultId: UUID } {
  const startId = id(10)
  const branchId = id(11)
  const endId = id(12)
  const caseId = id(13)
  const defaultId = id(14)
  return {
    branchId,
    caseId,
    defaultId,
    graph: {
      schemaVersion: '1.0.0',
      nodes: [
        { id: startId, type: 'start', name: 'Start', config: {} },
        { id: branchId, type: 'branch', name: 'Branch', config: {
          cases: [{ id: caseId, label: 'Case', match: 'all', conditions: [{ id: id(15), left: { kind: 'literal', value: 1 }, operator: 'eq', right: { kind: 'literal', value: 1 } }] }],
          defaultCase: { id: defaultId, label: 'Default' },
        } },
        { id: endId, type: 'end', name: 'End', config: {} },
      ],
      edges: [
        { id: id(16), sourceNodeId: startId, targetNodeId: branchId },
        { id: id(17), sourceNodeId: branchId, sourceHandleId: caseId, targetNodeId: endId },
        { id: id(18), sourceNodeId: branchId, sourceHandleId: defaultId, targetNodeId: endId },
      ],
    },
  }
}

function graphWithLoop(): { graph: WorkflowGraph; loop: LoopNode } {
  const graph = createMinimalAgentWorkflow(ids(100))
  const body = createMinimalLoopBody(ids(110))
  const loop: LoopNode = {
    id: id(120),
    type: 'loop',
    name: 'Loop',
    config: {
      maxTurns: 3,
      exitCondition: { kind: 'variable_comparison', variableId: id(121), operator: 'gte', value: 1 },
      body: {
        graph: body,
        layout: {
          nodePlacements: body.nodes.map((node, index) => ({ nodeId: node.id, x: index * 160, y: 20 })),
          viewport: { x: 8, y: 9, zoom: 1.25 },
        },
      },
    },
  }
  const result = addNode(graph, loop)
  if (!result.ok) throw new Error('Expected Loop fixture')
  return { graph: result.value, loop }
}

describe('Workflow command acceptance matrix', () => {
  it('covers add/remove/update node success, failure, and rejected atomicity', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const taskId = id(30)
    const added = addNode(graph, { id: taskId, type: 'task', name: 'Task', config: { localVariables: [], steps: [] } })
    if (!added.ok) throw new Error('Expected add success')
    const duplicateBefore = structuredClone(added.value)
    expectRejectedAtomic(added.value, duplicateBefore, addNode(added.value, { id: taskId, type: 'task', name: 'Duplicate', config: { localVariables: [], steps: [] } }), 'NODE_ID_CONFLICT')

    const updated = updateNodeConfig(added.value, { nodeId: taskId, nodeType: 'task', config: { localVariables: [], steps: [] } })
    expect(updated.ok).toBe(true)
    const wrongTypeBefore = structuredClone(added.value)
    expectRejectedAtomic(added.value, wrongTypeBefore, updateNodeConfig(added.value, { nodeId: taskId, nodeType: 'branch', config: { cases: [], defaultCase: { id: id(31), label: 'Default' } } }), 'INVALID_NODE_CONFIG')

    const removed = removeNode(added.value, taskId)
    expect(removed.ok).toBe(true)
    const missingBefore = structuredClone(graph)
    expectRejectedAtomic(graph, missingBefore, removeNode(graph, id(999)), 'NODE_NOT_FOUND')
  })

  it('covers removeEdge success and missing-edge atomicity', () => {
    const graph = createMinimalAgentWorkflow(ids())
    expect(removeEdge(graph, graph.edges[0]!.id).ok).toBe(true)
    const before = structuredClone(graph)
    expectRejectedAtomic(graph, before, removeEdge(graph, id(999)), 'EDGE_NOT_FOUND')
  })

  it('covers every connectNodes precondition with stable errors and immutable input', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const start = graph.nodes.find((node) => node.type === 'start')!
    const end = graph.nodes.find((node) => node.type === 'end')!
    const taskId = id(40)
    const withTask = addNode(graph, { id: taskId, type: 'task', name: 'Task', config: { localVariables: [], steps: [] } })
    if (!withTask.ok) throw new Error('Expected task')
    const cases = [
      { code: 'MISSING_ENDPOINT', intent: { edgeId: id(50), sourceNodeId: id(998), targetNodeId: end.id } },
      { code: 'MISSING_ENDPOINT', intent: { edgeId: id(51), sourceNodeId: start.id, targetNodeId: id(997) } },
      { code: 'SELF_EDGE', intent: { edgeId: id(52), sourceNodeId: taskId, targetNodeId: taskId } },
      { code: 'INVALID_EDGE_DIRECTION', intent: { edgeId: id(53), sourceNodeId: end.id, targetNodeId: taskId } },
      { code: 'HANDLE_NOT_ALLOWED', intent: { edgeId: id(54), sourceNodeId: start.id, sourceHandleId: id(996), targetNodeId: taskId } },
      { code: 'DUPLICATE_EDGE', intent: { edgeId: id(55), sourceNodeId: start.id, targetNodeId: end.id } },
      { code: 'EDGE_ID_CONFLICT', intent: { edgeId: graph.edges[0]!.id, sourceNodeId: start.id, targetNodeId: taskId } },
    ] as const
    for (const entry of cases) {
      const before = structuredClone(withTask.value)
      expectRejectedAtomic(withTask.value, before, connectNodes(withTask.value, entry.intent), entry.code)
    }

    const branchFixture = branchGraph()
    const branch = branchFixture.graph.nodes.find((node) => node.id === branchFixture.branchId)!
    const branchCases = [
      { code: 'HANDLE_REQUIRED', intent: { edgeId: id(60), sourceNodeId: branch.id, targetNodeId: id(12) } },
      { code: 'HANDLE_NOT_FOUND', intent: { edgeId: id(61), sourceNodeId: branch.id, sourceHandleId: id(995), targetNodeId: id(12) } },
      { code: 'HANDLE_ALREADY_CONNECTED', intent: { edgeId: id(62), sourceNodeId: branch.id, sourceHandleId: branchFixture.caseId, targetNodeId: id(12) } },
    ] as const
    for (const entry of branchCases) {
      const before = structuredClone(branchFixture.graph)
      expectRejectedAtomic(branchFixture.graph, before, connectNodes(branchFixture.graph, entry.intent), entry.code)
    }
  })

  it('covers all Branch compound command rejection paths atomically', () => {
    const fixture = branchGraph()
    const duplicateCase = { id: fixture.defaultId, label: 'Duplicate', match: 'all' as const, conditions: [{ id: id(70), left: { kind: 'literal' as const, value: 1 }, operator: 'eq' as const, right: { kind: 'literal' as const, value: 1 } }] }
    const operations = [
      { code: 'NODE_ID_CONFLICT', run: () => addBranchCase(fixture.graph, fixture.branchId, duplicateCase) },
      { code: 'HANDLE_NOT_FOUND', run: () => removeBranchCase(fixture.graph, fixture.branchId, id(991)) },
      { code: 'HANDLE_NOT_FOUND', run: () => updateBranchCase(fixture.graph, fixture.branchId, { ...duplicateCase, id: id(990) }) },
      { code: 'INVALID_NODE_CONFIG', run: () => reorderBranchCase(fixture.graph, fixture.branchId, fixture.caseId, 99) },
    ] as const
    for (const operation of operations) {
      const before = structuredClone(fixture.graph)
      expectRejectedAtomic(fixture.graph, before, operation.run(), operation.code)
    }
  })

  it('updates Loop graph and settings while preserving nested layout, with atomic failures', () => {
    const fixture = graphWithLoop()
    const layoutBefore = structuredClone(fixture.loop.config.body.layout)
    const childGraph = structuredClone(fixture.loop.config.body.graph)
    childGraph.nodes.push({ id: id(130), type: 'task', name: 'Draft child', config: { localVariables: [], steps: [] } })
    const bodyUpdated = updateLoopBody(fixture.graph, fixture.loop.id, childGraph)
    if (!bodyUpdated.ok) throw new Error('Expected Loop body graph update')
    const updatedLoop = bodyUpdated.value.nodes.find((node) => node.id === fixture.loop.id)
    expect(updatedLoop?.type === 'loop' ? updatedLoop.config.body.layout : null).toEqual(layoutBefore)
    expect(updatedLoop?.type === 'loop' ? updatedLoop.config.body.graph : null).toEqual(childGraph)

    const settingsUpdated = updateLoopSettings(fixture.graph, fixture.loop.id, {
      maxTurns: 4,
      exitCondition: fixture.loop.config.exitCondition,
    })
    expect(settingsUpdated.ok).toBe(true)
    const missingBefore = structuredClone(fixture.graph)
    expectRejectedAtomic(fixture.graph, missingBefore, updateLoopSettings(fixture.graph, id(989), { maxTurns: 4, exitCondition: fixture.loop.config.exitCondition }), 'NODE_NOT_FOUND')
    const invalidBefore = structuredClone(fixture.graph)
    expectRejectedAtomic(fixture.graph, invalidBefore, updateLoopSettings(fixture.graph, fixture.loop.id, { maxTurns: 0, exitCondition: fixture.loop.config.exitCondition }), 'INVALID_NODE_CONFIG')

    const invalidChild = structuredClone(childGraph)
    invalidChild.nodes = invalidChild.nodes.filter((node) => node.type !== 'loop_end')
    const childBefore = structuredClone(fixture.graph)
    expectRejectedAtomic(fixture.graph, childBefore, updateLoopBody(fixture.graph, fixture.loop.id, invalidChild), 'INVALID_LOOP_BODY')
  })
})

