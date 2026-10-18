import { z } from 'zod'

import { utcTimestampSchema, uuidSchema } from '../common'

export const knowledgeSpaceLifecycleStatusSchema = z.enum([
  'initializing',
  'ready',
  'syncing',
  'failed',
  'archived',
])

export const knowledgeGraphStatusSchema = z.enum([
  'not_indexed',
  'healthy',
  'needs_review',
  'error',
])

export const knowledgeSpaceCategorySummarySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1).max(255),
  colorToken: z.string().trim().min(1).max(64).nullable(),
  sortOrder: z.number().int().nonnegative(),
  isDefault: z.boolean(),
})

export const createKnowledgeSpaceCategoryInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  colorToken: z.string().trim().min(1).max(64).nullable().optional().default(null),
})

export const knowledgeSpaceSummarySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1).max(255),
  description: z.string().nullable(),
  category: knowledgeSpaceCategorySummarySchema,
  lifecycleStatus: knowledgeSpaceLifecycleStatusSchema,
  graphStatus: knowledgeGraphStatusSchema,
  fileCount: z.number().int().nonnegative(),
  knowledgeFamilyCount: z.number().int().nonnegative(),
  openIssueCount: z.number().int().nonnegative(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
})

export const knowledgeSpaceDetailSchema = knowledgeSpaceSummarySchema.extend({
  rootFolderId: uuidSchema,
  revision: z.number().int().positive(),
  lastDocumentIndexedAt: utcTimestampSchema.nullable(),
  lastStewardRunAt: utcTimestampSchema.nullable(),
})

export const createKnowledgeSpaceInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).nullable().optional().default(null),
  categoryId: uuidSchema,
})

export const updateKnowledgeSpaceInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  expectedRevision: z.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).nullable(),
  categoryId: uuidSchema,
})

export const knowledgeSpaceRevisionCommandSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  expectedRevision: z.number().int().positive(),
})

export const deleteKnowledgeSpaceSuccessSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
})

export const knowledgeFolderSummarySchema = z.strictObject({
  id: uuidSchema,
  knowledgeSpaceId: uuidSchema,
  parentFolderId: uuidSchema.nullable(),
  name: z.string().trim().min(1).max(255),
  sortOrder: z.number().int().nonnegative(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
})

export const knowledgeResourceStatusSchema = z.enum([
  'pending',
  'indexing',
  'indexed',
  'needs_review',
  'unsupported',
  'failed',
])

export const knowledgeResourceSummarySchema = z.strictObject({
  id: uuidSchema,
  knowledgeSpaceId: uuidSchema,
  folderId: uuidSchema,
  name: z.string().trim().min(1).max(255),
  status: knowledgeResourceStatusSchema,
  mimeType: z.string().trim().min(1).max(255).nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
})

export const knowledgeResourceDetailSchema = knowledgeResourceSummarySchema.extend({
  summary: z.string().nullable(),
  guide: z.string().nullable(),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  lastIndexedAt: utcTimestampSchema.nullable(),
  downloadUrl: z.url(),
  downloadExpiresAt: utcTimestampSchema,
})

export const knowledgeFileTreeSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  rootFolderId: uuidSchema,
  revision: z.number().int().positive(),
  folders: z.array(knowledgeFolderSummarySchema),
  resources: z.array(knowledgeResourceSummarySchema),
})

export const knowledgeGraphTagSchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1).max(255),
  colorToken: z.string().trim().min(1).max(64).nullable(),
})

export const knowledgeGraphNodeSchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1).max(255),
  status: knowledgeResourceStatusSchema,
  summary: z.string().nullable(),
  guide: z.string().nullable(),
  tags: z.array(knowledgeGraphTagSchema),
  issueIds: z.array(uuidSchema),
})

export const knowledgeRelationKindSchema = z.enum([
  'references',
  'builds_on',
  'explains',
  'supports',
  'contradicts',
  'supersedes',
  'related_to',
])

export const knowledgeGraphEdgeSchema = z.strictObject({
  id: uuidSchema,
  sourceResourceId: uuidSchema,
  targetResourceId: uuidSchema,
  kind: knowledgeRelationKindSchema,
  status: z.enum(['active', 'needs_review']),
  confidence: z.number().min(0).max(1).nullable(),
  description: z.string().nullable(),
})

export const knowledgeGraphFamilySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().trim().min(1).max(255),
  colorToken: z.string().trim().min(1).max(64).nullable(),
  resourceIds: z.array(uuidSchema),
})

export const knowledgeGraphIssueSchema = z.strictObject({
  id: uuidSchema,
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
  resolutionStatus: z.enum(['open', 'accepted', 'resolved', 'dismissed']),
  title: z.string().trim().min(1).max(255),
  message: z.string().nullable(),
  resourceIds: z.array(uuidSchema),
  relationIds: z.array(uuidSchema),
})

export const knowledgeGraphOverviewSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  status: knowledgeGraphStatusSchema,
  generatedAt: utcTimestampSchema.nullable(),
  nodes: z.array(knowledgeGraphNodeSchema),
  edges: z.array(knowledgeGraphEdgeSchema),
  families: z.array(knowledgeGraphFamilySchema),
  issues: z.array(knowledgeGraphIssueSchema),
})

export const createKnowledgeFolderInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  expectedRevision: z.number().int().positive(),
  parentFolderId: uuidSchema,
  name: z.string().trim().min(1).max(255),
})

export const createKnowledgeFolderSuccessSchema = z.strictObject({
  folder: knowledgeFolderSummarySchema,
  knowledgeSpaceRevision: z.number().int().positive(),
})

