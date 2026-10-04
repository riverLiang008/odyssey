import { describe, expect, it } from 'vitest'
import { uuidSchema, type UUID } from '@odyssey/schemas'

import { addNode, connectNodes, removeEdge } from './workflowCommands'
import { createMinimalAgentWorkflow } from './workflowFactories'
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

describe('workflow invariant sequences', () => {
  it('keeps every successful step structurally valid and every rejected back-edge atomic', () => {
    let graph = createMinimalAgentWorkflow(ids())
    const start = graph.nodes.find((node) => node.type === 'start')!
    const end = graph.nodes.find((node) => node.type === 'end')!
    const removedDefault = removeEdge(graph, graph.edges[0]!.id)
    if (!removedDefault.ok) throw new Error('Expected default edge removal')
    graph = removedDefault.value

    const taskIds = Array.from({ length: 24 }, (_, index) => id(100 + index))
    for (const [index, taskId] of taskIds.entries()) {
      const added = addNode(graph, { id: taskId, type: 'task', name: `Task ${index + 1}`, config: { localVariables: [], steps: [] } })
      if (!added.ok) throw new Error(`Expected add at ${index}`)
      graph = added.value
      expect(validateWorkflowGraph(graph).isStructurallyValid).toBe(true)
    }

    const path = [start.id, ...taskIds, end.id]
    for (let index = 0; index < path.length - 1; index += 1) {
      const sourceNodeId = path[index]!
      const targetNodeId = path[index + 1]!
      const connected = connectNodes(graph, { edgeId: id(300 + index), sourceNodeId, targetNodeId })
      if (!connected.ok) throw new Error(`Expected connect at ${index}`)
      graph = connected.value
      expect(connected.validation.isStructurallyValid).toBe(true)
    }
    expect(validateWorkflowGraph(graph).isExecutionReady).toBe(true)

    for (let index = 2; index < taskIds.length; index += 3) {
      const before = structuredClone(graph)
      const rejected = connectNodes(graph, {
        edgeId: id(500 + index),
        sourceNodeId: taskIds[index]!,
        targetNodeId: taskIds[index - 2]!,
      })
      expect(rejected.ok).toBe(false)
      if (!rejected.ok) expect(rejected.error.code).toBe('CYCLE_DETECTED')
      expect(graph).toEqual(before)
    }
  })
})

