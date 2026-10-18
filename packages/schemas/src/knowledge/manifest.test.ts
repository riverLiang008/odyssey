import { describe, expect, it } from 'vitest'

import fixtures from '../../fixtures/knowledge-graph-manifest.json'
import {
  applyKnowledgeGraphManifestRequestSchema,
  knowledgeGraphManifestSchema,
  validateKnowledgeGraphManifestResultSchema,
} from './manifest'

const healthyManifest = {
  schemaVersion: 1,
  key: 'coffee-guide',
  documents: [
    { key: 'coffee-basics', path: 'foundations/coffee-basics.md', tags: ['foundations'] },
    { key: 'espresso', path: 'brewing/espresso.md', summary: 'Espresso extraction guide.', tags: ['brewing'] },
  ],
  tags: [
    { key: 'foundations', name: 'Foundations' },
    { key: 'brewing', name: 'Brewing', colorToken: 'knowledge-family-blue' },
  ],
  relations: [{ key: 'espresso-builds-on-basics', source: 'espresso', target: 'coffee-basics', kind: 'builds_on', confidence: 0.9 }],
  issues: [],
  graph: { status: 'healthy' },
} as const

describe('Knowledge Graph Manifest V1 contract', () => {
  it.each(fixtures.valid)('accepts the shared positive fixture $key', (manifest) => {
    expect(knowledgeGraphManifestSchema.safeParse(manifest).success).toBe(true)
  })

  it.each(fixtures.invalid)('rejects the shared negative fixture $key', (manifest) => {
    expect(knowledgeGraphManifestSchema.safeParse(manifest).success).toBe(false)
  })

  it('parses a strict healthy manifest and supplies canonical defaults', () => {
    const parsed = knowledgeGraphManifestSchema.parse(healthyManifest)
    expect(parsed.documents[0]).toMatchObject({ guide: null, status: 'indexed' })
    expect(parsed.relations[0]).toMatchObject({ status: 'active', description: null })
  })

  it('rejects unknown fields and duplicate stable keys', () => {
    expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, workspaceId: crypto.randomUUID() })).toThrow()
    expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, documents: [healthyManifest.documents[0], healthyManifest.documents[0]] })).toThrow(/DUPLICATE_KEY/)
  })

  it('normalizes root-relative document paths and rejects ambiguous paths', () => {
    const parsed = knowledgeGraphManifestSchema.parse({
      ...healthyManifest,
      documents: [{ key: 'coffee-basics', path: ' foundations\\coffee-basics.md ' }],
      tags: [],
      relations: [],
    })
    expect(parsed.documents[0]?.path).toBe('foundations/coffee-basics.md')

    for (const path of ['/absolute.md', 'C:\\absolute.md', '../escape.md', 'folder//file.md']) {
      expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, documents: [{ key: 'bad-path', path }], tags: [], relations: [] })).toThrow(/INVALID_DOCUMENT_PATH/)
    }
    expect(() => knowledgeGraphManifestSchema.parse({
      ...healthyManifest,
      documents: [
        { key: 'one', path: 'same.md' },
        { key: 'two', path: 'same.md' },
      ],
      tags: [],
      relations: [],
    })).toThrow(/DUPLICATE_DOCUMENT_PATH/)
  })

  it('does not accept system-owned graph states', () => {
    expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, graph: { status: 'error' } })).toThrow()
  })

  it('freezes Validate and Apply boundary DTOs', () => {
    const checksum = 'a'.repeat(64)
    expect(validateKnowledgeGraphManifestResultSchema.parse({
      validationToken: 'signed-token', manifestChecksum: checksum, knowledgeSpaceRevision: 7,
      status: 'valid', matchedDocumentCount: 2, unmatchedDocumentCount: 0,
      summaryUpdateCount: 1, guideUpdateCount: 0, tagCount: 2, relationCount: 1,
      issueCount: 0, resultingGraphStatus: 'healthy', issues: [],
    }).status).toBe('valid')
    expect(applyKnowledgeGraphManifestRequestSchema.safeParse({
      expectedRevision: 7, validationToken: 'signed-token', manifestChecksum: checksum,
    }).success).toBe(false)
    expect(applyKnowledgeGraphManifestRequestSchema.safeParse({
      expectedRevision: 7, validationToken: 'signed-token', manifestChecksum: checksum,
      manifest: healthyManifest,
    }).success).toBe(true)
  })

  it('rejects missing references and self relations', () => {
    expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, relations: [{ key: 'missing', source: 'unknown', target: 'espresso', kind: 'supports' }] })).toThrow(/DOCUMENT_NOT_FOUND/)
    expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, relations: [{ key: 'self', source: 'espresso', target: 'espresso', kind: 'related_to' }] })).toThrow(/SELF_RELATION/)
  })

  it('requires graph status to agree with open review data', () => {
    const issue = { key: 'conflict', kind: 'possible_conflict', severity: 'warning', title: 'Conflicting guidance', resourceKeys: ['coffee-basics', 'espresso'] }
    expect(() => knowledgeGraphManifestSchema.parse({ ...healthyManifest, issues: [issue] })).toThrow(/GRAPH_STATUS_INCONSISTENT/)
    expect(knowledgeGraphManifestSchema.parse({ ...healthyManifest, issues: [issue], graph: { status: 'needs_review' } }).graph.status).toBe('needs_review')
  })
})
