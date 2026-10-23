import { describe, expect, it } from 'vitest'
import fixtures from '../../fixtures/end-routing.json'
import { endNodeSchema } from './workflow'

describe('shared End binding contract fixtures', () => {
  for (const [index, config] of fixtures.valid.entries()) it(`accepts valid config ${index}`, () => {
    expect(endNodeSchema.safeParse({ id: '10000000-0000-4000-8000-000000000003', type: 'end', name: 'End', config }).success).toBe(true)
  })
  for (const [index, config] of fixtures.invalid.entries()) it(`rejects invalid config ${index}`, () => {
    expect(endNodeSchema.safeParse({ id: '10000000-0000-4000-8000-000000000003', type: 'end', name: 'End', config }).success).toBe(false)
  })
})
