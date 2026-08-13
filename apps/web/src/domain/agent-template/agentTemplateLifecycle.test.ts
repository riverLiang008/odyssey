import { uuidSchema, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import type { AgentLifecycleIdFactory } from './agentTemplateLifecycle'
import { createMinimalAgent, instantiateAgentTemplate, saveAgentAsTemplate } from './agentTemplateLifecycle'

function factory(start = 40000): AgentLifecycleIdFactory {
  let sequence = start
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return {
    agentId: next, agentTemplateId: next, workflowNodeId: next, workflowEdgeId: next,
    branchHandleId: next, branchConditionId: next, variableId: next, reusableToolId: next,
    toolStepId: next, configurationEntryId: next,
  }
}

function makeEmptySlotJourney() {
  const journey = createJourneyEditorDocumentFixture()
  const slot = journey.pattern.slots.at(-1)!
  slot.agentId = null
  return { journey, slot }
}

describe('Agent template lifecycle', () => {
  it('creates a minimum Start-to-End Agent and assigns it atomically', () => {
    const { journey, slot } = makeEmptySlotJourney()
    const before = structuredClone(journey)
    const result = createMinimalAgent(journey, slot.id, 'New Agent', null, '2026-08-13T00:00:00Z', factory())
    expect(result.ok).toBe(true)
    expect(journey).toEqual(before)
    if (!result.ok) throw new Error(result.error.code)
    expect(result.value.agent.workflow.nodes.map((node) => node.type)).toEqual(['start', 'end'])
    expect(result.value.agent.workflow.edges).toHaveLength(1)
    expect(result.value.journey.pattern.slots.find((candidate) => candidate.id === slot.id)?.agentId).toBe(result.value.agent.agent.id)
  })

  it('saves an independent template and instantiates it with remapped owned IDs', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const sourceBefore = structuredClone(source)
    const saved = saveAgentAsTemplate(source, uuidSchema.parse(FIXTURE_IDS.workspace), 'Research Blueprint', null, '2026-08-13T00:00:00Z', factory(50000))
    expect(saved.ok).toBe(true)
    expect(source).toEqual(sourceBefore)
    if (!saved.ok) throw new Error(saved.error.code)

    const { journey, slot } = makeEmptySlotJourney()
    const instantiated = instantiateAgentTemplate(journey, saved.value, slot.id, undefined, '2026-08-13T01:00:00Z', factory(60000))
    expect(instantiated.ok).toBe(true)
    if (!instantiated.ok) throw new Error(instantiated.error.code)
    expect(instantiated.value.agent.agent.id).not.toBe(source.agent.id)
    expect(JSON.stringify(instantiated.value.agent)).not.toContain(source.workflow.nodes[0]!.id)
    expect(JSON.stringify(instantiated.value.agent)).toContain(FIXTURE_IDS.knowledgeSpace)
    expect(saved.value.snapshot).toEqual({
      workflow: source.workflow, layout: source.layout, variables: source.variables, reusableTools: source.reusableTools,
    })
  })

  it('keeps Template identity outside the snapshot owned-ID map', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const saved = saveAgentAsTemplate(source, uuidSchema.parse(FIXTURE_IDS.workspace), 'Collision-safe', null, '2026-08-13T00:00:00Z', factory(61000))
    if (!saved.ok) throw new Error(saved.error.code)
    saved.value.id = source.workflow.nodes[0]!.id
    const { journey, slot } = makeEmptySlotJourney()
    const result = instantiateAgentTemplate(journey, saved.value, slot.id, undefined, '2026-08-13T01:00:00Z', factory(62000))
    expect(result.ok).toBe(true)
  })

  it('rejects occupied creation without mutating the Journey', () => {
    const journey = createJourneyEditorDocumentFixture()
    const occupied = journey.pattern.slots.find((slot) => slot.agentId !== null)!
    const before = structuredClone(journey)
    const result = createMinimalAgent(journey, occupied.id, 'Nope', null, '2026-08-13T00:00:00Z', factory())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TARGET_SLOT_OCCUPIED')
    expect(journey).toEqual(before)
  })
})
