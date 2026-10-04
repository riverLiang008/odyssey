import {
  workflowGraphSchema,
  type LoopBodyGraph,
  type WorkflowGraph,
} from '@odyssey/schemas'

import type { WorkflowCommandResult } from './workflowErrors'
import type { WorkflowIdFactory } from './workflowIdFactory'
import { validateWorkflowGraph } from './workflowValidation'

export function createMinimalAgentWorkflow(idFactory: Pick<WorkflowIdFactory, 'nodeId' | 'edgeId'>): WorkflowGraph {
  const startId = idFactory.nodeId()
  const endId = idFactory.nodeId()
  return workflowGraphSchema.parse({
    schemaVersion: '1.0.0',
    nodes: [
      { id: startId, type: 'start', name: 'Start', config: {} },
      { id: endId, type: 'end', name: 'End', config: {} },
    ],
    edges: [{ id: idFactory.edgeId(), sourceNodeId: startId, targetNodeId: endId }],
  })
}

export function createMinimalLoopBody(idFactory: Pick<WorkflowIdFactory, 'nodeId' | 'edgeId'>): LoopBodyGraph {
  const startId = idFactory.nodeId()
  const endId = idFactory.nodeId()
  return {
    nodes: [
      { id: startId, type: 'loop_start', name: 'Loop Start', config: {} },
      { id: endId, type: 'loop_end', name: 'Loop End', config: {} },
    ],
    edges: [{ id: idFactory.edgeId(), sourceNodeId: startId, targetNodeId: endId }],
  }
}

export function validateMinimalAgentWorkflow(graph: WorkflowGraph): WorkflowCommandResult<WorkflowGraph> {
  const validation = validateWorkflowGraph(graph)
  return validation.isStructurallyValid
    ? { ok: true, value: structuredClone(graph), validation }
    : { ok: false, error: { code: 'INVALID_SOURCE_GRAPH', issues: validation.structuralErrors } }
}

