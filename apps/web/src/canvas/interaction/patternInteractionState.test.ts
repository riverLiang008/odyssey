import { uuidSchema } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { transitionPatternInteraction, type PatternInteractionState } from './patternInteractionState'

const SLOT_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-222222222222')

describe('Pattern interaction state', () => {
  it('owns mutually exclusive drag feedback and cancels to idle', () => {
    const idle: PatternInteractionState = { type: 'idle' }
    const dragging = transitionPatternInteraction(idle, {
      type: 'begin-drag', payload: { version: 1, kind: 'pattern-slot', slotId: SLOT_ID },
    })
    const over = transitionPatternInteraction(dragging, {
      type: 'evaluate-drag', target: { kind: 'linear-order', targetOrder: 1 },
      feedback: { tone: 'valid', message: 'Move the Slot.' },
    })
    expect(over).toMatchObject({ type: 'dragging', over: { kind: 'linear-order' } })
    expect(transitionPatternInteraction(over, { type: 'cancel' })).toEqual({ type: 'idle' })
    expect(idle).toEqual({ type: 'idle' })
  })

  it('ignores drag-only events outside a drag session and updates duplicate drafts only in their state', () => {
    const menu: PatternInteractionState = { type: 'menu-open', slotId: SLOT_ID, anchor: { x: 4, y: 8 } }
    expect(transitionPatternInteraction(menu, {
      type: 'evaluate-drag', target: { kind: 'system-canvas' }, feedback: { tone: 'invalid', message: 'No.' },
    })).toBe(menu)
    const naming = transitionPatternInteraction(menu, { type: 'name-duplicate', sourceSlotId: SLOT_ID, draftName: '' })
    expect(transitionPatternInteraction(naming, { type: 'update-duplicate-name', draftName: 'Copy' }))
      .toEqual({ type: 'naming-duplicate', sourceSlotId: SLOT_ID, draftName: 'Copy' })
  })
})
