import { uuidSchema, type JourneyEditorDocument, type PatternTemplateKey, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { instantiatePattern, type PatternIdFactory } from '@/domain/pattern'
import { createJourneyEditorDocumentFixture } from '@/fixtures'
import { createSystemCanvasViewModel } from './systemCanvasAdapter'

function ids(): PatternIdFactory {
  let sequence = 200000
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return { patternId: next, slotId: next, routeId: next }
}

describe('System Canvas adapter', () => {
  it.each<PatternTemplateKey>(['hub_and_spoke', 'diamond_loop', 'linear_sequence', 'solo_component'])(
    'derives stable %s Slot and route view models without mutating the document', (key) => {
    const document = createJourneyEditorDocumentFixture()
    document.pattern = instantiatePattern(key, ids())
    const before = structuredClone(document)
    const model = createSystemCanvasViewModel(document, document.pattern.slots[0]?.id ?? null)
    expect(model.slots).toHaveLength(document.pattern.slots.length)
    expect(model.routes.every((route) => model.slots.some((slot) => slot.id === route.sourceSlotId)
      && (route.targetSlotId === null || model.slots.some((slot) => slot.id === route.targetSlotId)))).toBe(true)
    expect(document).toEqual(before)
    },
  )

  it('reports a missing Agent summary instead of asserting it exists', () => {
    const document: JourneyEditorDocument = createJourneyEditorDocumentFixture()
    const occupied = document.pattern.slots[0]
    if (!occupied?.agentId) throw new Error('Expected occupied Slot')
    document.agents = document.agents.filter((agent) => agent.id !== occupied.agentId)
    const model = createSystemCanvasViewModel(document, null)
    expect(model.slots.find((slot) => slot.id === occupied.id)?.assignment).toBe('missing-summary')
    expect(model.diagnostics).toContainEqual({ code: 'AGENT_SUMMARY_MISSING', id: occupied.agentId })
  })

  it('preserves a canonical Slot and diagnoses a missing presentation position', () => {
    const document = createJourneyEditorDocumentFixture()
    document.pattern = instantiatePattern('hub_and_spoke', ids())
    const corruptSlot = document.pattern.slots.at(-1)
    if (!corruptSlot) throw new Error('Expected Slot')
    corruptSlot.topologyRole = 'unknown_role'
    const before = structuredClone(document)
    const model = createSystemCanvasViewModel(document, corruptSlot.id)
    expect(model.slots).toHaveLength(document.pattern.slots.length)
    expect(model.slots.find((slot) => slot.id === corruptSlot.id)).toMatchObject({ selected: true })
    expect(model.diagnostics).toContainEqual({ code: 'SLOT_POSITION_MISSING', id: corruptSlot.id })
    expect(document).toEqual(before)
  })
})
