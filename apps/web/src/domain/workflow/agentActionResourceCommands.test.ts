import { describe, expect, it } from 'vitest'
import { uuidSchema, type WorkflowNode } from '@odyssey/schemas'

import { createWorkflowGraphFixture, FIXTURE_IDS } from '@/fixtures'
import { bindAgentActionKnowledgeSpace, bindAgentActionReusableTool, unbindAgentActionKnowledgeSpace, unbindAgentActionReusableTool } from './agentActionResourceCommands'

const AVAILABLE_TOOL_ID = uuidSchema.parse(FIXTURE_IDS.reusableTool)
const MISSING_TOOL_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8997')
const KNOWLEDGE_SPACE_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')

describe('Agent Action resource commands', () => {
  it('binds and unbinds through one immutable command boundary', () => {
    const graph = createWorkflowGraphFixture('research')
    const node = graph.nodes.find((candidate) => candidate.type === 'agent_action')
    if (!node || node.type !== 'agent_action') throw new Error('Expected Agent Action')
    const before = structuredClone(graph)
    const available = new Set([AVAILABLE_TOOL_ID])
    const unbound = unbindAgentActionReusableTool(graph.nodes, available, { nodeId: node.id, reusableToolId: AVAILABLE_TOOL_ID })
    expect(unbound.ok).toBe(true)
    if (!unbound.ok) return
    expect(unbound.value.reusableToolIds).toEqual([])
    const nodes: WorkflowNode[] = graph.nodes.map((candidate) => candidate.id === node.id
      ? { ...node, config: unbound.value }
      : candidate)
    const rebound = bindAgentActionReusableTool(nodes, available, { nodeId: node.id, reusableToolId: AVAILABLE_TOOL_ID })
    expect(rebound.ok).toBe(true)
    if (rebound.ok) expect(rebound.value.reusableToolIds).toEqual([AVAILABLE_TOOL_ID])
    expect(graph).toEqual(before)
  })

  it('returns stable errors for duplicate, missing inventory, wrong target, and missing binding', () => {
    const graph = createWorkflowGraphFixture('research')
    const node = graph.nodes.find((candidate) => candidate.type === 'agent_action')
    const task = graph.nodes.find((candidate) => candidate.type === 'task')
    if (!node || node.type !== 'agent_action' || !task) throw new Error('Expected resource fixture nodes')
    const available = new Set([AVAILABLE_TOOL_ID])
    expect(bindAgentActionReusableTool(graph.nodes, available, { nodeId: node.id, reusableToolId: AVAILABLE_TOOL_ID })).toMatchObject({ ok: false, error: { code: 'RESOURCE_ALREADY_BOUND' } })
    expect(bindAgentActionReusableTool(graph.nodes, available, { nodeId: node.id, reusableToolId: MISSING_TOOL_ID })).toEqual({ ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: MISSING_TOOL_ID } })
    expect(bindAgentActionReusableTool(graph.nodes, available, { nodeId: task.id, reusableToolId: AVAILABLE_TOOL_ID })).toMatchObject({ ok: false, error: { code: 'RESOURCE_TARGET_INVALID' } })
    expect(unbindAgentActionReusableTool(graph.nodes, new Set([MISSING_TOOL_ID]), { nodeId: node.id, reusableToolId: MISSING_TOOL_ID })).toMatchObject({ ok: false, error: { code: 'RESOURCE_NOT_BOUND' } })
  })

  it('binds and unbinds Knowledge Spaces without mutating the graph', () => {
    const graph = createWorkflowGraphFixture('research')
    const node = graph.nodes.find((candidate) => candidate.type === 'agent_action')
    if (!node || node.type !== 'agent_action') throw new Error('Expected Agent Action')
    const before = structuredClone(graph)
    const available = new Set([KNOWLEDGE_SPACE_ID])
    const bound = bindAgentActionKnowledgeSpace(graph.nodes, available, { nodeId: node.id, knowledgeSpaceId: KNOWLEDGE_SPACE_ID })
    expect(bound.ok && bound.value.knowledgeSpaceIds).toContain(KNOWLEDGE_SPACE_ID)
    if (!bound.ok) return
    const nodes: WorkflowNode[] = graph.nodes.map((candidate) => candidate.id === node.id ? { ...node, config: bound.value } : candidate)
    const unbound = unbindAgentActionKnowledgeSpace(nodes, available, { nodeId: node.id, knowledgeSpaceId: KNOWLEDGE_SPACE_ID })
    expect(unbound.ok && unbound.value.knowledgeSpaceIds).not.toContain(KNOWLEDGE_SPACE_ID)
    expect(graph).toEqual(before)
  })
})
