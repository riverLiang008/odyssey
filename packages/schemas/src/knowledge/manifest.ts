import { z } from 'zod'

import { knowledgeRelationKindSchema } from './knowledge'

const manifestKeySchema = z.string().trim().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export function canonicalizeKnowledgeManifestPath(value: string): string {
  const normalized = value.trim().replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('INVALID_DOCUMENT_PATH')
  }
  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('INVALID_DOCUMENT_PATH')
  }
  return segments.join('/')
}

const manifestDocumentPathSchema = z
  .string()
  .max(1024)
  .transform((value, context) => {
    try {
      return canonicalizeKnowledgeManifestPath(value)
    } catch {
      context.addIssue({ code: 'custom', message: 'INVALID_DOCUMENT_PATH' })
      return z.NEVER
    }
  })

export const knowledgeGraphManifestDocumentStatusSchema = z.enum(['indexed', 'needs_review'])

export const knowledgeGraphManifestTagSchema = z.strictObject({
  key: manifestKeySchema,
  name: z.string().trim().min(1).max(255),
  colorToken: z.string().trim().min(1).max(64).nullable().optional().default(null),
})

export const knowledgeGraphManifestDocumentSchema = z.strictObject({
  key: manifestKeySchema,
  path: manifestDocumentPathSchema,
  summary: z.string().trim().max(10_000).nullable().optional().default(null),
  guide: z.string().trim().max(10_000).nullable().optional().default(null),
  tags: z.array(manifestKeySchema).max(100).optional().default([]),
  status: knowledgeGraphManifestDocumentStatusSchema.optional().default('indexed'),
})

export const knowledgeGraphManifestRelationSchema = z.strictObject({
  key: manifestKeySchema,
  source: manifestKeySchema,
  target: manifestKeySchema,
  kind: knowledgeRelationKindSchema,
  status: z.enum(['active', 'needs_review']).optional().default('active'),
  confidence: z.number().min(0).max(1).nullable().optional().default(null),
  description: z.string().trim().max(4000).nullable().optional().default(null),
})

export const knowledgeGraphManifestIssueSchema = z.strictObject({
  key: manifestKeySchema,
  kind: z.enum([
    'unlinked_document',
    'broken_reference',
    'possible_duplicate',
    'possible_conflict',
    'missing_metadata',
    'stale_document',
    'family_assignment_review',
  ]),
  severity: z.enum(['info', 'warning', 'error']),
  resolutionStatus: z.enum(['open', 'accepted', 'resolved', 'dismissed']).optional().default('open'),
  title: z.string().trim().min(1).max(255),
  message: z.string().trim().max(10_000).nullable().optional().default(null),
  resourceKeys: z.array(manifestKeySchema).max(100).optional().default([]),
  relationKeys: z.array(manifestKeySchema).max(100).optional().default([]),
})

const knowledgeGraphManifestBaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  key: manifestKeySchema,
  documents: z.array(knowledgeGraphManifestDocumentSchema).min(1).max(500),
  tags: z.array(knowledgeGraphManifestTagSchema).max(200).optional().default([]),
  relations: z.array(knowledgeGraphManifestRelationSchema).max(2_000).optional().default([]),
  issues: z.array(knowledgeGraphManifestIssueSchema).max(1_000).optional().default([]),
  graph: z.strictObject({
    status: z.enum(['healthy', 'needs_review']),
  }),
})

function addDuplicateIssues(
  values: readonly { key: string }[],
  collectionName: string,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (seen.has(value.key)) {
      context.addIssue({ code: 'custom', path: [collectionName, index, 'key'], message: 'DUPLICATE_KEY' })
    }
    seen.add(value.key)
  })
}

