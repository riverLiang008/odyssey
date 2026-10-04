import { describe, expect, it } from 'vitest'
import fixtures from '../fixtures/system-tools.json'
import { toolStepSchema } from './workflow/tools'
import { systemToolDefinitionListSchema } from './toolDefinitions'

describe('System Tool canonical contract parity', () => {
  it.each(fixtures.valid)('parses $kind', (step) => expect(toolStepSchema.safeParse(step).success).toBe(true))
  it.each(fixtures.invalid)('rejects invalid $kind', (step) => expect(toolStepSchema.safeParse(step).success).toBe(false))
  it('parses five inventory kinds and rejects example Tool names as kinds', () => {
    const inventory = fixtures.valid.map((step) => ({ id: step.id, kind: step.kind, source: 'built_in', name: step.label, category: 'test', description: null, configurationSchema: { type: 'object' }, inputSchema: {}, outputSchema: {} }))
    expect(systemToolDefinitionListSchema.parse(inventory)).toHaveLength(5)
    expect(systemToolDefinitionListSchema.safeParse([{ ...inventory[0], kind: 'web_search' }]).success).toBe(false)
    expect(systemToolDefinitionListSchema.safeParse([{ ...inventory[0], workspaceId: 'untrusted' }]).success).toBe(false)
  })
})
