import { describe, expect, it } from 'vitest'

import {
  createKnowledgeFolderInputSchema,
  createKnowledgeSpaceInputSchema,
  knowledgeFileTreeSchema,
  knowledgeGraphStatusSchema,
  knowledgeGraphOverviewSchema,
  knowledgeSpaceDetailSchema,
  knowledgeSpaceLifecycleStatusSchema,
  knowledgeSpaceSummaryPageSchema,
  prepareKnowledgeUploadInputSchema,
  prepareKnowledgeUploadSuccessSchema,
  completeKnowledgeUploadSuccessSchema,
} from './knowledge'

const id = '0195f076-b6e6-7ef0-98db-d721990f8998'
const categoryId = '0195f076-b6e6-7ef0-98db-d721990f8999'
const rootFolderId = '0195f076-b6e6-7ef0-98db-d721990f8997'
const category = { id: categoryId, name: 'Research', colorToken: null, sortOrder: 0, isDefault: true }
const summary = {
  id,
  name: 'Product Research',
  description: null,
  category,
  lifecycleStatus: 'ready',
  graphStatus: 'healthy',
  fileCount: 3,
  knowledgeFamilyCount: 2,
  openIssueCount: 0,
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-26T12:00:00.000Z',
}

describe('Knowledge Space contract', () => {
  it('accepts populated and empty canonical pages', () => {
    expect(knowledgeSpaceSummaryPageSchema.parse({ items: [], page: 1, pageSize: 20, total: 0 })).toBeTruthy()
    expect(knowledgeSpaceSummaryPageSchema.parse({ items: [summary], page: 1, pageSize: 20, total: 1 })).toBeTruthy()
  })

  it('validates create and detail contracts', () => {
    expect(createKnowledgeSpaceInputSchema.parse({ name: '  Product Research  ', categoryId })).toEqual({ name: 'Product Research', description: null, categoryId })
    expect(knowledgeSpaceDetailSchema.parse({
      ...summary,
      graphStatus: 'not_indexed',
      rootFolderId,
      revision: 1,
      lastDocumentIndexedAt: null,
      lastStewardRunAt: null,
    })).toBeTruthy()
  })

  it('validates the persisted folder tree and folder creation command', () => {
    const tree = {
      knowledgeSpaceId: id,
      rootFolderId,
      revision: 2,
      folders: [{
        id: rootFolderId,
        knowledgeSpaceId: id,
        parentFolderId: null,
        name: 'Product Research',
        sortOrder: 0,
        createdAt: '2026-08-25T12:00:00.000Z',
        updatedAt: '2026-08-25T12:00:00.000Z',
      }],
      resources: [],
    }
    expect(knowledgeFileTreeSchema.parse(tree)).toEqual(tree)
    expect(createKnowledgeFolderInputSchema.parse({
      knowledgeSpaceId: id,
      expectedRevision: 2,
      parentFolderId: rootFolderId,
      name: '  Sources  ',
    })).toEqual({ knowledgeSpaceId: id, expectedRevision: 2, parentFolderId: rootFolderId, name: 'Sources' })
    expect(() => knowledgeFileTreeSchema.parse({ ...tree, revision: 0 })).toThrow()
  })

  it('validates the staged file upload contracts', () => {
    const artifactId = '0195f076-b6e6-7ef0-98db-d721990f8992'
    const resourceId = '0195f076-b6e6-7ef0-98db-d721990f8991'
    expect(prepareKnowledgeUploadInputSchema.parse({ knowledgeSpaceId: id, folderId: rootFolderId, fileName: 'notes.md', contentType: 'text/markdown', sizeBytes: 12 })).toEqual({
      knowledgeSpaceId: id,
      folderId: rootFolderId,
      fileName: 'notes.md',
      contentType: 'text/markdown',
      sizeBytes: 12,
    })
    expect(prepareKnowledgeUploadSuccessSchema.parse({
      resourceId,
      artifactId,
      uploadUrl: 'http://localhost:9000/knowledge/notes',
      method: 'PUT',
      requiredHeaders: { 'Content-Type': 'text/markdown' },
      expiresAt: '2026-08-25T12:15:00.000Z',
    })).toBeTruthy()
    expect(completeKnowledgeUploadSuccessSchema.parse({
      resource: {
        id: resourceId,
        knowledgeSpaceId: id,
        folderId: rootFolderId,
        name: 'notes.md',
        status: 'indexing',
        mimeType: 'text/markdown',
        sizeBytes: 12,
        createdAt: '2026-08-25T12:00:00.000Z',
        updatedAt: '2026-08-25T12:00:01.000Z',
      },
      knowledgeSpaceRevision: 3,
    })).toBeTruthy()
  })

  it('freezes every lifecycle and graph value', () => {
    for (const value of ['initializing', 'ready', 'syncing', 'failed']) expect(knowledgeSpaceLifecycleStatusSchema.parse(value)).toBe(value)
    for (const value of ['not_indexed', 'healthy', 'needs_review', 'error']) expect(knowledgeGraphStatusSchema.parse(value)).toBe(value)
  })

  it('validates the read-only graph projection independently from workflow graphs', () => {
    const resourceId = '0195f076-b6e6-7ef0-98db-d721990f8991'
    const targetId = '0195f076-b6e6-7ef0-98db-d721990f8992'
    const tagId = '0195f076-b6e6-7ef0-98db-d721990f8993'
    const relationId = '0195f076-b6e6-7ef0-98db-d721990f8994'
    expect(knowledgeGraphOverviewSchema.parse({
      knowledgeSpaceId: id,
      status: 'healthy',
      generatedAt: '2026-08-26T12:00:00.000Z',
      nodes: [
        { id: resourceId, name: 'one.md', status: 'indexed', summary: null, guide: null, tags: [{ id: tagId, name: 'Core', colorToken: null }], issueIds: [] },
        { id: targetId, name: 'two.md', status: 'indexed', summary: 'Two', guide: null, tags: [], issueIds: [] },
      ],
      edges: [{ id: relationId, sourceResourceId: resourceId, targetResourceId: targetId, kind: 'references', status: 'active', confidence: 0.9, description: null }],
      families: [{ id: tagId, name: 'Core', colorToken: null, resourceIds: [resourceId] }],
      issues: [],
    }).edges[0]?.kind).toBe('references')
    expect(() => knowledgeGraphOverviewSchema.parse({ knowledgeSpaceId: id, status: 'not_indexed', generatedAt: null, nodes: [], edges: [], families: [], issues: [], workflowNodes: [] })).toThrow()
  })

  it('rejects extra fields and invalid boundary values', () => {
    expect(() => knowledgeSpaceSummaryPageSchema.parse({ items: [], page: 0, pageSize: 101, total: -1 })).toThrow()
    expect(() => knowledgeSpaceSummaryPageSchema.parse({ items: [], page: 1, pageSize: 20, total: 0, workspaceId: id })).toThrow()
    expect(() => knowledgeSpaceDetailSchema.parse({ ...summary, rootFolderId, revision: 0, lastDocumentIndexedAt: null, lastStewardRunAt: null })).toThrow()
  })
})
