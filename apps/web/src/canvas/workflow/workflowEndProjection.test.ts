import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures/editorFixtures'
import { instantiatePattern } from '@/domain/pattern'
import { reconcileWorkflowEnds } from '@/domain/workflow/workflowEndRouting'
import { connectNodes } from '@/domain/workflow/workflowCommands'
import { projectWorkflowCanvas } from './workflowCanvasAdapter'
import { connectionToIntent } from './workflowCanvasIntents'

describe('Pattern-owned End Canvas projection', () => {
  it('projects read-only target labels and round-trips internal connection intents without external edges', () => {
    let sequence = 0
    const id = () => uuidSchema.parse(`10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`)
    const pattern = instantiatePattern('hub_and_spoke', { patternId: id, routeId: id, slotId: id })
    const agent = createAgentWorkflowEditorDocumentFixture('minimal')
    const journey = createJourneyEditorDocumentFixture()
    pattern.slots[0]!.agentId = agent.agent.id
    journey.pattern = pattern
    const routed = reconcileWorkflowEnds(agent.workflow, agent.layout, pattern, pattern.slots[0]!.id, { nodeId: id })
    const before = structuredClone(routed.graph)
    const canvas = projectWorkflowCanvas(routed.graph, routed.layout, 'flow', journey)
    const ends = canvas.nodes.filter((node) => node.data?.node.type === 'end')
    expect(ends.map((node) => node.data?.boundaryLabel)).toEqual([
      'Handoff → Agent-2 (not configured)', 'Handoff → Agent-3 (not configured)',
      'Handoff → Agent-4 (not configured)', 'Handoff → Agent-5 (not configured)',
    ])
    expect(ends.every((node) => node.deletable === false)).toBe(true)
    expect(canvas.edges).toEqual([])
    expect(routed.graph).toEqual(before)
    const start = routed.graph.nodes.find((node) => node.type === 'start')!
    const intent = connectionToIntent({ source: start.id, target: ends[0]!.id, sourceHandle: null, targetHandle: null }, id())
    if (!intent) throw new Error('Valid boundary connection was rejected')
    const connected = connectNodes(routed.graph, intent)
    expect(connected.ok).toBe(true)
    if (!connected.ok) return
    expect(projectWorkflowCanvas(connected.value, routed.layout, 'flow', journey).edges).toHaveLength(1)
    expect(connected.value.edges[0]?.targetNodeId).toBe(ends[0]!.id)
  })
})
