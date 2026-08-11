import { describe, expect, it } from 'vitest'

import {
  PATTERN_KINDS,
  patternConfigSchema,
  patternKindSchema,
  patternRouteTargetSchema,
  patternTemplateSummarySchema,
} from './index'

const SLOT_RESEARCH_ID = '0195f076-b6e6-7ef0-98db-d721990f8810'
const SLOT_REVIEW_ID = '0195f076-b6e6-7ef0-98db-d721990f8811'
const ROUTE_REVIEW_ID = '0195f076-b6e6-7ef0-98db-d721990f8821'
const ROUTE_END_ID = '0195f076-b6e6-7ef0-98db-d721990f8822'

function createCanonicalPattern() {
  return {
    schemaVersion: '1.0.0',
    id: '0195f076-b6e6-7ef0-98db-d721990f8820',
    templateKey: 'linear_sequence',
    kind: 'linear_sequence',
    name: 'Research pipeline',
    slots: [
      {
        id: SLOT_RESEARCH_ID,
        topologyRole: null,
        label: 'Research',
        order: 0,
        agentId: '0195f076-b6e6-7ef0-98db-d721990f8801',
        configuration: {},
      },
      {
        id: SLOT_REVIEW_ID,
        topologyRole: null,
        label: 'Review',
        order: 1,
        agentId: null,
        configuration: {},
      },
    ],
    routes: [
      {
        id: ROUTE_REVIEW_ID,
        sourceSlotId: SLOT_RESEARCH_ID,
        target: { type: 'slot', slotId: SLOT_REVIEW_ID },
      },
      {
        id: ROUTE_END_ID,
        sourceSlotId: SLOT_REVIEW_ID,
        target: { type: 'journey_end' },
      },
    ],
    configuration: {},
  }
}

describe('Pattern schemas', () => {
  it('parses the frozen canonical PatternConfig example', () => {
    expect(patternConfigSchema.parse(createCanonicalPattern())).toEqual(createCanonicalPattern())
  })

  it('accepts exactly the four frozen built-in Pattern kinds', () => {
    for (const kind of PATTERN_KINDS) {
      expect(patternKindSchema.parse(kind)).toBe(kind)
    }
    expect(patternKindSchema.safeParse('custom').success).toBe(false)
  })

  it('models route targets as a strict discriminated union', () => {
    expect(patternRouteTargetSchema.parse({ type: 'journey_end' })).toEqual({
      type: 'journey_end',
    })
    expect(
      patternRouteTargetSchema.safeParse({ type: 'agent', agentId: SLOT_REVIEW_ID }).success,
    ).toBe(false)
    expect(
      patternRouteTargetSchema.safeParse({ type: 'journey_end', slotId: SLOT_REVIEW_ID }).success,
    ).toBe(false)
  })

  it.each([
    ['Pattern ID', (pattern: ReturnType<typeof createCanonicalPattern>) => (pattern.id = 'pattern-1')],
    ['Slot ID', (pattern: ReturnType<typeof createCanonicalPattern>) => (pattern.slots[0]!.id = 'slot-1')],
    ['Route ID', (pattern: ReturnType<typeof createCanonicalPattern>) => (pattern.routes[0]!.id = 'route-1')],
  ])('rejects an invalid %s', (_label, mutate) => {
    const pattern = createCanonicalPattern()
    mutate(pattern)
    expect(patternConfigSchema.safeParse(pattern).success).toBe(false)
  })

  it('rejects duplicate Slot and Route identities', () => {
    const duplicateSlot = createCanonicalPattern()
    duplicateSlot.slots[1]!.id = SLOT_RESEARCH_ID
    expect(patternConfigSchema.safeParse(duplicateSlot).success).toBe(false)

    const duplicateRoute = createCanonicalPattern()
    duplicateRoute.routes[1]!.id = ROUTE_REVIEW_ID
    expect(patternConfigSchema.safeParse(duplicateRoute).success).toBe(false)
  })

  it('rejects routes whose source or target Slot does not exist', () => {
    const missingSource = createCanonicalPattern()
    missingSource.routes[0]!.sourceSlotId = '0195f076-b6e6-7ef0-98db-d721990f8899'
    expect(patternConfigSchema.safeParse(missingSource).success).toBe(false)

    const missingTarget = createCanonicalPattern()
    const target = missingTarget.routes[0]!.target
    if (target.type === 'slot') {
      target.slotId = '0195f076-b6e6-7ef0-98db-d721990f8899'
    }
    expect(patternConfigSchema.safeParse(missingTarget).success).toBe(false)
  })

  it('rejects unknown structural fields', () => {
    expect(
      patternConfigSchema.safeParse({ ...createCanonicalPattern(), selectedSlotId: null }).success,
    ).toBe(false)
  })
})

describe('Pattern template summaries', () => {
  it('distinguishes built-in and user template provenance', () => {
    expect(
      patternTemplateSummarySchema.safeParse({
        id: '0195f076-b6e6-7ef0-98db-d721990f88a0',
        source: 'built_in',
        templateKey: 'hub_and_spoke',
        kind: 'hub_and_spoke',
        name: 'Hub and spoke',
        description: null,
      }).success,
    ).toBe(true)

    expect(
      patternTemplateSummarySchema.safeParse({
        id: '0195f076-b6e6-7ef0-98db-d721990f88a1',
        source: 'user',
        templateKey: null,
        kind: 'linear_sequence',
        name: 'My review flow',
        description: 'A private saved template.',
      }).success,
    ).toBe(true)
  })

  it('rejects inconsistent template source and key combinations', () => {
    expect(
      patternTemplateSummarySchema.safeParse({
        id: '0195f076-b6e6-7ef0-98db-d721990f88a2',
        source: 'user',
        templateKey: 'linear_sequence',
        kind: 'linear_sequence',
        name: 'Invalid user template',
        description: null,
      }).success,
    ).toBe(false)
  })
})
