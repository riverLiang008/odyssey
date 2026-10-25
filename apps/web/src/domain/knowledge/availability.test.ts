import { describe, expect, it } from 'vitest'
import { uuidSchema, type KnowledgeSpaceSummary } from '@odyssey/schemas'
import { isKnowledgeSpaceReferenceable } from './availability'

const base: KnowledgeSpaceSummary = {
  id: uuidSchema.parse('00000000-0000-4000-8000-000000000001'),
  name: 'Docs',
  description: null,
  category: { id: uuidSchema.parse('00000000-0000-4000-8000-000000000002'), name: 'Default', colorToken: null, sortOrder: 0, isDefault: true },
  lifecycleStatus: 'ready',
  graphStatus: 'healthy',
  fileCount: 1,
  knowledgeFamilyCount: 1,
  openIssueCount: 0,
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
}

describe('isKnowledgeSpaceReferenceable', () => {
  it.each([
    ['ready', 'healthy'],
    ['ready', 'needs_review'],
    ['syncing', 'healthy'],
    ['syncing', 'needs_review'],
  ] as const)('accepts %s / %s', (lifecycleStatus, graphStatus) => {
    expect(isKnowledgeSpaceReferenceable({ ...base, lifecycleStatus, graphStatus })).toBe(true)
  })

  it.each([
    ['initializing', 'healthy'],
    ['failed', 'healthy'],
    ['archived', 'healthy'],
    ['ready', 'not_indexed'],
    ['ready', 'error'],
  ] as const)('rejects %s / %s', (lifecycleStatus, graphStatus) => {
    expect(isKnowledgeSpaceReferenceable({ ...base, lifecycleStatus, graphStatus })).toBe(false)
  })
})
