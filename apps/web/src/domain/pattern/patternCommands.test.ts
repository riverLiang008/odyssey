import { uuidSchema, type PatternConfig, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import {
  addSlot,
  assignAgent,
  exchangeAgents,
  moveAgent,
  removeSlot,
  reorderSlot,
  unassignAgent,
} from './patternCommands'
import type { PatternIdFactory } from './patternIdFactory'
import { derivePatternPresentation } from './patternLayout'
import { routeEndpointKey } from './patternRoutes'
import { instantiatePattern } from './patternStrategies'
import { validatePatternConfig } from './patternValidation'

function deterministicFactory(start = 1): PatternIdFactory {
  let sequence = start
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return { patternId: next, slotId: next, routeId: next }
}

const AGENT_A = uuidSchema.parse('0195f076-b6e6-7ef0-98db-aaaaaaaaaaaa')
const AGENT_B = uuidSchema.parse('0195f076-b6e6-7ef0-98db-bbbbbbbbbbbb')
const MISSING_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-ffffffffffff')

function expectSuccess(result: ReturnType<typeof assignAgent>): PatternConfig {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.code)
  expect(validatePatternConfig(result.value).ok).toBe(true)
  return result.value
}

function expectFailure(result: ReturnType<typeof assignAgent>, code: string): void {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe(code)
}

