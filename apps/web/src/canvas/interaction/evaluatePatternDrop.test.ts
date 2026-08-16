import { uuidSchema, type PatternConfig, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { evaluatePatternDrop } from './evaluatePatternDrop'

const TEMPLATE_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-333333333333')

function pattern(): PatternConfig {
  return createJourneyEditorDocumentFixture().pattern
}

function emptySlot(config: PatternConfig): { id: UUID } {
  const slot = config.slots.at(-1)
  if (!slot) throw new Error('Expected fixture to contain an empty Slot')
  slot.agentId = null
  return slot
}

describe('Pattern drop preflight', () => {
  it('instantiates a Template only into an empty Slot and rejects an occupied Slot', () => {
    const config = pattern()
    const empty = emptySlot(config)
    const occupied = config.slots.find((slot) => slot.agentId)
    if (!occupied) throw new Error('Expected occupied Slot')
    expect(evaluatePatternDrop(
      { version: 1, kind: 'agent-template', templateId: TEMPLATE_ID }, { kind: 'agent-slot', slotId: empty.id }, config,
    )).toMatchObject({ status: 'valid', action: { type: 'instantiate-agent-template', targetSlotId: empty.id } })
    expect(evaluatePatternDrop(
      { version: 1, kind: 'agent-template', templateId: TEMPLATE_ID }, { kind: 'agent-slot', slotId: occupied.id }, config,
    )).toMatchObject({ status: 'occupied', reason: 'TARGET_OCCUPIED' })
  })

  it('maps assigned Agent empty/occupied/same targets to move, exchange and stable rejection', () => {
    const config = pattern()
    const source = config.slots.find((slot) => slot.agentId === FIXTURE_IDS.researchAgent)
    const destination = emptySlot(config)
    const occupied = config.slots.find((slot) => slot.agentId && slot.id !== source?.id)
    if (!source?.agentId || !occupied) throw new Error('Expected assigned fixture Slots')
    const payload = { version: 1, kind: 'assigned-agent', agentId: source.agentId, sourceSlotId: source.id } as const
    expect(evaluatePatternDrop(payload, { kind: 'agent-slot', slotId: destination.id }, config)).toMatchObject({ status: 'valid', action: { type: 'move-agent' } })
    expect(evaluatePatternDrop(payload, { kind: 'agent-slot', slotId: occupied.id }, config)).toMatchObject({ status: 'valid', action: { type: 'exchange-agents' } })
    expect(evaluatePatternDrop(payload, { kind: 'agent-slot', slotId: source.id }, config)).toMatchObject({ status: 'duplicate', reason: 'SAME_SLOT' })
  })

  it('allows only pattern-slot payload to reorder Linear and rejects future payload kinds explicitly', () => {
    const config = pattern()
    const slot = config.slots[0]
    if (!slot) throw new Error('Expected Slot')
    expect(evaluatePatternDrop(
      { version: 1, kind: 'pattern-slot', slotId: slot.id }, { kind: 'linear-order', targetOrder: 1 }, config,
    )).toMatchObject({ status: 'valid', action: { type: 'reorder-slot' } })
    expect(evaluatePatternDrop(
      { version: 1, kind: 'workflow-node-template', nodeType: 'task' }, { kind: 'system-canvas' }, config,
    )).toMatchObject({ status: 'invalid', reason: 'TARGET_KIND_UNSUPPORTED' })
    expect(evaluatePatternDrop(
      { version: 1, kind: 'resource', resourceType: 'tool', resourceId: TEMPLATE_ID }, { kind: 'agent-slot', slotId: slot.id }, config,
    )).toMatchObject({ status: 'invalid', reason: 'TARGET_KIND_UNSUPPORTED' })
  })

  it('distinguishes empty and mismatched sources before evaluating same-slot', () => {
    const config = pattern()
    const source = config.slots[0]
    if (!source?.agentId) throw new Error('Expected assigned source Slot')
    const staleAgentId = TEMPLATE_ID
    expect(evaluatePatternDrop(
      { version: 1, kind: 'assigned-agent', agentId: staleAgentId, sourceSlotId: source.id },
      { kind: 'agent-slot', slotId: config.slots[1]?.id ?? TEMPLATE_ID }, config,
    )).toMatchObject({ status: 'invalid', reason: 'SOURCE_AGENT_MISMATCH' })
    expect(evaluatePatternDrop(
      { version: 1, kind: 'assigned-agent', agentId: staleAgentId, sourceSlotId: source.id },
      { kind: 'agent-slot', slotId: source.id }, config,
    )).toMatchObject({ status: 'invalid', reason: 'SOURCE_AGENT_MISMATCH' })
    const emptySource = config.slots.at(-1)
    if (!emptySource) throw new Error('Expected source Slot')
    emptySource.agentId = null
    expect(evaluatePatternDrop(
      { version: 1, kind: 'assigned-agent', agentId: staleAgentId, sourceSlotId: emptySource.id },
      { kind: 'agent-slot', slotId: source.id }, config,
    )).toMatchObject({ status: 'invalid', reason: 'SOURCE_SLOT_EMPTY' })
  })

  it('returns stable failures for missing targets and unsupported reorder capability', () => {
    const config = pattern()
    const source = config.slots[0]
    if (!source?.agentId) throw new Error('Expected assigned source Slot')
    expect(evaluatePatternDrop(
      { version: 1, kind: 'agent-template', templateId: TEMPLATE_ID },
      { kind: 'agent-slot', slotId: TEMPLATE_ID }, config,
    )).toMatchObject({ status: 'invalid', reason: 'SLOT_NOT_FOUND' })
    expect(evaluatePatternDrop(
      { version: 1, kind: 'pattern-slot', slotId: source.id },
      { kind: 'linear-order', targetOrder: config.slots.length }, config,
    )).toMatchObject({ status: 'invalid', reason: 'REORDER_POSITION_INVALID' })
    const nonLinear = structuredClone(config)
    nonLinear.kind = 'diamond_loop'
    expect(evaluatePatternDrop(
      { version: 1, kind: 'pattern-slot', slotId: source.id },
      { kind: 'linear-order', targetOrder: 0 }, nonLinear,
    )).toMatchObject({ status: 'invalid', reason: 'REORDER_UNSUPPORTED' })
  })
})
