import { describe, expect, it } from 'vitest'
import { uuidSchema, type LoopBodyGraph, type UUID } from '@odyssey/schemas'

import {
  addLoopBodyNode,
  connectLoopBodyNodes,
  removeLoopBodyEdge,
  removeLoopBodyNode,
} from './loopBodyCommands'
import type { WorkflowCommandResult } from './workflowErrors'
import { createMinimalLoopBody } from './workflowFactories'
import type { WorkflowIdFactory } from './workflowIdFactory'
import { validateWorkflowGraph } from './workflowValidation'

function id(value: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${value.toString().padStart(12, '0')}`)
}

function ids(start = 1): WorkflowIdFactory {
  let next = start
  const create = () => id(next++)
  return { nodeId: create, edgeId: create, branchHandleId: create }
}

function expectRejectedAtomic<T>(source: T, result: WorkflowCommandResult<unknown>, code: string) {
  const before = structuredClone(source)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe(code)
  expect(source).toEqual(before)
}

function branchBody(): { graph: LoopBodyGraph; branchId: UUID; caseId: UUID; defaultId: UUID } {
  const startId = id(600)
  const branchId = id(601)
  const endId = id(602)
  const caseId = id(603)
  const defaultId = id(604)
  return {
    branchId,
    caseId,
    defaultId,
    graph: {
      nodes: [
        { id: startId, type: 'loop_start', name: 'Loop Start', config: {} },
        { id: branchId, type: 'branch', name: 'Branch', config: {
          cases: [{ id: caseId, label: 'Case', match: 'all', conditions: [{ id: id(605), left: { kind: 'literal', value: 1 }, operator: 'eq', right: { kind: 'literal', value: 1 } }] }],
          defaultCase: { id: defaultId, label: 'Default' },
        } },
        { id: endId, type: 'loop_end', name: 'Loop End', config: {} },
      ],
      edges: [
        { id: id(606), sourceNodeId: startId, targetNodeId: branchId },
        { id: id(607), sourceNodeId: branchId, sourceHandleId: caseId, targetNodeId: endId },
        { id: id(608), sourceNodeId: branchId, sourceHandleId: defaultId, targetNodeId: endId },
      ],
    },
  }
}

describe('Loop body commands', () => {
  it('keeps a deterministic child command sequence acyclic and preserves rejected-command atomicity', () => {
    const loopNodeId = id(900)
    let graph = createMinimalLoopBody(ids())
    const loopStart = graph.nodes.find((node) => node.type === 'loop_start')!
    const loopEnd = graph.nodes.find((node) => node.type === 'loop_end')!
    const withoutDefault = removeLoopBodyEdge(graph, loopNodeId, graph.edges[0]!.id)
    if (!withoutDefault.ok) throw new Error('Expected default removal')
    graph = withoutDefault.value
    const taskIds = Array.from({ length: 12 }, (_, index) => id(100 + index))
    for (const [index, taskId] of taskIds.entries()) {
      const added = addLoopBodyNode(graph, loopNodeId, {
        id: taskId,
        type: 'task',
        name: `Loop task ${index + 1}`,
        config: { localVariables: [], steps: [] },
      })
      if (!added.ok) throw new Error('Expected Loop child add')
      graph = added.value
    }
    const path = [loopStart.id, ...taskIds, loopEnd.id]
    for (let index = 0; index < path.length - 1; index += 1) {
      const connected = connectLoopBodyNodes(graph, loopNodeId, {
        edgeId: id(300 + index),
        sourceNodeId: path[index]!,
        targetNodeId: path[index + 1]!,
      })
      if (!connected.ok) throw new Error('Expected Loop child connection')
      graph = connected.value
      expect(connected.validation.isStructurallyValid).toBe(true)
    }
    expect(validateWorkflowGraph(graph, { kind: 'loop-body', loopNodeId }).isExecutionReady).toBe(true)

    const before = structuredClone(graph)
    const rejected = connectLoopBodyNodes(graph, loopNodeId, {
      edgeId: id(500),
      sourceNodeId: taskIds[8]!,
      targetNodeId: taskIds[2]!,
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe('CYCLE_DETECTED')
    expect(graph).toEqual(before)
  })

  it('covers add/remove node success, failure, boundary protection, and atomicity', () => {
    const loopNodeId = id(900)
    const graph = createMinimalLoopBody(ids())
    const taskId = id(700)
    const added = addLoopBodyNode(graph, loopNodeId, {
      id: taskId,
      type: 'task',
      name: 'Task',
      config: { localVariables: [], steps: [] },
    })
    if (!added.ok) throw new Error('Expected add success')
    expectRejectedAtomic(added.value, addLoopBodyNode(added.value, loopNodeId, {
      id: taskId,
      type: 'task',
      name: 'Duplicate',
      config: { localVariables: [], steps: [] },
    }), 'NODE_ID_CONFLICT')

    const start = graph.nodes.find((node) => node.type === 'loop_start')!
    expectRejectedAtomic(graph, removeLoopBodyNode(graph, loopNodeId, start.id), 'BOUNDARY_NODE_IMMUTABLE')
    expectRejectedAtomic(graph, removeLoopBodyNode(graph, loopNodeId, id(999)), 'NODE_NOT_FOUND')
    const removed = removeLoopBodyNode(added.value, loopNodeId, taskId)
    expect(removed.ok).toBe(true)
    if (removed.ok) expect(removed.value.nodes.some((node) => node.id === taskId)).toBe(false)
  })

  it('covers remove edge success, missing edge, and atomicity', () => {
    const loopNodeId = id(900)
    const graph = createMinimalLoopBody(ids())
    expect(removeLoopBodyEdge(graph, loopNodeId, graph.edges[0]!.id).ok).toBe(true)
    expectRejectedAtomic(graph, removeLoopBodyEdge(graph, loopNodeId, id(999)), 'EDGE_NOT_FOUND')
  })

  it('covers child connection endpoints, direction, identity, duplicate, and non-Branch handle errors', () => {
    const loopNodeId = id(900)
    const graph = createMinimalLoopBody(ids())
    const start = graph.nodes.find((node) => node.type === 'loop_start')!
    const end = graph.nodes.find((node) => node.type === 'loop_end')!
    const taskId = id(710)
    const withTask = addLoopBodyNode(graph, loopNodeId, {
      id: taskId,
      type: 'task',
      name: 'Task',
      config: { localVariables: [], steps: [] },
    })
    if (!withTask.ok) throw new Error('Expected child task')
    const cases = [
      { code: 'MISSING_ENDPOINT', intent: { edgeId: id(720), sourceNodeId: id(998), targetNodeId: end.id } },
      { code: 'MISSING_ENDPOINT', intent: { edgeId: id(721), sourceNodeId: start.id, targetNodeId: id(997) } },
      { code: 'SELF_EDGE', intent: { edgeId: id(722), sourceNodeId: taskId, targetNodeId: taskId } },
      { code: 'INVALID_EDGE_DIRECTION', intent: { edgeId: id(723), sourceNodeId: end.id, targetNodeId: taskId } },
      { code: 'HANDLE_NOT_ALLOWED', intent: { edgeId: id(724), sourceNodeId: start.id, sourceHandleId: id(996), targetNodeId: taskId } },
      { code: 'DUPLICATE_EDGE', intent: { edgeId: id(725), sourceNodeId: start.id, targetNodeId: end.id } },
      { code: 'EDGE_ID_CONFLICT', intent: { edgeId: graph.edges[0]!.id, sourceNodeId: start.id, targetNodeId: taskId } },
    ] as const
    for (const entry of cases) {
      expectRejectedAtomic(withTask.value, connectLoopBodyNodes(withTask.value, loopNodeId, entry.intent), entry.code)
    }
  })

  it('covers child Branch handle required, ownership, cardinality, and atomicity', () => {
    const loopNodeId = id(900)
    const fixture = branchBody()
    const endId = fixture.graph.nodes.find((node) => node.type === 'loop_end')!.id
    const cases = [
      { code: 'HANDLE_REQUIRED', intent: { edgeId: id(730), sourceNodeId: fixture.branchId, targetNodeId: endId } },
      { code: 'HANDLE_NOT_FOUND', intent: { edgeId: id(731), sourceNodeId: fixture.branchId, sourceHandleId: id(995), targetNodeId: endId } },
      { code: 'HANDLE_ALREADY_CONNECTED', intent: { edgeId: id(732), sourceNodeId: fixture.branchId, sourceHandleId: fixture.caseId, targetNodeId: endId } },
    ] as const
    for (const entry of cases) {
      expectRejectedAtomic(fixture.graph, connectLoopBodyNodes(fixture.graph, loopNodeId, entry.intent), entry.code)
    }
  })
})