function expectFiniteCompletePresentation(pattern: PatternConfig): void {
  const presentation = derivePatternPresentation(pattern)
  expect(new Set(presentation.slots.map((slot) => slot.slotId))).toEqual(new Set(pattern.slots.map((slot) => slot.id)))
  expect(new Set(presentation.routes.map((route) => route.routeId))).toEqual(new Set(pattern.routes.map((route) => route.id)))
  expect(presentation.slots.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
}

describe('Pattern assignment commands', () => {
  it('assigns and unassigns without mutating the input', () => {
    const input = instantiatePattern('solo_component', deterministicFactory())
    input.configuration = { nested: { stable: true } }
    const before = structuredClone(input)
    const assigned = expectSuccess(assignAgent(input, input.slots[0]!.id, AGENT_A))
    expect(input).toEqual(before)
    expect(assigned.slots[0]?.agentId).toBe(AGENT_A)

    const unassigned = expectSuccess(unassignAgent(assigned, assigned.slots[0]!.id))
    expect(unassigned.slots[0]?.agentId).toBeNull()
    expect(assigned.slots[0]?.agentId).toBe(AGENT_A)
  })

  it('rejects missing, occupied, and duplicate assignments', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    const assigned = expectSuccess(assignAgent(input, input.slots[0]!.id, AGENT_A))
    expectFailure(assignAgent(assigned, MISSING_ID, AGENT_B), 'SLOT_NOT_FOUND')
    expectFailure(assignAgent(assigned, assigned.slots[0]!.id, AGENT_B), 'TARGET_SLOT_OCCUPIED')
    expectFailure(assignAgent(assigned, assigned.slots[1]!.id, AGENT_A), 'AGENT_ALREADY_ASSIGNED')
    expectFailure(unassignAgent(input, input.slots[0]!.id), 'SOURCE_SLOT_EMPTY')
  })

  it('moves an Agent only from occupied to empty Slots', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    const assigned = expectSuccess(assignAgent(input, input.slots[0]!.id, AGENT_A))
    const moved = expectSuccess(moveAgent(assigned, assigned.slots[0]!.id, assigned.slots[1]!.id))
    expect(moved.slots[0]?.agentId).toBeNull()
    expect(moved.slots[1]?.agentId).toBe(AGENT_A)
    expectFailure(moveAgent(input, input.slots[0]!.id, input.slots[1]!.id), 'SOURCE_SLOT_EMPTY')
    expectFailure(moveAgent(assigned, assigned.slots[0]!.id, assigned.slots[0]!.id), 'SAME_SLOT')
    const occupiedTarget = expectSuccess(assignAgent(assigned, assigned.slots[1]!.id, AGENT_B))
    expectFailure(moveAgent(occupiedTarget, occupiedTarget.slots[0]!.id, occupiedTarget.slots[1]!.id), 'TARGET_SLOT_OCCUPIED')
    expectFailure(moveAgent(assigned, MISSING_ID, assigned.slots[1]!.id), 'SLOT_NOT_FOUND')
    expectFailure(moveAgent(assigned, assigned.slots[0]!.id, MISSING_ID), 'SLOT_NOT_FOUND')
  })

  it('exchanges assignments while preserving topology, roles, and routes', () => {
    let input = instantiatePattern('diamond_loop', deterministicFactory())
    input = expectSuccess(assignAgent(input, input.slots[0]!.id, AGENT_A))
    input = expectSuccess(assignAgent(input, input.slots[1]!.id, AGENT_B))
    const topologyBefore = input.slots.map(({ id, topologyRole, label, order }) => ({ id, topologyRole, label, order }))
    const routesBefore = structuredClone(input.routes)
    const result = expectSuccess(exchangeAgents(input, input.slots[0]!.id, input.slots[1]!.id))
    expect(result.slots[0]?.agentId).toBe(AGENT_B)
    expect(result.slots[1]?.agentId).toBe(AGENT_A)
    expect(result.slots.map(({ id, topologyRole, label, order }) => ({ id, topologyRole, label, order }))).toEqual(topologyBefore)
    expect(result.routes).toEqual(routesBefore)
  })

  it('rejects invalid exchange and unassign targets', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    expectFailure(exchangeAgents(input, input.slots[0]!.id, input.slots[0]!.id), 'SAME_SLOT')
    expectFailure(exchangeAgents(input, input.slots[0]!.id, MISSING_ID), 'SLOT_NOT_FOUND')
    expectFailure(unassignAgent(input, MISSING_ID), 'SLOT_NOT_FOUND')
  })

  it('exchanges occupied and empty Slots in both directions, and keeps two empty Slots empty', () => {
    const base = instantiatePattern('linear_sequence', deterministicFactory())
    const occupied = expectSuccess(assignAgent(base, base.slots[0]!.id, AGENT_A))
    const forward = expectSuccess(exchangeAgents(occupied, occupied.slots[0]!.id, occupied.slots[1]!.id))
    expect(forward.slots[0]?.agentId).toBeNull()
    expect(forward.slots[1]?.agentId).toBe(AGENT_A)
    const backward = expectSuccess(exchangeAgents(forward, forward.slots[0]!.id, forward.slots[1]!.id))
    expect(backward.slots[0]?.agentId).toBe(AGENT_A)
    expect(backward.slots[1]?.agentId).toBeNull()

    const before = structuredClone(base)
    const emptyExchange = expectSuccess(exchangeAgents(base, base.slots[1]!.id, base.slots[2]!.id))
    expect(emptyExchange.slots[1]?.agentId).toBeNull()
    expect(emptyExchange.slots[2]?.agentId).toBeNull()
    expect(base).toEqual(before)
  })

  it('rejects commands against an invalid input aggregate atomically', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    input.routes = []
    const before = structuredClone(input)
    expectFailure(assignAgent(input, input.slots[0]!.id, AGENT_A), 'INVALID_TOPOLOGY')
    expect(input).toEqual(before)
  })
})

