import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { createWorkflowGraphFixture, FIXTURE_IDS } from '@/fixtures'

import {
  evaluateWorkflowResourceDrop,
  parseWorkflowResourceDragPayload,
  serializeWorkflowResourceDragPayload,
} from './workflowCanvasIntents'

describe('workflow resource drag payload', () => {
  it('round-trips a reusable Tool identity through a namespaced payload', () => {
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998')
    expect(parseWorkflowResourceDragPayload(serializeWorkflowResourceDragPayload(resourceId))).toEqual({
      kind: 'reusable-tool',
      resourceId,
    })
  })

  it('round-trips a Knowledge Space identity and preflights the dedicated target', () => {
    const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
    const payload = parseWorkflowResourceDragPayload(serializeWorkflowResourceDragPayload(resourceId, 'knowledge-space'))
    expect(payload).toEqual({ kind: 'knowledge-space', resourceId })
    const node = createWorkflowGraphFixture('research').nodes.find((candidate) => candidate.type === 'agent_action')
    if (!node || node.type !== 'agent_action' || !payload) throw new Error('Expected Agent Action')
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-knowledge-spaces', nodeId: node.id }, {
      node,
      availableReusableToolIds: new Set(),
      availableKnowledgeSpaceIds: new Set([resourceId]),
    })).toEqual({ status: 'valid', action: { type: 'bind-knowledge-space', nodeId: node.id, knowledgeSpaceId: resourceId } })
  })

  it('rejects unrelated and malformed payloads', () => {
    expect(parseWorkflowResourceDragPayload('task')).toBeNull()
    expect(parseWorkflowResourceDragPayload('{"kind":"reusable-tool","resourceId":"not-a-uuid"}')).toBeNull()
  })

  it('preflights target compatibility, inventory, and duplicates before mutation', () => {
    const graph = createWorkflowGraphFixture('research')
    const node = graph.nodes.find((candidate) => candidate.type === 'agent_action')
    if (!node || node.type !== 'agent_action') throw new Error('Expected Agent Action')
    const resourceId = uuidSchema.parse(FIXTURE_IDS.reusableTool)
    const payload = { kind: 'reusable-tool' as const, resourceId }
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'canvas-pane' }, { node: null, availableReusableToolIds: new Set() })).toEqual({ status: 'invalid', reason: 'INVALID_RESOURCE_TARGET' })
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-knowledge-spaces', nodeId: node.id }, { node, availableReusableToolIds: new Set([resourceId]) })).toEqual({ status: 'invalid', reason: 'WRONG_RESOURCE_TYPE' })
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-tools', nodeId: node.id }, { node, availableReusableToolIds: new Set() })).toEqual({ status: 'unavailable', reason: 'RESOURCE_NOT_AVAILABLE' })
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-tools', nodeId: node.id }, { node, availableReusableToolIds: new Set([resourceId]) })).toEqual({ status: 'duplicate', reason: 'RESOURCE_ALREADY_BOUND' })
    const unboundNode = { ...node, config: { ...node.config, reusableToolIds: [] } }
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-tools', nodeId: node.id }, { node: unboundNode, availableReusableToolIds: new Set([resourceId]) })).toEqual({ status: 'valid', action: { type: 'bind-reusable-tool', nodeId: node.id, reusableToolId: resourceId } })
  })

  it('treats a Task sequence as a distinct Tool insertion target', () => {
    const nodeId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-000000000901')
    const resourceId = uuidSchema.parse(FIXTURE_IDS.reusableTool)
    const node = { id: nodeId, type: 'task' as const }
    const payload = { kind: 'reusable-tool' as const, resourceId }
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'task-tool-sequence', nodeId }, { node, availableReusableToolIds: new Set([resourceId]) }))
      .toEqual({ status: 'valid', action: { type: 'append-task-tool-step', nodeId, reusableToolId: resourceId } })
    expect(evaluateWorkflowResourceDrop({ kind: 'knowledge-space', resourceId }, { kind: 'task-tool-sequence', nodeId }, { node, availableReusableToolIds: new Set([resourceId]) }))
      .toEqual({ status: 'invalid', reason: 'WRONG_RESOURCE_TYPE' })
  })

  it('opens System Tool configuration for an Agent Action Toolbox without binding a Definition ID', () => {
    const graph = createWorkflowGraphFixture('research')
    const node = graph.nodes.find((candidate) => candidate.type === 'agent_action')
    if (!node || node.type !== 'agent_action') throw new Error('Expected Agent Action')
    const definitionId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-000000000950')
    const definition = { id: definitionId, kind: 'script_execution' as const, source: 'built_in' as const, name: 'Script Execution', category: 'Computation', description: null, configurationSchema: {}, inputSchema: {}, outputSchema: {} }
    expect(evaluateWorkflowResourceDrop(
      { kind: 'system-tool-definition', toolDefinitionId: definition.id, toolKind: definition.kind },
      { kind: 'agent-action-tools', nodeId: node.id },
      { node, mode: 'configure', systemTools: [definition], availableReusableToolIds: new Set() },
    )).toEqual({ status: 'valid', action: { type: 'configure-system-tool', nodeId: node.id, toolDefinitionId: definition.id, toolKind: definition.kind } })
  })
})
