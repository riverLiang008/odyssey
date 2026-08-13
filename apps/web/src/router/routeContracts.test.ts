import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { FIXTURE_IDS } from '@/fixtures'
import { parseAgentWorkflowRoute, parseJourneyRoute, parseJourneyTab, routeLocations } from './routeContracts'

describe('route contracts', () => {
  it('parses UUID route identities and normalizes unknown tabs', () => {
    expect(parseJourneyRoute(FIXTURE_IDS.journey, 'agent')).toEqual({ journeyId: FIXTURE_IDS.journey, tab: 'agent' })
    expect(parseJourneyRoute(FIXTURE_IDS.journey, 'unknown')?.tab).toBe('pattern')
    expect(parseJourneyTab(['execution', 'agent'])).toBe('execution')
  })

  it('rejects invalid or repeated identity params', () => {
    expect(parseJourneyRoute('not-a-uuid')).toBeNull()
    expect(parseJourneyRoute([FIXTURE_IDS.journey])).toBeNull()
    expect(parseAgentWorkflowRoute(FIXTURE_IDS.journey, 'nope')).toBeNull()
  })

  it('builds named locations without UI state', () => {
    expect(routeLocations.journey(uuidSchema.parse(FIXTURE_IDS.journey))).toEqual({
      name: 'journey-editor', params: { journeyId: FIXTURE_IDS.journey }, query: { tab: 'pattern' },
    })
  })
})
