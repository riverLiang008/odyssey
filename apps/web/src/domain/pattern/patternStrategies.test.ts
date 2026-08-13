import { PATTERN_KINDS, uuidSchema, type PatternConfig, type PatternTemplateKey, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import type { PatternIdFactory } from './patternIdFactory'
import { derivePatternPresentation } from './patternLayout'
import { routeEndpointKey } from './patternRoutes'
import { instantiatePattern, PATTERN_STRATEGIES } from './patternStrategies'
import { validatePatternConfig } from './patternValidation'

function deterministicIdFactory(): PatternIdFactory {
  let sequence = 0
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(++sequence).toString(16).padStart(12, '0')}`)
  return { patternId: next, slotId: next, routeId: next }
}

const TEMPLATE_KEYS: PatternTemplateKey[] = ['hub_and_spoke', 'diamond_loop', 'linear_sequence', 'solo_component']

describe('built-in Pattern strategies', () => {
  it('keeps the strategy registry exhaustive with canonical Pattern kinds', () => {
    expect(Object.keys(PATTERN_STRATEGIES).sort()).toEqual([...PATTERN_KINDS].sort())
  })

  it.each(TEMPLATE_KEYS)('instantiates a deterministic, valid %s aggregate', (templateKey) => {
    const first = instantiatePattern(templateKey, deterministicIdFactory())
    const second = instantiatePattern(templateKey, deterministicIdFactory())
    expect(first).toEqual(second)
    expect(validatePatternConfig(first)).toEqual({ ok: true, value: first })
    const ids = [first.id, ...first.slots.map((slot) => slot.id), ...first.routes.map((route) => route.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('creates the accepted Hub topology', () => {
    const pattern = instantiatePattern('hub_and_spoke', deterministicIdFactory())
    const hub = pattern.slots.find((slot) => slot.topologyRole === 'hub')!
    expect(pattern.slots.filter((slot) => slot.topologyRole === 'spoke')).toHaveLength(4)
    expect(pattern.routes).toHaveLength(4)
    expect(pattern.routes.every((route) => route.sourceSlotId === hub.id && route.target.type === 'slot')).toBe(true)
  })

  it('creates the accepted four-stage Diamond cycle', () => {
    const pattern = instantiatePattern('diamond_loop', deterministicIdFactory())
    const byRole = new Map(pattern.slots.map((slot) => [slot.topologyRole, slot.id]))
    expect(pattern.routes.map(routeEndpointKey)).toEqual([
      `${byRole.get('entry')}->slot:${byRole.get('upper_branch')}`,
      `${byRole.get('upper_branch')}->slot:${byRole.get('exit')}`,
      `${byRole.get('exit')}->slot:${byRole.get('lower_branch')}`,
      `${byRole.get('lower_branch')}->slot:${byRole.get('entry')}`,
    ])
  })

  it('creates a four-stage Linear sequence ending at journey_end', () => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    expect(pattern.slots.map((slot) => slot.order)).toEqual([0, 1, 2, 3])
    expect(pattern.routes).toHaveLength(4)
    expect(pattern.routes.at(-1)?.target).toEqual({ type: 'journey_end' })
  })

  it('creates one isolated Solo slot', () => {
    const pattern = instantiatePattern('solo_component', deterministicIdFactory())
    expect(pattern.slots).toHaveLength(1)
    expect(pattern.slots[0]?.topologyRole).toBe('solo')
    expect(pattern.routes).toEqual([])
  })

  it.each(TEMPLATE_KEYS)('derives complete presentation without mutating %s config', (templateKey) => {
    const pattern = instantiatePattern(templateKey, deterministicIdFactory())
    const before = structuredClone(pattern)
    const presentation = derivePatternPresentation(pattern)
    expect(new Set(presentation.slots.map((slot) => slot.slotId))).toEqual(new Set(pattern.slots.map((slot) => slot.id)))
    expect(new Set(presentation.routes.map((route) => route.routeId))).toEqual(new Set(pattern.routes.map((route) => route.id)))
    expect(pattern).toEqual(before)
    expect(JSON.stringify(pattern)).not.toMatch(/"[xy]":/)
  })
})

describe('Pattern topology validation', () => {
  function changed(pattern: PatternConfig, change: Partial<PatternConfig>): PatternConfig {
    return { ...structuredClone(pattern), ...change }
  }

  it('rejects mismatched template provenance', () => {
    const pattern = instantiatePattern('solo_component', deterministicIdFactory())
    const result = validatePatternConfig(changed(pattern, { templateKey: 'linear_sequence' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('PATTERN_KIND_MISMATCH')
  })

  it('rejects duplicate Agent assignment', () => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    const agentId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-ffffffffffff')
    pattern.slots[0]!.agentId = agentId
    pattern.slots[1]!.agentId = agentId
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('AGENT_ASSIGNED_MORE_THAN_ONCE')
  })

  it.each(['slot', 'route'] as const)('rejects Pattern ID collision with a %s ID', (entity) => {
    const pattern = instantiatePattern(entity === 'slot' ? 'solo_component' : 'linear_sequence', deterministicIdFactory())
    if (entity === 'slot') pattern.slots[0]!.id = pattern.id
    else pattern.routes[0]!.id = pattern.id
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('OWNED_ID_COLLISION')
  })

  it('rejects a Slot ID collision with a Route ID', () => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    pattern.routes[0]!.id = pattern.slots[0]!.id
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('OWNED_ID_COLLISION')
  })

  it('rejects gaps in Linear order', () => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    pattern.slots[2]!.order = 7
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('SLOT_ORDER_INVALID')
  })

  it.each([null, 0, -1, 8])('rejects an invalid Linear terminal order %s', (order) => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    pattern.slots.at(-1)!.order = order
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
  })

  it('accepts the minimum one-Slot Linear topology and derives a finite layout', () => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    const onlySlot = pattern.slots[0]!
    pattern.slots = [{ ...onlySlot, order: 0 }]
    pattern.routes = [{ ...pattern.routes[0]!, sourceSlotId: onlySlot.id, target: { type: 'journey_end' } }]
    expect(validatePatternConfig(pattern).ok).toBe(true)
    expect(derivePatternPresentation(pattern).slots.every((position) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(true)
  })

  it('accepts and lays out the minimum one-spoke Hub without overlap', () => {
    const pattern = instantiatePattern('hub_and_spoke', deterministicIdFactory())
    const retainedSlotIds = new Set(pattern.slots.slice(0, 2).map((slot) => slot.id))
    pattern.slots = pattern.slots.slice(0, 2)
    pattern.routes = pattern.routes.filter((route) => route.target.type === 'slot' && retainedSlotIds.has(route.target.slotId))
    expect(validatePatternConfig(pattern).ok).toBe(true)
    const positions = derivePatternPresentation(pattern).slots
    expect(positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
    expect(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size).toBe(2)
  })

  it.each([
    { kind: 'hub_and_spoke' as const, mutate: (pattern: PatternConfig) => { pattern.slots = pattern.slots.filter((slot) => slot.topologyRole === 'hub'); pattern.routes = [] } },
    { kind: 'hub_and_spoke' as const, mutate: (pattern: PatternConfig) => { pattern.slots[1]!.topologyRole = 'hub' } },
    { kind: 'hub_and_spoke' as const, mutate: (pattern: PatternConfig) => { pattern.slots[1]!.topologyRole = 'unknown' } },
    { kind: 'diamond_loop' as const, mutate: (pattern: PatternConfig) => { pattern.slots[1]!.topologyRole = 'entry' } },
    { kind: 'solo_component' as const, mutate: (pattern: PatternConfig) => { pattern.slots.push({ ...pattern.slots[0]!, id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-eeeeeeeeeeee') }) } },
  ])('rejects invalid $kind cardinality or roles', ({ kind, mutate }) => {
    const pattern = instantiatePattern(kind, deterministicIdFactory())
    mutate(pattern)
    expect(validatePatternConfig(pattern).ok).toBe(false)
  })

  it('rejects structurally valid but semantically incorrect routes', () => {
    const pattern = instantiatePattern('hub_and_spoke', deterministicIdFactory())
    pattern.routes[0]!.target = pattern.routes[1]!.target
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('ROUTE_TOPOLOGY_INVALID')
  })

  it('treats route array order as non-semantic', () => {
    const pattern = instantiatePattern('diamond_loop', deterministicIdFactory())
    pattern.routes.reverse()
    expect(validatePatternConfig(pattern).ok).toBe(true)
  })

  it.each(['missing', 'extra', 'reversed'] as const)('rejects a %s authoritative route', (variant) => {
    const pattern = instantiatePattern('diamond_loop', deterministicIdFactory())
    if (variant === 'missing') pattern.routes.pop()
    if (variant === 'extra') pattern.routes.push({ ...pattern.routes[0]!, id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-dddddddddddd') })
    if (variant === 'reversed') {
      const first = pattern.routes[0]!
      const targetId = first.target.type === 'slot' ? first.target.slotId : first.sourceSlotId
      first.target = { type: 'slot', slotId: first.sourceSlotId }
      first.sourceSlotId = targetId
    }
    expect(validatePatternConfig(pattern).ok).toBe(false)
  })

  it.each(['duplicate_slot', 'duplicate_route', 'missing_endpoint'] as const)('rejects runtime identity/reference error %s', (variant) => {
    const pattern = instantiatePattern('linear_sequence', deterministicIdFactory())
    if (variant === 'duplicate_slot') pattern.slots[1]!.id = pattern.slots[0]!.id
    if (variant === 'duplicate_route') pattern.routes[1]!.id = pattern.routes[0]!.id
    if (variant === 'missing_endpoint') pattern.routes[0]!.sourceSlotId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-cccccccccccc')
    const result = validatePatternConfig(pattern)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.every((error) => error.code === 'SCHEMA_INVALID')).toBe(true)
  })

  it('reports runtime schema failures first', () => {
    const result = validatePatternConfig({ kind: 'unknown' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.every((error) => error.code === 'SCHEMA_INVALID')).toBe(true)
  })
})