export const moveKnowledgeResourceInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  resourceId: uuidSchema,
  targetFolderId: uuidSchema,
  expectedRevision: z.number().int().positive(),
})

export const moveKnowledgeResourceSuccessSchema = z.strictObject({
  resource: knowledgeResourceSummarySchema,
  knowledgeSpaceRevision: z.number().int().positive(),
})

export const deleteKnowledgeResourceInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  resourceId: uuidSchema,
  expectedRevision: z.number().int().positive(),
})

export const deleteKnowledgeResourceSuccessSchema = z.strictObject({
  resourceId: uuidSchema,
  knowledgeSpaceRevision: z.number().int().positive(),
})

export const updateKnowledgeResourceContentInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  resourceId: uuidSchema,
  expectedRevision: z.number().int().positive(),
  content: z.string().max(2_000_000),
})

export const updateKnowledgeResourceContentSuccessSchema = z.strictObject({
  resource: knowledgeResourceSummarySchema,
  knowledgeSpaceRevision: z.number().int().positive(),
})

export const prepareKnowledgeUploadInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  folderId: uuidSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
})

export const prepareKnowledgeUploadSuccessSchema = z.strictObject({
  resourceId: uuidSchema,
  artifactId: uuidSchema,
  uploadUrl: z.url(),
  method: z.literal('PUT'),
  requiredHeaders: z.record(z.string(), z.string()),
  expiresAt: utcTimestampSchema,
})

export const completeKnowledgeUploadInputSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  artifactId: uuidSchema,
  expectedRevision: z.number().int().positive(),
})

export const completeKnowledgeUploadSuccessSchema = z.strictObject({
  resource: knowledgeResourceSummarySchema,
  knowledgeSpaceRevision: z.number().int().positive(),
})

export const knowledgeSpaceSummaryPageSchema = z.strictObject({
  items: z.array(knowledgeSpaceSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
})

export type KnowledgeSpaceLifecycleStatus = z.infer<typeof knowledgeSpaceLifecycleStatusSchema>
export type KnowledgeGraphStatus = z.infer<typeof knowledgeGraphStatusSchema>
export type KnowledgeSpaceCategorySummary = z.infer<typeof knowledgeSpaceCategorySummarySchema>
export type CreateKnowledgeSpaceCategoryInput = z.infer<typeof createKnowledgeSpaceCategoryInputSchema>
export type KnowledgeSpaceSummary = z.infer<typeof knowledgeSpaceSummarySchema>
export type KnowledgeSpaceSummaryPage = z.infer<typeof knowledgeSpaceSummaryPageSchema>
export type KnowledgeSpaceDetail = z.infer<typeof knowledgeSpaceDetailSchema>
export type CreateKnowledgeSpaceInput = z.infer<typeof createKnowledgeSpaceInputSchema>
export type UpdateKnowledgeSpaceInput = z.infer<typeof updateKnowledgeSpaceInputSchema>
export type KnowledgeSpaceRevisionCommand = z.infer<typeof knowledgeSpaceRevisionCommandSchema>
export type DeleteKnowledgeSpaceSuccess = z.infer<typeof deleteKnowledgeSpaceSuccessSchema>
export type KnowledgeFolderSummary = z.infer<typeof knowledgeFolderSummarySchema>
export type KnowledgeResourceStatus = z.infer<typeof knowledgeResourceStatusSchema>
export type KnowledgeResourceSummary = z.infer<typeof knowledgeResourceSummarySchema>
export type KnowledgeResourceDetail = z.infer<typeof knowledgeResourceDetailSchema>
export type KnowledgeFileTree = z.infer<typeof knowledgeFileTreeSchema>
export type KnowledgeGraphTag = z.infer<typeof knowledgeGraphTagSchema>
export type KnowledgeGraphNode = z.infer<typeof knowledgeGraphNodeSchema>
export type KnowledgeRelationKind = z.infer<typeof knowledgeRelationKindSchema>
export type KnowledgeGraphEdge = z.infer<typeof knowledgeGraphEdgeSchema>
export type KnowledgeGraphFamily = z.infer<typeof knowledgeGraphFamilySchema>
export type KnowledgeGraphIssue = z.infer<typeof knowledgeGraphIssueSchema>
export type KnowledgeGraphOverview = z.infer<typeof knowledgeGraphOverviewSchema>
export type CreateKnowledgeFolderInput = z.infer<typeof createKnowledgeFolderInputSchema>
export type CreateKnowledgeFolderSuccess = z.infer<typeof createKnowledgeFolderSuccessSchema>
export type MoveKnowledgeResourceInput = z.infer<typeof moveKnowledgeResourceInputSchema>
export type MoveKnowledgeResourceSuccess = z.infer<typeof moveKnowledgeResourceSuccessSchema>
export type DeleteKnowledgeResourceInput = z.infer<typeof deleteKnowledgeResourceInputSchema>
export type DeleteKnowledgeResourceSuccess = z.infer<typeof deleteKnowledgeResourceSuccessSchema>
export type UpdateKnowledgeResourceContentInput = z.infer<typeof updateKnowledgeResourceContentInputSchema>
export type UpdateKnowledgeResourceContentSuccess = z.infer<typeof updateKnowledgeResourceContentSuccessSchema>
export type PrepareKnowledgeUploadInput = z.infer<typeof prepareKnowledgeUploadInputSchema>
export type PrepareKnowledgeUploadSuccess = z.infer<typeof prepareKnowledgeUploadSuccessSchema>
export type CompleteKnowledgeUploadInput = z.infer<typeof completeKnowledgeUploadInputSchema>
export type CompleteKnowledgeUploadSuccess = z.infer<typeof completeKnowledgeUploadSuccessSchema>
