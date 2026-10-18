import { describe, expect, it } from 'vitest'
import { uuidSchema, type TaskNode, type UUID, type WorkflowGraph } from '@odyssey/schemas'

import {
  addBranchCase,
  addNode,
  connectNodes,
  removeBranchCase,
  removeEdge,
  removeNode,
  renameNode,
  reorderBranchCase,
  updateBranchCase,
  updateLoopBody,
  updateLoopDetails,
  updateLoopSettings,
} from './workflowCommands'
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

function task(nodeId: UUID, name = 'Task'): TaskNode {
  return { id: nodeId, type: 'task', name, config: { localVariables: [], steps: [] } }
}

describe('workflow commands', () => {
  it('creates immutable candidates and permits structurally safe disconnected drafts', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const before = structuredClone(graph)
    const result = addNode(graph, task(id(20)))
    expect(result.ok).toBe(true)
    expect(graph).toEqual(before)
    if (!result.ok) return
    expect(result.value).not.toBe(graph)
    expect(result.validation.isStructurallyValid).toBe(true)
    expect(result.validation.isExecutionReady).toBe(false)
  })

  it('protects boundaries and atomically removes ordinary nodes with incident edges', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const start = graph.nodes.find((node) => node.type === 'start')!
    const protectedResult = removeNode(graph, start.id)
    expect(protectedResult).toEqual({ ok: false, error: { code: 'BOUNDARY_NODE_IMMUTABLE', nodeId: start.id } })

    const added = addNode(graph, task(id(20)))
    if (!added.ok) throw new Error('Expected task creation')
    const connected = connectNodes(added.value, { edgeId: id(21), sourceNodeId: start.id, targetNodeId: id(20) })
    if (!connected.ok) throw new Error('Expected connection')
    const removed = removeNode(connected.value, id(20))
    if (!removed.ok) throw new Error('Expected removal')
    expect(removed.value.nodes.some((node) => node.id === id(20))).toBe(false)
    expect(removed.value.edges.some((edge) => edge.sourceNodeId === id(20) || edge.targetNodeId === id(20))).toBe(false)
  })

  it('renames an ordinary node without mutating the source graph', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const added = addNode(graph, task(id(30), 'New Task'))
    if (!added.ok) throw new Error('Expected task creation')
    const before = structuredClone(added.value)
    const renamed = renameNode(added.value, id(30), '  Publish brief  ')
    expect(renamed.ok).toBe(true)
    expect(added.value).toEqual(before)
    if (renamed.ok) expect(renamed.value.nodes.find((node) => node.id === id(30))?.name).toBe('Publish brief')
  })

  it('returns stable errors for invalid connections without changing source graph', () => {
    const startId = id(1)
    const firstId = id(2)
    const secondId = id(3)
    const endId = id(4)
    const graph: WorkflowGraph = {
      schemaVersion: '1.0.0',
      nodes: [
        { id: startId, type: 'start', name: 'Start', config: {} },
        task(firstId, 'First'),
        task(secondId, 'Second'),
        { id: endId, type: 'end', name: 'End', config: {} },
      ],
      edges: [
        { id: id(10), sourceNodeId: startId, targetNodeId: firstId },
        { id: id(11), sourceNodeId: firstId, targetNodeId: secondId },
        { id: id(12), sourceNodeId: secondId, targetNodeId: endId },
      ],
    }
    const before = structuredClone(graph)
    expect(connectNodes(graph, { edgeId: id(20), sourceNodeId: firstId, targetNodeId: firstId })).toEqual({ ok: false, error: { code: 'SELF_EDGE', nodeId: firstId } })
    expect(connectNodes(graph, { edgeId: id(21), sourceNodeId: firstId, targetNodeId: secondId })).toEqual({ ok: false, error: { code: 'DUPLICATE_EDGE', sourceNodeId: firstId, targetNodeId: secondId, sourceHandleId: undefined } })
    expect(connectNodes(graph, { edgeId: id(22), sourceNodeId: secondId, targetNodeId: firstId })).toEqual({ ok: false, error: { code: 'CYCLE_DETECTED', sourceNodeId: secondId, targetNodeId: firstId } })
    expect(graph).toEqual(before)
  })

  it('removing an edge produces a structurally valid but not-ready draft', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const result = removeEdge(graph, graph.edges[0]!.id)
    if (!result.ok) throw new Error('Expected edge removal')
    expect(result.validation.isStructurallyValid).toBe(true)
    expect(result.validation.isExecutionReady).toBe(false)
  })

  it('removes a Branch case and its route atomically', () => {
    const startId = id(1)
    const branchId = id(2)
    const endId = id(3)
    const caseId = id(4)
    const defaultId = id(5)
    const graph: WorkflowGraph = {
      schemaVersion: '1.0.0',
      nodes: [
        { id: startId, type: 'start', name: 'Start', config: {} },
        { id: branchId, type: 'branch', name: 'Branch', config: {
          cases: [{ id: caseId, label: 'Case', match: 'all', conditions: [{ id: id(6), left: { kind: 'literal', value: 1 }, operator: 'eq', right: { kind: 'literal', value: 1 } }] }],
          defaultCase: { id: defaultId, label: 'Default' },
        } },
        { id: endId, type: 'end', name: 'End', config: {} },
      ],
      edges: [
        { id: id(7), sourceNodeId: startId, targetNodeId: branchId },
        { id: id(8), sourceNodeId: branchId, sourceHandleId: caseId, targetNodeId: endId },
        { id: id(9), sourceNodeId: branchId, sourceHandleId: defaultId, targetNodeId: endId },
      ],
    }
    const result = removeBranchCase(graph, branchId, caseId)
    if (!result.ok) throw new Error('Expected case removal')
    const branch = result.value.nodes.find((node) => node.id === branchId)
    expect(branch?.type === 'branch' ? branch.config.cases : null).toEqual([])
    expect(result.value.edges.some((edge) => edge.sourceHandleId === caseId)).toBe(false)
    expect(result.validation.isExecutionReady).toBe(true)
  })

  it('adds, updates, and reorders Branch cases without changing route targets', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const defaultCaseId = id(40)
    const branchId = id(41)
    const addedBranch = addNode(graph, {
      id: branchId,
      type: 'branch',
      name: 'Branch',
      config: { cases: [], defaultCase: { id: defaultCaseId, label: 'Default' } },
    })
    if (!addedBranch.ok) throw new Error('Expected Branch creation')
    const first = { id: id(42), label: 'First', match: 'all' as const, conditions: [{ id: id(43), left: { kind: 'literal' as const, value: 1 }, operator: 'eq' as const, right: { kind: 'literal' as const, value: 1 } }] }
    const second = { id: id(44), label: 'Second', match: 'all' as const, conditions: [{ id: id(45), left: { kind: 'literal' as const, value: 2 }, operator: 'eq' as const, right: { kind: 'literal' as const, value: 2 } }] }
    const withFirst = addBranchCase(addedBranch.value, branchId, first)
    if (!withFirst.ok) throw new Error('Expected first Case')
    const withSecond = addBranchCase(withFirst.value, branchId, second)
    if (!withSecond.ok) throw new Error('Expected second Case')
    const updated = updateBranchCase(withSecond.value, branchId, { ...first, label: 'Updated first' })
    if (!updated.ok) throw new Error('Expected Case update')
    const reordered = reorderBranchCase(updated.value, branchId, second.id, 0)
    if (!reordered.ok) throw new Error('Expected Case reorder')
    const branch = reordered.value.nodes.find((node) => node.id === branchId)
    expect(branch?.type === 'branch' ? branch.config.cases.map((branchCase) => [branchCase.id, branchCase.label]) : []).toEqual([
      [second.id, 'Second'],
      [first.id, 'Updated first'],
    ])
    expect(reordered.value.edges).toEqual(graph.edges)
    expect(reordered.validation.isStructurallyValid).toBe(true)
  })

  it('updates Loop settings and rejects invalid child bodies without modifying the parent', () => {
    const graph = createMinimalAgentWorkflow(ids())
    const loopId = id(60)
    const body = createMinimalLoopBody(ids(61))
    const loopAdded = addNode(graph, {
      id: loopId,
      type: 'loop',
      name: 'Loop',
      config: {
        maxTurns: 3,
        exitCondition: { kind: 'variable_comparison', variableId: id(70), operator: 'gte', value: 1 },
        body: {
          graph: body,
          layout: {
            nodePlacements: body.nodes.map((node, index) => ({ nodeId: node.id, x: index * 200, y: 0 })),
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        },
      },
    })
    if (!loopAdded.ok) throw new Error('Expected Loop creation')
    const settingsUpdated = updateLoopSettings(loopAdded.value, loopId, {
      maxTurns: 5,
      exitCondition: { kind: 'variable_comparison', variableId: id(70), operator: 'eq', value: true },
    })
    if (!settingsUpdated.ok) throw new Error('Expected Loop settings update')
    const loop = settingsUpdated.value.nodes.find((node) => node.id === loopId)
    expect(loop?.type === 'loop' ? loop.config.maxTurns : null).toBe(5)

    const detailsUpdated = updateLoopDetails(settingsUpdated.value, loopId, {
      name: ' Evidence review ',
      maxTurns: 6,
      exitCondition: { kind: 'variable_comparison', variableId: id(70), operator: 'gte', value: 3 },
    })
    expect(detailsUpdated.ok).toBe(true)
    if (!detailsUpdated.ok) throw new Error('Expected Loop details update')
    const detailedLoop = detailsUpdated.value.nodes.find((node) => node.id === loopId)
    expect(detailedLoop?.type === 'loop' ? detailedLoop.name : null).toBe('Evidence review')
    expect(detailedLoop?.type === 'loop' ? detailedLoop.config.body : null).toEqual(loop?.type === 'loop' ? loop.config.body : null)

    const rejectedDetails = updateLoopDetails(detailsUpdated.value, loopId, {
      name: ' ', maxTurns: 6, exitCondition: detailedLoop?.type === 'loop' ? detailedLoop.config.exitCondition : loopAdded.value.nodes.find((node) => node.type === 'loop')!.config.exitCondition,
    })
    expect(rejectedDetails.ok).toBe(false)
    expect(detailsUpdated.value).toEqual(detailsUpdated.value)

    const invalidBody = structuredClone(detailedLoop?.type === 'loop' ? detailedLoop.config.body : null)
    if (!invalidBody) throw new Error('Expected Loop body')
    invalidBody.graph.nodes = invalidBody.graph.nodes.filter((node) => node.type !== 'loop_end')
    const before = structuredClone(detailsUpdated.value)
    const rejected = updateLoopBody(detailsUpdated.value, loopId, invalidBody.graph)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe('INVALID_LOOP_BODY')
    expect(detailsUpdated.value).toEqual(before)
  })
})
