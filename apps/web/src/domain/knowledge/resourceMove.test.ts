import { describe, expect, it } from 'vitest'
import { uuidSchema, type KnowledgeFileTree } from '@odyssey/schemas'
import { evaluateKnowledgeResourceMove } from './resourceMove'

const rootId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8995')
const folderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996')
const resourceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8997')
const tree: KnowledgeFileTree = {
  knowledgeSpaceId: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998'),
  rootFolderId: rootId,
  revision: 1,
  folders: [
    { id: rootId, knowledgeSpaceId: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998'), parentFolderId: null, name: 'Root', sortOrder: 0, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
    { id: folderId, knowledgeSpaceId: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998'), parentFolderId: rootId, name: 'Folder', sortOrder: 0, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  ],
  resources: [{ id: resourceId, knowledgeSpaceId: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998'), folderId: rootId, name: 'notes.md', status: 'indexed', mimeType: 'text/markdown', sizeBytes: 5, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }],
}

describe('evaluateKnowledgeResourceMove', () => {
  it('accepts a different visible target folder', () => {
    expect(evaluateKnowledgeResourceMove(tree, resourceId, folderId)).toEqual({ status: 'valid', resourceId, targetFolderId: folderId })
  })

  it('rejects a drop into the current folder', () => {
    expect(evaluateKnowledgeResourceMove(tree, resourceId, rootId)).toEqual({ status: 'invalid', reason: 'SAME_FOLDER' })
  })
})
