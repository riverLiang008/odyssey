import { PATTERN_KINDS, uuidSchema, type PatternConfig, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { addSlot, assignAgent, exchangeAgents, moveAgent, removeSlot, reorderSlot, unassignAgent } from './patternCommands'
import type { PatternCommandResult } from './patternErrors'
import type { PatternIdFactory } from './patternIdFactory'
import { instantiatePattern } from './patternStrategies'
import { validatePatternConfig } from './patternValidation'

function factory(): PatternIdFactory {
  let value = 4000
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(value++).toString(16).padStart(12, '0')}`)
  return { patternId: next, slotId: next, routeId: next }
}

function apply(result: PatternCommandResult): PatternConfig {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.code)
  expect(validatePatternConfig(result.value).ok).toBe(true)
  const ids = [result.value.id, ...result.value.slots.map((slot) => slot.id), ...result.value.routes.map((route) => route.id)]
  expect(new Set(ids).size).toBe(ids.length)
  return result.value
}

describe('deterministic Pattern operation sequences', () => {
  it.each(PATTERN_KINDS)('preserves assignment invariants for %s', (kind) => {
    const ids = factory()
    let pattern = instantiatePattern(kind, ids)
    const first = pattern.slots[0]!
    const second = pattern.slots[1]
    const agent = uuidSchema.parse('0195f076-b6e6-7ef0-98db-aaaaaaaaaaaa')
    pattern = apply(assignAgent(pattern, first.id, agent))
    if (second) {
      pattern = apply(moveAgent(pattern, first.id, second.id))
      pattern = apply(exchangeAgents(pattern, first.id, second.id))
      pattern = apply(unassignAgent(pattern, first.id))
    } else {
      pattern = apply(unassignAgent(pattern, first.id))
    }
    expect(pattern.slots.every((slot) => slot.agentId === null)).toBe(true)
  })

  it('preserves Linear and Hub invariants across structural sequences', () => {
    const ids = factory()
    let linear = instantiatePattern('linear_sequence', ids)
    linear = apply(addSlot(linear, 'Stage 5', ids))
    linear = apply(reorderSlot(linear, linear.slots[0]!.id, 3, ids))
    linear = apply(removeSlot(linear, linear.slots[1]!.id, ids))
    expect(linear.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3])

    let hub = instantiatePattern('hub_and_spoke', ids)
    hub = apply(addSlot(hub, 'Spoke 5', ids))
    hub = apply(removeSlot(hub, hub.slots.at(-1)!.id, ids))
    expect(hub.slots.filter((slot) => slot.topologyRole === 'hub')).toHaveLength(1)
    expect(hub.routes).toHaveLength(4)
  })
})