export const knowledgeGraphManifestSchema = knowledgeGraphManifestBaseSchema.superRefine((manifest, context) => {
  addDuplicateIssues(manifest.documents, 'documents', context)
  addDuplicateIssues(manifest.tags, 'tags', context)
  addDuplicateIssues(manifest.relations, 'relations', context)
  addDuplicateIssues(manifest.issues, 'issues', context)

  const documentKeys = new Set(manifest.documents.map((document) => document.key))
  const documentPaths = new Set<string>()
  const tagKeys = new Set(manifest.tags.map((tag) => tag.key))
  const relationKeys = new Set(manifest.relations.map((relation) => relation.key))

  manifest.documents.forEach((document, documentIndex) => {
    if (documentPaths.has(document.path)) {
      context.addIssue({ code: 'custom', path: ['documents', documentIndex, 'path'], message: 'DUPLICATE_DOCUMENT_PATH' })
    }
    documentPaths.add(document.path)
    document.tags.forEach((tagKey, tagIndex) => {
      if (!tagKeys.has(tagKey)) context.addIssue({ code: 'custom', path: ['documents', documentIndex, 'tags', tagIndex], message: 'TAG_NOT_FOUND' })
    })
  })
  manifest.relations.forEach((relation, relationIndex) => {
    if (!documentKeys.has(relation.source)) context.addIssue({ code: 'custom', path: ['relations', relationIndex, 'source'], message: 'DOCUMENT_NOT_FOUND' })
    if (!documentKeys.has(relation.target)) context.addIssue({ code: 'custom', path: ['relations', relationIndex, 'target'], message: 'DOCUMENT_NOT_FOUND' })
    if (relation.source === relation.target) context.addIssue({ code: 'custom', path: ['relations', relationIndex, 'target'], message: 'SELF_RELATION' })
  })
  manifest.issues.forEach((issue, issueIndex) => {
    issue.resourceKeys.forEach((resourceKey, resourceIndex) => {
      if (!documentKeys.has(resourceKey)) context.addIssue({ code: 'custom', path: ['issues', issueIndex, 'resourceKeys', resourceIndex], message: 'DOCUMENT_NOT_FOUND' })
    })
    issue.relationKeys.forEach((relationKey, relationIndex) => {
      if (!relationKeys.has(relationKey)) context.addIssue({ code: 'custom', path: ['issues', issueIndex, 'relationKeys', relationIndex], message: 'RELATION_NOT_FOUND' })
    })
  })

  const hasOpenWarning = manifest.issues.some((issue) => issue.resolutionStatus === 'open' && (issue.severity === 'warning' || issue.severity === 'error'))
  const hasReviewRelation = manifest.relations.some((relation) => relation.status === 'needs_review')
  if (manifest.graph.status === 'healthy' && (hasOpenWarning || hasReviewRelation)) {
    context.addIssue({ code: 'custom', path: ['graph', 'status'], message: 'GRAPH_STATUS_INCONSISTENT' })
  }
  if (manifest.graph.status === 'needs_review' && !hasOpenWarning && !hasReviewRelation) {
    context.addIssue({ code: 'custom', path: ['graph', 'status'], message: 'GRAPH_STATUS_INCONSISTENT' })
  }
})

export const knowledgeGraphManifestValidationIssueSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
  code: z.enum([
    'MANIFEST_INVALID', 'DUPLICATE_KEY', 'INVALID_DOCUMENT_PATH',
    'DUPLICATE_DOCUMENT_PATH', 'DOCUMENT_FILE_NOT_FOUND', 'DOCUMENT_PATH_AMBIGUOUS',
    'DOCUMENT_NOT_FOUND', 'TAG_NOT_FOUND', 'DUPLICATE_TAG_NAME', 'RELATION_NOT_FOUND', 'SELF_RELATION',
    'GRAPH_STATUS_INCONSISTENT',
  ]),
  message: z.string().max(1000).nullable().optional().default(null),
})

export const validateKnowledgeGraphManifestRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  manifest: knowledgeGraphManifestSchema,
})

export const validateKnowledgeGraphManifestResultSchema = z.strictObject({
  validationToken: z.string().min(1).nullable(),
  manifestChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  knowledgeSpaceRevision: z.number().int().positive(),
  status: z.enum(['valid', 'invalid']),
  matchedDocumentCount: z.number().int().nonnegative(),
  unmatchedDocumentCount: z.number().int().nonnegative(),
  summaryUpdateCount: z.number().int().nonnegative(),
  guideUpdateCount: z.number().int().nonnegative(),
  tagCount: z.number().int().nonnegative(),
  relationCount: z.number().int().nonnegative(),
  issueCount: z.number().int().nonnegative(),
  resultingGraphStatus: z.enum(['healthy', 'needs_review']).nullable(),
  issues: z.array(knowledgeGraphManifestValidationIssueSchema),
})

export const applyKnowledgeGraphManifestRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  validationToken: z.string().min(1),
  manifestChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  manifest: knowledgeGraphManifestSchema,
})

export const applyKnowledgeGraphManifestResultSchema = z.strictObject({
  status: z.enum(['applied', 'already_up_to_date']),
  manifestChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  knowledgeSpaceRevision: z.number().int().positive(),
})

export type KnowledgeGraphManifest = z.infer<typeof knowledgeGraphManifestSchema>
export type KnowledgeGraphManifestDocument = z.infer<typeof knowledgeGraphManifestDocumentSchema>
export type KnowledgeGraphManifestTag = z.infer<typeof knowledgeGraphManifestTagSchema>
export type KnowledgeGraphManifestRelation = z.infer<typeof knowledgeGraphManifestRelationSchema>
export type KnowledgeGraphManifestIssue = z.infer<typeof knowledgeGraphManifestIssueSchema>
export type KnowledgeGraphManifestValidationIssue = z.infer<typeof knowledgeGraphManifestValidationIssueSchema>
export type ValidateKnowledgeGraphManifestRequest = z.infer<typeof validateKnowledgeGraphManifestRequestSchema>
export type ValidateKnowledgeGraphManifestResult = z.infer<typeof validateKnowledgeGraphManifestResultSchema>
export type ApplyKnowledgeGraphManifestRequest = z.infer<typeof applyKnowledgeGraphManifestRequestSchema>
export type ApplyKnowledgeGraphManifestResult = z.infer<typeof applyKnowledgeGraphManifestResultSchema>
