import { describe, expect, it } from 'vitest'

import {
  knowledgeGraphStatusSchema,
  knowledgeSpaceLifecycleStatusSchema,
  knowledgeSpaceSummaryPageSchema,
} from './knowledge'

const id = '0195f076-b6e6-7ef0-98db-d721990f8998'
const categoryId = '0195f076-b6e6-7ef0-98db-d721990f8999'

describe('Knowledge Space inventory contract', () => {
  it('accepts populated and empty canonical pages', () => {
    expect(knowledgeSpaceSummaryPageSchema.parse({ items: [], page: 1, pageSize: 20, total: 0 })).toBeTruthy()
    expect(knowledgeSpaceSummaryPageSchema.parse({
      items: [{ id, name: 'Product Research', description: null, knowledgeSpaceCategoryId: categoryId, lifecycleStatus: 'ready', graphStatus: 'healthy', updatedAt: '2026-08-26T12:00:00.000Z' }],
      page: 1,
      pageSize: 20,
      total: 1,
    })).toBeTruthy()
  })

  it('freezes every lifecycle and graph value', () => {
    for (const value of ['initializing', 'ready', 'syncing', 'failed']) expect(knowledgeSpaceLifecycleStatusSchema.parse(value)).toBe(value)
    for (const value of ['not_indexed', 'healthy', 'needs_review', 'error']) expect(knowledgeGraphStatusSchema.parse(value)).toBe(value)
  })

  it('rejects extra fields and invalid boundary values', () => {
    expect(() => knowledgeSpaceSummaryPageSchema.parse({ items: [], page: 0, pageSize: 101, total: -1 })).toThrow()
    expect(() => knowledgeSpaceSummaryPageSchema.parse({ items: [], page: 1, pageSize: 20, total: 0, workspaceId: id })).toThrow()
  })
})
