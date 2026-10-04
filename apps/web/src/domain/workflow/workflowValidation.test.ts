import { describe, expect, it } from 'vitest'
import { uuidSchema, type UUID, type WorkflowGraph } from '@odyssey/schemas'

import { createMinimalAgentWorkflow, createMinimalLoopBody } from './workflowFactories'
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

describe('workflow validation', () => {
  it('accepts minimum Agent and Loop graphs as execution ready', () => {
    expect(validateWorkflowGraph(createMinimalAgentWorkflow(ids())).isExecutionReady).toBe(true)
    const loop = createMinimalLoopBody(ids(20))
    expect(validateWorkflowGraph(loop, { kind: 'loop-body', loopNodeId: id(19) }).isExecutionReady).toBe(true)
  })

  it('separates structurally safe drafts from execution readiness', () => {
    const graph = createMinimalAgentWorkflow(ids())
    graph.nodes.push({ id: id(20), type: 'task', name: 'Draft task', config: { localVariables: [], steps: [] } })
    const report = validateWorkflowGraph(graph)
    expect(report.isStructurallyValid).toBe(true)
    expect(report.isExecutionReady).toBe(false)
    expect(report.readinessErrors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'UNREACHABLE_FROM_START',
      'CANNOT_REACH_END',
    ]))
  })

  it('rejects cycles, duplicate semantic edges and invalid Branch handles structurally', () => {
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
        { id: id(9), sourceNodeId: branchId, sourceHandleId: caseId, targetNodeId: endId },
        { id: id(10), sourceNodeId: branchId, sourceHandleId: id(99), targetNodeId: startId },
      ],
    }
    const report = validateWorkflowGraph(graph)
    expect(report.isStructurallyValid).toBe(false)
    expect(report.structuralErrors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'DUPLICATE_EDGE',
      'BRANCH_ROUTE_DUPLICATE',
      'INVALID_SOURCE_HANDLE',
      'START_HAS_INCOMING',
      'CYCLE_DETECTED',
    ]))
  })

  it('reports incomplete Branch routes only as readiness diagnostics', () => {
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
          cases: [{ id: caseId, label: 'Case', match: 'all', conditions: [{ id: id(6), left: { kind: 'literal', value: true }, operator: 'eq', right: { kind: 'literal', value: true } }] }],
          defaultCase: { id: defaultId, label: 'Default' },
        } },
        { id: endId, type: 'end', name: 'End', config: {} },
      ],
      edges: [
        { id: id(7), sourceNodeId: startId, targetNodeId: branchId },
        { id: id(8), sourceNodeId: branchId, sourceHandleId: defaultId, targetNodeId: endId },
      ],
    }
    const report = validateWorkflowGraph(graph)
    expect(report.isStructurallyValid).toBe(true)
    expect(report.isExecutionReady).toBe(false)
    expect(report.readinessErrors).toContainEqual(expect.objectContaining({ code: 'BRANCH_ROUTE_INCOMPLETE', sourceHandleId: caseId }))
  })
})