describe('Pattern Slot commands', () => {
  it('appends and removes a Linear Slot with continuous order and reconciled routes', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    const before = structuredClone(input)
    const added = expectSuccess(addSlot(input, '  Stage 5  ', deterministicFactory(100)))
    expect(input).toEqual(before)
    expect(added.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3, 4])
    expect(added.slots.at(-1)?.label).toBe('Stage 5')
    expect(added.routes).toHaveLength(5)
    expectFiniteCompletePresentation(added)

    const removed = expectSuccess(removeSlot(added, added.slots[1]!.id, deterministicFactory(200)))
    expect(removed.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3])
    expect(removed.slots.some((slot) => slot.id === added.slots[1]!.id)).toBe(false)
    expectFiniteCompletePresentation(removed)
  })

  it('inserts a Linear Slot relative to a stable Slot identity', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    const anchor = input.slots[1]!
    const added = expectSuccess(addSlot(input, 'Inserted stage', deterministicFactory(300), {
      slotId: anchor.id, placement: 'before',
    }))
    expect(added.slots[1]?.label).toBe('Inserted stage')
    expect(added.slots[2]?.id).toBe(anchor.id)
    expect(added.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3, 4])
    expectFiniteCompletePresentation(added)
  })

  it('reorders Linear Slot identity and assignment rather than exchanging Agents', () => {
    let input = instantiatePattern('linear_sequence', deterministicFactory())
    const movedSlotId = input.slots[0]!.id
    input = expectSuccess(assignAgent(input, movedSlotId, AGENT_A))
    const result = expectSuccess(reorderSlot(input, movedSlotId, 2, deterministicFactory(100)))
    const ordered = [...result.slots].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    expect(ordered[2]?.id).toBe(movedSlotId)
    expect(ordered[2]?.agentId).toBe(AGENT_A)
    expect(derivePatternPresentation(result).slots[2]?.slotId).toBe(movedSlotId)
    expectFiniteCompletePresentation(result)
  })

  it('preserves route IDs only for surviving semantic endpoint pairs', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    const existing = new Map(input.routes.map((route) => [routeEndpointKey(route), route.id]))
    const result = expectSuccess(reorderSlot(input, input.slots[0]!.id, 2, deterministicFactory(100)))
    result.routes.forEach((route) => {
      const oldId = existing.get(routeEndpointKey(route))
      if (oldId) expect(route.id).toBe(oldId)
      else expect(Number.parseInt(route.id.slice(-12), 16)).toBeGreaterThanOrEqual(100)
    })
  })

  it('adds and removes only Hub spokes while preserving the Hub', () => {
    const input = instantiatePattern('hub_and_spoke', deterministicFactory())
    const hubId = input.slots.find((slot) => slot.topologyRole === 'hub')!.id
    const added = expectSuccess(addSlot(input, 'New spoke', deterministicFactory(100)))
    expect(added.slots.filter((slot) => slot.topologyRole === 'spoke')).toHaveLength(5)
    expect(added.routes).toHaveLength(5)
    expect(added.slots.find((slot) => slot.topologyRole === 'hub')?.id).toBe(hubId)
    expectFiniteCompletePresentation(added)

    const removed = expectSuccess(removeSlot(added, added.slots.at(-1)!.id, deterministicFactory(200)))
    expect(removed.slots.filter((slot) => slot.topologyRole === 'spoke')).toHaveLength(4)
    expect(removed.routes).toHaveLength(4)
    expectFiniteCompletePresentation(removed)
  })

  it('rejects unsupported, immutable, occupied, cardinality, label, and reorder failures', () => {
    const hub = instantiatePattern('hub_and_spoke', deterministicFactory())
    const hubSlot = hub.slots.find((slot) => slot.topologyRole === 'hub')!
    expectFailure(removeSlot(hub, hubSlot.id, deterministicFactory(100)), 'IMMUTABLE_TOPOLOGY_ROLE')
    expectFailure(addSlot(hub, '   ', deterministicFactory(100)), 'INVALID_SLOT_LABEL')

    const occupied = expectSuccess(assignAgent(hub, hub.slots[1]!.id, AGENT_A))
    expectFailure(removeSlot(occupied, occupied.slots[1]!.id, deterministicFactory(100)), 'SLOT_OCCUPIED')

    const minimumHub = structuredClone(hub)
    minimumHub.slots = minimumHub.slots.slice(0, 2)
    minimumHub.routes = minimumHub.routes.slice(0, 1)
    expectFailure(removeSlot(minimumHub, minimumHub.slots[1]!.id, deterministicFactory(100)), 'CARDINALITY_VIOLATION')

    const linear = instantiatePattern('linear_sequence', deterministicFactory())
    expectFailure(reorderSlot(linear, linear.slots[0]!.id, -1, deterministicFactory(100)), 'INVALID_REORDER_POSITION')
    expectFailure(reorderSlot(linear, MISSING_ID, 0, deterministicFactory(100)), 'SLOT_NOT_FOUND')
    expectFailure(removeSlot(linear, MISSING_ID, deterministicFactory(100)), 'SLOT_NOT_FOUND')

    const minimumLinear = structuredClone(linear)
    minimumLinear.slots = minimumLinear.slots.slice(0, 1)
    minimumLinear.routes = [{ ...minimumLinear.routes[0]!, sourceSlotId: minimumLinear.slots[0]!.id, target: { type: 'journey_end' } }]
    expectFailure(removeSlot(minimumLinear, minimumLinear.slots[0]!.id, deterministicFactory(100)), 'CARDINALITY_VIOLATION')
  })

  it('adds, reorders, and removes Circular Loop Slots while preserving one entry and a closed cycle', () => {
    const input = instantiatePattern('diamond_loop', deterministicFactory())
    const entryId = input.slots.find((slot) => slot.topologyRole === 'entry')!.id
    const added = expectSuccess(addSlot(input, 'Stage 5', deterministicFactory(100), { slotId: input.slots[1]!.id, placement: 'after' }))
    expect(added.slots).toHaveLength(5)
    expect(added.routes).toHaveLength(5)
    expect(added.slots.filter((slot) => slot.topologyRole === 'entry').map((slot) => slot.id)).toEqual([entryId])
    expect(added.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3, 4])

    const reordered = expectSuccess(reorderSlot(added, added.slots[4]!.id, 1, deterministicFactory(200)))
    expect(reordered.slots.find((slot) => slot.id === entryId)?.topologyRole).toBe('entry')
    expect(reordered.routes).toHaveLength(5)

    const removedEntry = expectSuccess(removeSlot(reordered, entryId, deterministicFactory(300)))
    expect(removedEntry.slots).toHaveLength(4)
    expect(removedEntry.slots.filter((slot) => slot.topologyRole === 'entry')).toHaveLength(1)
    expect(removedEntry.routes).toHaveLength(4)
    expect(validatePatternConfig(removedEntry).ok).toBe(true)
  })

  it('rejects an ID-colliding factory without exposing a partial candidate', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    const before = structuredClone(input)
    const collidingFactory = {
      slotId: () => input.id,
      routeId: () => input.routes[0]!.id,
    }
    expectFailure(addSlot(input, 'Colliding', collidingFactory), 'INVALID_TOPOLOGY')
    expect(input).toEqual(before)
  })

  it('keeps deeply nested inputs unchanged for representative command failures', () => {
    const input = instantiatePattern('linear_sequence', deterministicFactory())
    input.configuration = { nested: { values: [1, 2, 3] } }
    input.slots[0]!.configuration = { nested: { value: 'stable' } }
    const before = structuredClone(input)
    const failures = [
      assignAgent(input, MISSING_ID, AGENT_A),
      moveAgent(input, input.slots[0]!.id, input.slots[1]!.id),
      exchangeAgents(input, input.slots[0]!.id, input.slots[0]!.id),
      unassignAgent(input, input.slots[0]!.id),
      addSlot(input, '   ', deterministicFactory(100)),
      removeSlot(input, MISSING_ID, deterministicFactory(100)),
      reorderSlot(input, input.slots[0]!.id, Number.NaN, deterministicFactory(100)),
    ]
    failures.forEach((result) => expect(result.ok).toBe(false))
    expect(input).toEqual(before)
  })
})
