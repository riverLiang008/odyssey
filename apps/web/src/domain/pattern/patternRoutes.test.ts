import { uuidSchema, type PatternRoute, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import type { PatternIdFactory } from './patternIdFactory'
import { reconcilePatternRoutes, type RouteEndpoint } from './patternRoutes'

function id(suffix: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${suffix.toString(16).padStart(12, '0')}`)
}

function factory(start = 100): Pick<PatternIdFactory, 'routeId'> {
  let sequence = start
  return { routeId: () => id(sequence++) }
}

function endpoint(source: number, target: number): RouteEndpoint {
  return { sourceSlotId: id(source), target: { type: 'slot', slotId: id(target) } }
}

function route(routeId: number, source: number, target: number): PatternRoute {
  return { id: id(routeId), ...endpoint(source, target) }
}

describe('reconcilePatternRoutes', () => {
  it('preserves surviving IDs, creates new IDs, and removes obsolete routes', () => {
    const existing = [route(10, 1, 2), route(11, 2, 3)]
    const before = structuredClone(existing)
    const result = reconcilePatternRoutes(existing, [endpoint(2, 3), endpoint(3, 4)], factory())

    expect(result).toEqual([route(11, 2, 3), route(100, 3, 4)])
    expect(result.some((candidate) => candidate.id === id(10))).toBe(false)
    expect(existing).toEqual(before)
  })

  it('consumes each duplicate existing endpoint at most once', () => {
    const result = reconcilePatternRoutes(
      [route(10, 1, 2), route(11, 1, 2)],
      [endpoint(1, 2), endpoint(1, 2), endpoint(1, 2)],
      factory(),
    )
    expect(result.map((candidate) => candidate.id)).toEqual([id(10), id(11), id(100)])
    expect(new Set(result.map((candidate) => candidate.id)).size).toBe(3)
  })

  it('does not reuse one existing ID for duplicate expected endpoints', () => {
    const result = reconcilePatternRoutes([route(10, 1, 2)], [endpoint(1, 2), endpoint(1, 2)], factory())
    expect(result.map((candidate) => candidate.id)).toEqual([id(10), id(100)])
  })

  it('does not mutate endpoint inputs', () => {
    const endpoints = [endpoint(1, 2)]
    const before = structuredClone(endpoints)
    reconcilePatternRoutes([], endpoints, factory())
    expect(endpoints).toEqual(before)
  })
})

