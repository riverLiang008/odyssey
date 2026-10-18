import {
  createAgentLifecycleResponseSchemas,
  addGuardrailInputSchema,
  addGuardrailSuccessSchema,
  createJourneyAgentInputSchema,
  instantiateAgentTemplateInputSchema,
  removeOccupiedSlotInputSchema,
  removeOccupiedSlotSuccessSchema,
  removeGuardrailInputSchema,
  saveAgentAsTemplateInputSchema,
  uuidSchema,
  createAgentWorkflowEditorDocumentSchema,
  journeyEditorDocumentSchema,
  saveAgentWorkflowInputSchema,
  saveAgentWorkflowSuccessSchema,
  saveJourneyInputSchema,
  saveJourneySuccessSchema,
  createJourneyInputSchema,
  deleteJourneyInputSchema,
  deleteJourneySuccessSchema,
  journeySummaryListSchema,
  createKnowledgeSpaceCategoryInputSchema,
  createKnowledgeSpaceInputSchema,
  updateKnowledgeSpaceInputSchema,
  knowledgeSpaceRevisionCommandSchema,
  knowledgeSpaceCategorySummarySchema,
  knowledgeSpaceDetailSchema,
  knowledgeFileTreeSchema,
  knowledgeGraphOverviewSchema,
  knowledgeGraphManifestSchema,
  validateKnowledgeGraphManifestResultSchema,
  applyKnowledgeGraphManifestRequestSchema,
  applyKnowledgeGraphManifestResultSchema,
  createKnowledgeFolderInputSchema,
  createKnowledgeFolderSuccessSchema,
  moveKnowledgeResourceInputSchema,
  moveKnowledgeResourceSuccessSchema,
  deleteKnowledgeResourceInputSchema,
  deleteKnowledgeResourceSuccessSchema,
  updateKnowledgeResourceContentInputSchema,
  updateKnowledgeResourceContentSuccessSchema,
  completeKnowledgeUploadSuccessSchema,
  knowledgeResourceDetailSchema,
  type SystemToolDefinition,
  type AgentTemplate,
  type AddGuardrailInput,
  type AddGuardrailSuccess,
  type AgentWorkflowEditorDocument,
  type CreateJourneyAgentInput,
  type CreateOrInstantiateAgentSuccess,
  type InstantiateAgentTemplateInput,
  type RemoveOccupiedSlotInput,
  type RemoveOccupiedSlotSuccess,
  type RemoveGuardrailInput,
  type JourneyEditorDocument,
  type JourneySummary,
  type KnowledgeSpaceSummary,
  type KnowledgeSpaceSummaryPage,
  type KnowledgeSpaceCategorySummary,
  type KnowledgeSpaceDetail,
  type CreateKnowledgeSpaceCategoryInput,
  type CreateKnowledgeSpaceInput,
  type UpdateKnowledgeSpaceInput,
  type KnowledgeSpaceRevisionCommand,
  type DeleteKnowledgeSpaceSuccess,
  type KnowledgeFileTree,
  type KnowledgeGraphOverview,
  type KnowledgeGraphManifest,
  type ValidateKnowledgeGraphManifestResult,
  type ApplyKnowledgeGraphManifestResult,
  type KnowledgeFolderSummary,
  type KnowledgeResourceSummary,
  type KnowledgeResourceDetail,
  type CreateKnowledgeFolderInput,
  type CreateKnowledgeFolderSuccess,
  type MoveKnowledgeResourceInput,
  type MoveKnowledgeResourceSuccess,
  type DeleteKnowledgeResourceInput,
  type DeleteKnowledgeResourceSuccess,
  type UpdateKnowledgeResourceContentInput,
  type UpdateKnowledgeResourceContentSuccess,
  type CompleteKnowledgeUploadSuccess,
  type CreateJourneyInput,
  type DeleteJourneyInput,
  type DeleteJourneySuccess,
  type RepositoryError,
  type RepositoryResult,
  type SaveAgentAsTemplateInput,
  type SaveAgentAsTemplateSuccess,
  type SaveAgentWorkflowInput,
  type SaveAgentWorkflowSuccess,
  type SaveJourneyInput,
  type SaveJourneySuccess,
  type UUID,
} from '@odyssey/schemas'

import {
  createMinimalAgent,
  MINIMUM_WORKFLOW_END_POSITION,
  MINIMUM_WORKFLOW_START_POSITION,
  instantiateAgentTemplate,
  saveAgentAsTemplate,
  type AgentLifecycleIdFactory,
} from '@/domain/agent-template'
import { instantiatePattern, removeSlot as removePatternSlot, unassignAgent, type PatternIdFactory } from '@/domain/pattern'
import type { AgentLifecycleRepository, EditorRepository, GuardrailLifecycleRepository, JourneyLifecycleRepository, KnowledgeResourceInspection, OdysseyEditorRepository, RepositoryOperationOptions, UploadKnowledgeFileInput } from './editorRepository'

type InjectableFailure = 'NETWORK_FAILED' | 'RESPONSE_INVALID' | 'REVISION_CONFLICT'

export interface InMemoryEditorRepositoryOptions {
  journeys?: JourneyEditorDocument[]
  agentWorkflows?: AgentWorkflowEditorDocument[]
  agentTemplates?: AgentTemplate[]
  knowledgeSpaces?: KnowledgeSpaceSummary[]
  knowledgeSpaceCategories?: KnowledgeSpaceCategorySummary[]
  latencyMs?: number
  now?: () => string
  systemVariableIds?: readonly string[]
  idFactory?: AgentLifecycleIdFactory
  patternIdFactory?: PatternIdFactory
  journeyIdFactory?: () => UUID
  developmentWorkspaceId?: UUID
}

export interface InMemoryEditorRepositoryControls {
  failNext(code: InjectableFailure): void
  transformNextCreateOrInstantiateResponse(
    transform: (response: CreateOrInstantiateAgentSuccess) => CreateOrInstantiateAgentSuccess,
  ): void
}

interface ScenarioState {
  nextFailure: InjectableFailure | null
  nextCreateOrInstantiateResponseTransform:
    | ((response: CreateOrInstantiateAgentSuccess) => CreateOrInstantiateAgentSuccess)
    | null
}

function isCreateOrInstantiateResponseForRequest(
  response: CreateOrInstantiateAgentSuccess,
  input: Pick<CreateJourneyAgentInput, 'journeyId' | 'slotId'>,
): boolean {
  if (response.journey.journey.id !== input.journeyId) return false
  if (response.agent.agent.journeyId !== input.journeyId) return false
  const targetSlot = response.journey.pattern.slots.find((slot) => slot.id === input.slotId)
  return targetSlot?.agentId === response.agent.agent.id
}

function failure(error: RepositoryError): { ok: false; error: RepositoryError } {
  return { ok: false, error }
}

function waitForLatency(latencyMs: number, signal?: AbortSignal): Promise<'completed' | 'aborted'> {
  if (signal?.aborted) return Promise.resolve('aborted')
  if (latencyMs === 0) return Promise.resolve('completed')

  return new Promise((resolve) => {
    const handle = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve('completed')
    }, latencyMs)
    const handleAbort = () => {
      clearTimeout(handle)
      signal?.removeEventListener('abort', handleAbort)
      resolve('aborted')
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

export class InMemoryEditorRepository implements EditorRepository, AgentLifecycleRepository, GuardrailLifecycleRepository, JourneyLifecycleRepository {
  readonly #journeys = new Map<string, JourneyEditorDocument>()
  readonly #agentWorkflows = new Map<string, AgentWorkflowEditorDocument>()
  readonly #agentTemplates = new Map<string, AgentTemplate>()
  readonly #knowledgeSpaces: KnowledgeSpaceSummary[]
  readonly #knowledgeSpaceCategories: KnowledgeSpaceCategorySummary[]
  readonly #knowledgeSpaceDetails = new Map<UUID, KnowledgeSpaceDetail>()
  readonly #knowledgeFolders = new Map<UUID, KnowledgeFolderSummary[]>()
  readonly #knowledgeResources = new Map<UUID, KnowledgeResourceSummary[]>()
  readonly #knowledgeResourceFiles = new Map<UUID, File>()
  readonly #latencyMs: number
  readonly #now: () => string
  readonly #scenario: ScenarioState
  readonly #agentDocumentSchema
  readonly #lifecycleSchemas
  readonly #systemVariableIds: readonly UUID[]
  readonly #idFactory: AgentLifecycleIdFactory
  readonly #patternIdFactory: PatternIdFactory
  readonly #journeyIdFactory: () => UUID
  readonly #workspaceId: UUID

  constructor(options: InMemoryEditorRepositoryOptions = {}, scenario?: ScenarioState) {
    this.#latencyMs = options.latencyMs ?? 0
    this.#now = options.now ?? (() => new Date().toISOString())
    this.#scenario = scenario ?? {
      nextFailure: null,
      nextCreateOrInstantiateResponseTransform: null,
    }
    this.#agentDocumentSchema = createAgentWorkflowEditorDocumentSchema({
      systemVariableIds: options.systemVariableIds,
    })
    this.#knowledgeSpaces = structuredClone(options.knowledgeSpaces ?? [])
    this.#knowledgeSpaceCategories = structuredClone(options.knowledgeSpaceCategories ?? [])
    this.#lifecycleSchemas = createAgentLifecycleResponseSchemas(options.systemVariableIds)
    this.#systemVariableIds = (options.systemVariableIds ?? []).map((id) => uuidSchema.parse(id))
    const nextUuid = () => uuidSchema.parse(crypto.randomUUID())
    this.#idFactory = options.idFactory ?? {
      agentId: nextUuid,
      agentTemplateId: nextUuid,
      workflowNodeId: nextUuid,
      workflowEdgeId: nextUuid,
      branchHandleId: nextUuid,
      branchConditionId: nextUuid,
      variableId: nextUuid,
      reusableToolId: nextUuid,
      toolStepId: nextUuid,
      configurationEntryId: nextUuid,
    }
    this.#patternIdFactory = options.patternIdFactory ?? {
      patternId: nextUuid,
      slotId: nextUuid,
      routeId: nextUuid,
    }
    this.#journeyIdFactory = options.journeyIdFactory ?? nextUuid
    this.#workspaceId = options.developmentWorkspaceId
      ?? options.journeys?.[0]?.journey.workspaceId
      ?? uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8000')
    for (const document of options.journeys ?? []) {
      this.#journeys.set(document.journey.id, structuredClone(document))
    }
    for (const document of options.agentWorkflows ?? []) {
      this.#agentWorkflows.set(document.agent.id, structuredClone(document))
    }
    for (const template of options.agentTemplates ?? []) {
      const parsed = this.#lifecycleSchemas.agentTemplate.safeParse(template)
      if (parsed.success) this.#agentTemplates.set(parsed.data.id, structuredClone(parsed.data))
    }
  }

  async listSystemToolDefinitions(): Promise<RepositoryResult<SystemToolDefinition[]>> {
    return { ok: true, value: [] }
  }

  async listKnowledgeSpaces(
    input: { query?: string; page?: number; pageSize?: number; includeArchived?: boolean } = {},
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceSummaryPage>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const failureResult = this.#consumeSimpleFailure()
    if (failureResult) return failureResult
    const query = input.query?.trim().toLocaleLowerCase() ?? ''
    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20
    const matched = this.#knowledgeSpaces.filter((space) => (input.includeArchived || space.lifecycleStatus !== 'archived') && (!query || space.name.toLocaleLowerCase().includes(query) || space.description?.toLocaleLowerCase().includes(query)))
    return { ok: true, value: { items: structuredClone(matched.slice((page - 1) * pageSize, page * pageSize)), page, pageSize, total: matched.length } }
  }

  async listKnowledgeSpaceCategories(options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceCategorySummary[]>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    return { ok: true, value: structuredClone(this.#knowledgeSpaceCategories) }
  }

  async createKnowledgeSpaceCategory(input: CreateKnowledgeSpaceCategoryInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceCategorySummary>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = createKnowledgeSpaceCategoryInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    if (this.#knowledgeSpaceCategories.some((category) => category.name.toLocaleLowerCase() === request.data.name.toLocaleLowerCase())) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_SPACE_CATEGORY_NAME_CONFLICT' })
    const candidate = knowledgeSpaceCategorySummarySchema.parse({ id: crypto.randomUUID(), name: request.data.name, colorToken: request.data.colorToken, sortOrder: this.#knowledgeSpaceCategories.length, isDefault: false })
    this.#knowledgeSpaceCategories.push(candidate)
    return { ok: true, value: structuredClone(candidate) }
  }

  async createKnowledgeSpace(input: CreateKnowledgeSpaceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = createKnowledgeSpaceInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const category = this.#knowledgeSpaceCategories.find((candidate) => candidate.id === request.data.categoryId)
    if (!category) return failure({ code: 'NOT_FOUND' })
    if (this.#knowledgeSpaces.some((space) => space.name.toLocaleLowerCase() === request.data.name.toLocaleLowerCase())) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_SPACE_NAME_CONFLICT' })
    const timestamp = this.#now()
    const detail = knowledgeSpaceDetailSchema.parse({ id: crypto.randomUUID(), rootFolderId: crypto.randomUUID(), name: request.data.name, description: request.data.description, category, lifecycleStatus: 'ready', graphStatus: 'not_indexed', fileCount: 0, knowledgeFamilyCount: 0, openIssueCount: 0, revision: 1, lastDocumentIndexedAt: null, lastStewardRunAt: null, createdAt: timestamp, updatedAt: timestamp })
    this.#knowledgeSpaces.push(detail)
    this.#knowledgeSpaceDetails.set(detail.id, detail)
    this.#knowledgeFolders.set(detail.id, [{ id: detail.rootFolderId, knowledgeSpaceId: detail.id, parentFolderId: null, name: detail.name, sortOrder: 0, createdAt: timestamp, updatedAt: timestamp }])
    this.#knowledgeResources.set(detail.id, [])
    return { ok: true, value: structuredClone(detail) }
  }

  async loadKnowledgeSpace(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const detail = this.#knowledgeSpaceDetails.get(knowledgeSpaceId)
    return detail ? { ok: true, value: structuredClone(detail) } : failure({ code: 'NOT_FOUND' })
  }

  async updateKnowledgeSpace(input: UpdateKnowledgeSpaceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = updateKnowledgeSpaceInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const current = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!current) return failure({ code: 'NOT_FOUND' })
    if (current.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: current.revision })
    const category = this.#knowledgeSpaceCategories.find((candidate) => candidate.id === request.data.categoryId)
    if (!category) return failure({ code: 'NOT_FOUND' })
    if (this.#knowledgeSpaces.some((space) => space.id !== current.id && space.name.toLocaleLowerCase() === request.data.name.toLocaleLowerCase())) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_SPACE_NAME_CONFLICT' })
    const updated = knowledgeSpaceDetailSchema.parse({ ...current, name: request.data.name, description: request.data.description, category, revision: current.revision + 1, updatedAt: this.#now() })
    this.#replaceKnowledgeSpace(updated)
    return { ok: true, value: structuredClone(updated) }
  }

  async archiveKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    return this.#setKnowledgeSpaceLifecycle(input, 'archived', options)
  }

  async unarchiveKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    return this.#setKnowledgeSpaceLifecycle(input, 'ready', options)
  }

  async #setKnowledgeSpaceLifecycle(input: KnowledgeSpaceRevisionCommand, lifecycleStatus: 'archived' | 'ready', options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = knowledgeSpaceRevisionCommandSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const current = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!current) return failure({ code: 'NOT_FOUND' })
    if (current.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: current.revision })
    const updated = knowledgeSpaceDetailSchema.parse({ ...current, lifecycleStatus, revision: current.revision + 1, updatedAt: this.#now() })
    this.#replaceKnowledgeSpace(updated)
    return { ok: true, value: structuredClone(updated) }
  }

  async deleteKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteKnowledgeSpaceSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = knowledgeSpaceRevisionCommandSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const current = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!current) return failure({ code: 'NOT_FOUND' })
    if (current.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: current.revision })
    if (current.fileCount > 0) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_SPACE_HAS_DOCUMENTS' })
    this.#knowledgeSpaceDetails.delete(current.id)
    const index = this.#knowledgeSpaces.findIndex((space) => space.id === current.id)
    if (index >= 0) this.#knowledgeSpaces.splice(index, 1)
    return { ok: true, value: { knowledgeSpaceId: current.id } }
  }

  async loadKnowledgeFileTree(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeFileTree>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const detail = this.#knowledgeSpaceDetails.get(knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    const parsed = knowledgeFileTreeSchema.safeParse({ knowledgeSpaceId, rootFolderId: detail.rootFolderId, revision: detail.revision, folders: this.#knowledgeFolders.get(knowledgeSpaceId) ?? [], resources: this.#knowledgeResources.get(knowledgeSpaceId) ?? [] })
    return parsed.success ? { ok: true, value: structuredClone(parsed.data) } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadKnowledgeGraph(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeGraphOverview>> {
    if (options?.signal?.aborted) return failure({ code: 'ABORTED' })
    const detail = this.#knowledgeSpaceDetails.get(knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    const graph = knowledgeGraphOverviewSchema.parse({
      knowledgeSpaceId,
      status: detail.graphStatus,
      generatedAt: detail.lastDocumentIndexedAt,
      nodes: [],
      edges: [],
      families: [],
      issues: [],
    })
    return { ok: true, value: graph }
  }

  async validateKnowledgeGraphManifest(knowledgeSpaceId: UUID, expectedRevision: number, manifest: KnowledgeGraphManifest, options?: RepositoryOperationOptions): Promise<RepositoryResult<ValidateKnowledgeGraphManifestResult>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const detail = this.#knowledgeSpaceDetails.get(knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision, currentRevision: detail.revision })
    const parsed = knowledgeGraphManifestSchema.safeParse(manifest)
    if (!parsed.success) return failure({ code: 'REQUEST_INVALID' })
    const resourceNames = new Set((this.#knowledgeResources.get(knowledgeSpaceId) ?? []).map((resource) => resource.name))
    const unmatched = parsed.data.documents.filter((document) => !resourceNames.has(document.path.split('/').at(-1) ?? '')).length
    const checksumBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parsed.data)))
    const manifestChecksum = [...new Uint8Array(checksumBytes)].map((value) => value.toString(16).padStart(2, '0')).join('')
    return { ok: true, value: validateKnowledgeGraphManifestResultSchema.parse({
      validationToken: unmatched === 0 ? `in-memory:${knowledgeSpaceId}:${expectedRevision}:${manifestChecksum}` : null,
      manifestChecksum,
      knowledgeSpaceRevision: expectedRevision,
      status: unmatched === 0 ? 'valid' : 'invalid',
      matchedDocumentCount: parsed.data.documents.length - unmatched,
      unmatchedDocumentCount: unmatched,
      summaryUpdateCount: parsed.data.documents.filter((document) => document.summary !== null).length,
      guideUpdateCount: parsed.data.documents.filter((document) => document.guide !== null).length,
      tagCount: parsed.data.tags.length,
      relationCount: parsed.data.relations.length,
      issueCount: parsed.data.issues.length,
      resultingGraphStatus: unmatched === 0 ? parsed.data.graph.status : null,
      issues: unmatched === 0 ? [] : [{ path: ['documents'], code: 'DOCUMENT_FILE_NOT_FOUND', message: null }],
    }) }
  }

  async applyKnowledgeGraphManifest(knowledgeSpaceId: UUID, input: { expectedRevision: number; validationToken: string; manifestChecksum: string; manifest: KnowledgeGraphManifest }, options?: RepositoryOperationOptions): Promise<RepositoryResult<ApplyKnowledgeGraphManifestResult>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = applyKnowledgeGraphManifestRequestSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const detail = this.#knowledgeSpaceDetails.get(knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: detail.revision })
    const updated = knowledgeSpaceDetailSchema.parse({
      ...detail,
      graphStatus: request.data.manifest.graph.status,
      knowledgeFamilyCount: request.data.manifest.tags.length,
      openIssueCount: request.data.manifest.issues.filter((issue) => issue.resolutionStatus === 'open').length,
      lastDocumentIndexedAt: this.#now(),
      revision: detail.revision + 1,
      updatedAt: this.#now(),
    })
    this.#replaceKnowledgeSpace(updated)
    return { ok: true, value: applyKnowledgeGraphManifestResultSchema.parse({ status: 'applied', manifestChecksum: request.data.manifestChecksum, knowledgeSpaceRevision: updated.revision }) }
  }

  async loadKnowledgeResource(knowledgeSpaceId: UUID, resourceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeResourceInspection>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const resource = (this.#knowledgeResources.get(knowledgeSpaceId) ?? []).find((candidate) => candidate.id === resourceId)
    const file = this.#knowledgeResourceFiles.get(resourceId)
    if (!resource || !file) return failure({ code: 'NOT_FOUND' })
    const detail: KnowledgeResourceDetail = knowledgeResourceDetailSchema.parse({
      ...resource,
      summary: null,
      guide: null,
      checksumSha256: null,
      lastIndexedAt: null,
      downloadUrl: `https://example.test/knowledge-resources/${resource.id}`,
      downloadExpiresAt: this.#now(),
    })
    const isText = detail.mimeType === 'text/plain' || detail.mimeType === 'text/markdown' || detail.mimeType === 'application/json'
    const content = isText ? await readFileText(file) : null
    return { ok: true, value: { detail, preview: content === null ? { type: 'external' } : { type: 'text', content, truncated: false } } }
  }

  async createKnowledgeFolder(input: CreateKnowledgeFolderInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateKnowledgeFolderSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = createKnowledgeFolderInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const detail = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: detail.revision })
    const folders = this.#knowledgeFolders.get(detail.id) ?? []
    if (!folders.some((folder) => folder.id === request.data.parentFolderId)) return failure({ code: 'NOT_FOUND' })
    if (folders.some((folder) => folder.parentFolderId === request.data.parentFolderId && folder.name.toLocaleLowerCase() === request.data.name.toLocaleLowerCase())) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_FOLDER_NAME_CONFLICT' })
    const timestamp = this.#now()
    const folder: KnowledgeFolderSummary = { id: uuidSchema.parse(crypto.randomUUID()), knowledgeSpaceId: detail.id, parentFolderId: request.data.parentFolderId, name: request.data.name, sortOrder: 0, createdAt: timestamp, updatedAt: timestamp }
    folders.push(folder)
    this.#knowledgeFolders.set(detail.id, folders)
    const updated = knowledgeSpaceDetailSchema.parse({ ...detail, revision: detail.revision + 1, updatedAt: timestamp })
    this.#replaceKnowledgeSpace(updated)
    const parsed = createKnowledgeFolderSuccessSchema.parse({ folder, knowledgeSpaceRevision: updated.revision })
    return { ok: true, value: structuredClone(parsed) }
  }

  async moveKnowledgeResource(input: MoveKnowledgeResourceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<MoveKnowledgeResourceSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = moveKnowledgeResourceInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const detail = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: detail.revision })
    if (!(this.#knowledgeFolders.get(detail.id) ?? []).some((folder) => folder.id === request.data.targetFolderId)) return failure({ code: 'NOT_FOUND' })
    const resources = this.#knowledgeResources.get(detail.id) ?? []
    const resourceIndex = resources.findIndex((resource) => resource.id === request.data.resourceId)
    if (resourceIndex < 0) return failure({ code: 'NOT_FOUND' })
    const resource = resources[resourceIndex]
    if (!resource) return failure({ code: 'NOT_FOUND' })
    if (resource.folderId === request.data.targetFolderId) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_RESOURCE_ALREADY_IN_FOLDER' })
    const timestamp = this.#now()
    const moved = { ...resource, folderId: request.data.targetFolderId, updatedAt: timestamp }
    resources.splice(resourceIndex, 1, moved)
    this.#knowledgeResources.set(detail.id, resources)
    const updated = knowledgeSpaceDetailSchema.parse({ ...detail, revision: detail.revision + 1, updatedAt: timestamp })
    this.#replaceKnowledgeSpace(updated)
    const parsed = moveKnowledgeResourceSuccessSchema.safeParse({ resource: moved, knowledgeSpaceRevision: updated.revision })
    return parsed.success ? { ok: true, value: structuredClone(parsed.data) } : failure({ code: 'RESPONSE_INVALID' })
  }

  async deleteKnowledgeResource(input: DeleteKnowledgeResourceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteKnowledgeResourceSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = deleteKnowledgeResourceInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const detail = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: detail.revision })
    const resources = this.#knowledgeResources.get(detail.id) ?? []
    const resourceIndex = resources.findIndex((resource) => resource.id === request.data.resourceId)
    if (resourceIndex < 0) return failure({ code: 'NOT_FOUND' })
    resources.splice(resourceIndex, 1)
    this.#knowledgeResourceFiles.delete(request.data.resourceId)
    const updated = knowledgeSpaceDetailSchema.parse({ ...detail, revision: detail.revision + 1, fileCount: Math.max(0, detail.fileCount - 1), updatedAt: this.#now() })
    this.#replaceKnowledgeSpace(updated)
    const parsed = deleteKnowledgeResourceSuccessSchema.parse({ resourceId: request.data.resourceId, knowledgeSpaceRevision: updated.revision })
    return { ok: true, value: structuredClone(parsed) }
  }

  async updateKnowledgeResourceContent(input: UpdateKnowledgeResourceContentInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<UpdateKnowledgeResourceContentSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const request = updateKnowledgeResourceContentInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'VALIDATION_FAILED', issues: request.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'), code: issue.code })) })
    const detail = this.#knowledgeSpaceDetails.get(request.data.knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== request.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: request.data.expectedRevision, currentRevision: detail.revision })
    const resources = this.#knowledgeResources.get(detail.id) ?? []
    const resourceIndex = resources.findIndex((resource) => resource.id === request.data.resourceId)
    const resource = resources[resourceIndex]
    if (!resource) return failure({ code: 'NOT_FOUND' })
    if (!/\.(md|markdown)$/i.test(resource.name)) return failure({ code: 'STATE_CONFLICT', reason: 'KNOWLEDGE_RESOURCE_NOT_EDITABLE_MARKDOWN' })
    const timestamp = this.#now()
    const file = new File([request.data.content], resource.name, { type: 'text/markdown', lastModified: new Date(timestamp).valueOf() })
    const updatedResource: KnowledgeResourceSummary = { ...resource, status: 'indexing', mimeType: 'text/markdown', sizeBytes: file.size, updatedAt: timestamp }
    resources.splice(resourceIndex, 1, updatedResource)
    this.#knowledgeResources.set(detail.id, resources)
    this.#knowledgeResourceFiles.set(resource.id, file)
    const updated = knowledgeSpaceDetailSchema.parse({ ...detail, revision: detail.revision + 1, updatedAt: timestamp })
    this.#replaceKnowledgeSpace(updated)
    const parsed = updateKnowledgeResourceContentSuccessSchema.parse({ resource: updatedResource, knowledgeSpaceRevision: updated.revision })
    return { ok: true, value: structuredClone(parsed) }
  }

  async uploadKnowledgeFile(input: UploadKnowledgeFileInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CompleteKnowledgeUploadSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const detail = this.#knowledgeSpaceDetails.get(input.knowledgeSpaceId)
    if (!detail) return failure({ code: 'NOT_FOUND' })
    if (detail.revision !== input.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: input.expectedRevision, currentRevision: detail.revision })
    if (!(this.#knowledgeFolders.get(detail.id) ?? []).some((folder) => folder.id === input.folderId)) return failure({ code: 'NOT_FOUND' })
    const timestamp = this.#now()
    const resource: KnowledgeResourceSummary = { id: uuidSchema.parse(crypto.randomUUID()), knowledgeSpaceId: detail.id, folderId: input.folderId, name: input.file.name, status: 'indexing', mimeType: input.file.type || 'application/octet-stream', sizeBytes: input.file.size, createdAt: timestamp, updatedAt: timestamp }
    const resources = this.#knowledgeResources.get(detail.id) ?? []
    resources.push(resource)
    this.#knowledgeResources.set(detail.id, resources)
    this.#knowledgeResourceFiles.set(resource.id, input.file)
    const updated = knowledgeSpaceDetailSchema.parse({ ...detail, fileCount: detail.fileCount + 1, revision: detail.revision + 1, updatedAt: timestamp })
    this.#replaceKnowledgeSpace(updated)
    const parsed = completeKnowledgeUploadSuccessSchema.safeParse({ resource, knowledgeSpaceRevision: updated.revision })
    return parsed.success ? { ok: true, value: structuredClone(parsed.data) } : failure({ code: 'RESPONSE_INVALID' })
  }

  #replaceKnowledgeSpace(detail: KnowledgeSpaceDetail) {
    this.#knowledgeSpaceDetails.set(detail.id, detail)
    const index = this.#knowledgeSpaces.findIndex((space) => space.id === detail.id)
    if (index >= 0) this.#knowledgeSpaces[index] = detail
  }

  async listJourneys(options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneySummary[]>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const candidate: unknown = this.#consumeInvalidResponse() ? { invalid: true } : [...this.#journeys.values()]
      .filter((document) => document.journey.workspaceId === this.#workspaceId)
      .map((document) => ({
        id: document.journey.id,
        name: document.journey.name,
        description: document.journey.description,
        status: document.journey.status,
        patternKind: document.pattern.kind,
        agentCount: document.agents.length,
        revision: document.journey.revision,
        createdAt: document.journey.createdAt,
        updatedAt: document.journey.updatedAt,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const parsed = journeySummaryListSchema.safeParse(candidate)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async createJourney(input: CreateJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = createJourneyInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const timestamp = this.#now()
    const candidate: unknown = this.#consumeInvalidResponse() ? { invalid: true } : {
      journey: {
        id: this.#journeyIdFactory(),
        workspaceId: this.#workspaceId,
        name: parsedInput.data.name,
        description: parsedInput.data.description,
        status: 'draft',
        tags: [],
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      pattern: instantiatePattern(parsedInput.data.patternTemplateKey, this.#patternIdFactory),
      agents: [],
      inputGuardrail: { state: 'inactive' },
      outputGuardrail: { state: 'inactive' },
    }
    const parsed = journeyEditorDocumentSchema.safeParse(candidate)
    if (!parsed.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(parsed.data.journey.id, structuredClone(parsed.data))
    return { ok: true, value: parsed.data }
  }

  async deleteJourney(input: DeleteJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteJourneySuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = deleteJourneyInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const stored = this.#journeys.get(parsedInput.data.journeyId)
    if (!stored || stored.journey.workspaceId !== this.#workspaceId) return failure({ code: 'NOT_FOUND' })
    if (this.#consumeConflict() || stored.journey.revision !== parsedInput.data.expectedRevision) {
      return failure({ code: 'REVISION_CONFLICT', expectedRevision: parsedInput.data.expectedRevision, currentRevision: stored.journey.revision })
    }
    const responseCandidate: unknown = this.#consumeInvalidResponse() ? { invalid: true } : { journeyId: stored.journey.id }
    const parsedResponse = deleteJourneySuccessSchema.safeParse(responseCandidate)
    if (!parsedResponse.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.delete(stored.journey.id)
    for (const [agentId, document] of this.#agentWorkflows) {
      if (document.agent.journeyId === stored.journey.id) this.#agentWorkflows.delete(agentId)
    }
    return { ok: true, value: parsedResponse.data }
  }

  async listAgentTemplates(options?: RepositoryOperationOptions): Promise<RepositoryResult<AgentTemplate[]>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const candidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : [...this.#agentTemplates.values()].filter((template) => template.ownerWorkspaceId === this.#workspaceId || template.visibility === 'public').map((template) => structuredClone(template))
    const parsed = this.#lifecycleSchemas.agentTemplateList.safeParse(candidate)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadAgentTemplate(templateId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<AgentTemplate>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const stored = this.#agentTemplates.get(templateId)
    if (!stored || (stored.ownerWorkspaceId !== this.#workspaceId && stored.visibility !== 'public')) return failure({ code: 'NOT_FOUND' })
    const candidate: unknown = this.#consumeInvalidResponse() ? { invalid: true } : structuredClone(stored)
    const parsed = this.#lifecycleSchemas.agentTemplate.safeParse(candidate)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async createJourneyAgent(input: CreateJourneyAgentInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateOrInstantiateAgentSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = createJourneyAgentInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const journey = this.#journeys.get(parsedInput.data.journeyId)
    if (!journey) return failure({ code: 'NOT_FOUND' })
    if (journey.journey.revision !== parsedInput.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: parsedInput.data.expectedRevision, currentRevision: journey.journey.revision })
    const created = createMinimalAgent(journey, parsedInput.data.slotId, `Agent ${journey.agents.length + 1}`, null, this.#now(), this.#idFactory, this.#systemVariableIds)
    if (!created.ok) return failure({ code: created.error.code === 'SLOT_NOT_FOUND' ? 'NOT_FOUND' : 'RESPONSE_INVALID' })
    const responseCandidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : this.#transformCreateOrInstantiateResponse(created.value)
    const parsedResponse = this.#lifecycleSchemas.createOrInstantiate.safeParse(responseCandidate)
    if (!parsedResponse.success) return failure({ code: 'RESPONSE_INVALID' })
    if (!isCreateOrInstantiateResponseForRequest(parsedResponse.data, parsedInput.data)) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(journey.journey.id, structuredClone(parsedResponse.data.journey))
    this.#agentWorkflows.set(parsedResponse.data.agent.agent.id, structuredClone(parsedResponse.data.agent))
    return { ok: true, value: parsedResponse.data }
  }

  async saveAgentAsTemplate(input: SaveAgentAsTemplateInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<SaveAgentAsTemplateSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = saveAgentAsTemplateInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const journey = this.#journeys.get(parsedInput.data.journeyId)
    const agent = this.#agentWorkflows.get(parsedInput.data.agentId)
    if (!journey || !agent || agent.agent.journeyId !== journey.journey.id) return failure({ code: 'NOT_FOUND' })
    const saved = saveAgentAsTemplate(agent, this.#workspaceId, parsedInput.data.name, parsedInput.data.description, this.#now(), this.#idFactory, this.#systemVariableIds)
    if (!saved.ok) return failure({ code: 'RESPONSE_INVALID' })
    const responseCandidate: unknown = this.#consumeInvalidResponse() ? { invalid: true } : saved.value
    const parsedResponse = this.#lifecycleSchemas.agentTemplate.safeParse(responseCandidate)
    if (!parsedResponse.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#agentTemplates.set(parsedResponse.data.id, structuredClone(parsedResponse.data))
    return { ok: true, value: parsedResponse.data }
  }

  async instantiateAgentTemplate(input: InstantiateAgentTemplateInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateOrInstantiateAgentSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = instantiateAgentTemplateInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected
    const journey = this.#journeys.get(parsedInput.data.journeyId)
    const template = this.#agentTemplates.get(parsedInput.data.templateId)
    if (!journey || !template) return failure({ code: 'NOT_FOUND' })
    if (journey.journey.revision !== parsedInput.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: parsedInput.data.expectedRevision, currentRevision: journey.journey.revision })
    const instantiated = instantiateAgentTemplate(journey, template, parsedInput.data.slotId, undefined, this.#now(), this.#idFactory, this.#systemVariableIds, [])
    if (!instantiated.ok) return failure({ code: instantiated.error.code === 'SLOT_NOT_FOUND' ? 'NOT_FOUND' : 'RESPONSE_INVALID' })
    const responseCandidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : this.#transformCreateOrInstantiateResponse(instantiated.value)
    const parsedResponse = this.#lifecycleSchemas.createOrInstantiate.safeParse(responseCandidate)
    if (!parsedResponse.success) return failure({ code: 'RESPONSE_INVALID' })
    if (!isCreateOrInstantiateResponseForRequest(parsedResponse.data, parsedInput.data)) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(journey.journey.id, structuredClone(parsedResponse.data.journey))
    this.#agentWorkflows.set(parsedResponse.data.agent.agent.id, structuredClone(parsedResponse.data.agent))
    return { ok: true, value: parsedResponse.data }
  }

  async removeOccupiedSlot(input: RemoveOccupiedSlotInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<RemoveOccupiedSlotSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = removeOccupiedSlotInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'REQUEST_INVALID' })
    const journey = this.#journeys.get(parsedInput.data.journeyId)
    if (!journey) return failure({ code: 'NOT_FOUND' })
    if (journey.journey.revision !== parsedInput.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: parsedInput.data.expectedRevision, currentRevision: journey.journey.revision })
    const slot = journey.pattern.slots.find((candidate) => candidate.id === parsedInput.data.slotId)
    if (!slot) return failure({ code: 'NOT_FOUND' })
    if (slot.agentId !== parsedInput.data.expectedAgentId) return failure({ code: 'STATE_CONFLICT', reason: 'SLOT_AGENT_CHANGED' })
    const agent = this.#agentWorkflows.get(parsedInput.data.expectedAgentId)
    if (!agent) return failure({ code: 'NOT_FOUND' })
    let template: AgentTemplate | null = null
    if (parsedInput.data.agentAction.type === 'save_as_template_and_discard') {
      const saved = saveAgentAsTemplate(agent, this.#workspaceId, parsedInput.data.agentAction.template.name, parsedInput.data.agentAction.template.description, this.#now(), this.#idFactory, this.#systemVariableIds)
      if (!saved.ok) return failure({ code: 'RESPONSE_INVALID' })
      template = saved.value
    }
    const unassigned = unassignAgent(journey.pattern, slot.id)
    if (!unassigned.ok) return failure({ code: 'STATE_CONFLICT', reason: 'SLOT_AGENT_CHANGED' })
    const removed = removePatternSlot(unassigned.value, slot.id, this.#patternIdFactory)
    if (!removed.ok) return failure({ code: 'STATE_CONFLICT', reason: 'SLOT_AGENT_CHANGED' })
    const updatedAt = this.#now()
    const candidate = { ...structuredClone(journey), journey: { ...journey.journey, revision: journey.journey.revision + 1, updatedAt }, pattern: removed.value }
    const response = removeOccupiedSlotSuccessSchema.safeParse({ journey: candidate, template })
    if (!response.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(journey.journey.id, structuredClone(response.data.journey))
    this.#agentWorkflows.delete(agent.agent.id)
    if (template) this.#agentTemplates.set(template.id, structuredClone(template))
    return { ok: true, value: response.data }
  }

  async addGuardrail(input: AddGuardrailInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<AddGuardrailSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = addGuardrailInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'REQUEST_INVALID' })
    const journey = this.#journeys.get(parsedInput.data.journeyId)
    if (!journey) return failure({ code: 'NOT_FOUND' })
    if (journey.journey.revision !== parsedInput.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: parsedInput.data.expectedRevision, currentRevision: journey.journey.revision })
    const field = parsedInput.data.side === 'input' ? 'inputGuardrail' : 'outputGuardrail'
    if (journey[field].state === 'active') return failure({ code: 'STATE_CONFLICT', reason: 'GUARDRAIL_ALREADY_ACTIVE' })
    const timestamp = this.#now()
    const agentId = this.#idFactory.agentId()
    const startId = this.#idFactory.workflowNodeId()
    const endId = this.#idFactory.workflowNodeId()
    const edgeId = this.#idFactory.workflowEdgeId()
    const agent = this.#agentDocumentSchema.parse({
      agent: { id: agentId, journeyId: journey.journey.id, name: `${parsedInput.data.side === 'input' ? 'Input' : 'Output'} Guardrail Agent`, description: null, revision: 1, createdAt: timestamp, updatedAt: timestamp },
      workflow: { schemaVersion: '1.0.0', nodes: [{ id: startId, type: 'start', name: 'Start', config: {} }, { id: endId, type: 'end', name: 'End', config: {} }], edges: [{ id: edgeId, sourceNodeId: startId, targetNodeId: endId }] },
      layout: {
        schemaVersion: '1.0.0',
        nodePlacements: [
          { nodeId: startId, ...MINIMUM_WORKFLOW_START_POSITION },
          { nodeId: endId, ...MINIMUM_WORKFLOW_END_POSITION },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      variables: [], reusableTools: [],
    })
    const candidate = structuredClone(journey)
    candidate.journey.revision += 1
    candidate.journey.updatedAt = timestamp
    candidate.agents.push({ id: agent.agent.id, name: agent.agent.name, description: agent.agent.description, revision: agent.agent.revision, updatedAt: agent.agent.updatedAt })
    candidate[field] = { state: 'active', structure: 'single', agentId }
    const response = addGuardrailSuccessSchema.safeParse({ journey: candidate, agent })
    if (!response.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(journey.journey.id, structuredClone(response.data.journey))
    this.#agentWorkflows.set(agentId, structuredClone(response.data.agent))
    return { ok: true, value: response.data }
  }

  async removeGuardrail(input: RemoveGuardrailInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') return failure({ code: 'ABORTED' })
    const parsedInput = removeGuardrailInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'REQUEST_INVALID' })
    const journey = this.#journeys.get(parsedInput.data.journeyId)
    if (!journey) return failure({ code: 'NOT_FOUND' })
    if (journey.journey.revision !== parsedInput.data.expectedRevision) return failure({ code: 'REVISION_CONFLICT', expectedRevision: parsedInput.data.expectedRevision, currentRevision: journey.journey.revision })
    const field = parsedInput.data.side === 'input' ? 'inputGuardrail' : 'outputGuardrail'
    const projection = journey[field]
    if (projection.state !== 'active') return failure({ code: 'STATE_CONFLICT', reason: 'GUARDRAIL_ALREADY_INACTIVE' })
    if (projection.agentId !== parsedInput.data.expectedAgentId) return failure({ code: 'STATE_CONFLICT', reason: 'GUARDRAIL_AGENT_MISMATCH' })
    const candidate = structuredClone(journey)
    candidate.journey.revision += 1
    candidate.journey.updatedAt = this.#now()
    candidate.agents = candidate.agents.filter((agent) => agent.id !== projection.agentId)
    candidate[field] = { state: 'inactive' }
    const parsed = journeyEditorDocumentSchema.safeParse(candidate)
    if (!parsed.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(journey.journey.id, structuredClone(parsed.data))
    this.#agentWorkflows.delete(projection.agentId)
    return { ok: true, value: parsed.data }
  }

  async loadJourney(
    journeyId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<JourneyEditorDocument>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') {
      return failure({ code: 'ABORTED' })
    }
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected

    const stored = this.#journeys.get(journeyId)
    if (!stored) return failure({ code: 'NOT_FOUND' })
    const candidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : structuredClone(stored)
    const parsed = journeyEditorDocumentSchema.safeParse(candidate)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async saveJourney(
    input: SaveJourneyInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<SaveJourneySuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') {
      return failure({ code: 'ABORTED' })
    }
    const parsedInput = saveJourneyInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected

    const stored = this.#journeys.get(parsedInput.data.journeyId)
    if (!stored) return failure({ code: 'NOT_FOUND' })
    if (this.#consumeConflict() || stored.journey.revision !== parsedInput.data.expectedRevision) {
      return failure({
        code: 'REVISION_CONFLICT',
        expectedRevision: parsedInput.data.expectedRevision,
        currentRevision: stored.journey.revision,
      })
    }

    const updatedAt = this.#now()
    const revision = stored.journey.revision + 1
    const candidate = {
      ...structuredClone(stored),
      journey: { ...stored.journey, revision, updatedAt },
      pattern: structuredClone(parsedInput.data.pattern),
    }
    const parsedDocument = journeyEditorDocumentSchema.safeParse(candidate)
    if (!parsedDocument.success) return failure({ code: 'RESPONSE_INVALID' })

    const responseCandidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : { journeyId: stored.journey.id, revision, updatedAt }
    const parsedResponse = saveJourneySuccessSchema.safeParse(responseCandidate)
    if (!parsedResponse.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#journeys.set(stored.journey.id, structuredClone(parsedDocument.data))
    return { ok: true, value: parsedResponse.data }
  }

  async loadAgentWorkflow(
    journeyId: UUID,
    agentId: UUID,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<AgentWorkflowEditorDocument>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') {
      return failure({ code: 'ABORTED' })
    }
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected

    const stored = this.#agentWorkflows.get(agentId)
    if (!stored || stored.agent.journeyId !== journeyId) return failure({ code: 'NOT_FOUND' })
    const candidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : structuredClone(stored)
    const parsed = this.#agentDocumentSchema.safeParse(candidate)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async saveAgentWorkflow(
    input: SaveAgentWorkflowInput,
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<SaveAgentWorkflowSuccess>> {
    if ((await waitForLatency(this.#latencyMs, options?.signal)) === 'aborted') {
      return failure({ code: 'ABORTED' })
    }
    const parsedInput = saveAgentWorkflowInputSchema.safeParse(input)
    if (!parsedInput.success) return failure({ code: 'RESPONSE_INVALID' })
    const injected = this.#consumeSimpleFailure()
    if (injected) return injected

    const stored = this.#agentWorkflows.get(parsedInput.data.agentId)
    if (!stored || stored.agent.journeyId !== parsedInput.data.journeyId) {
      return failure({ code: 'NOT_FOUND' })
    }
    if (this.#consumeConflict() || stored.agent.revision !== parsedInput.data.expectedRevision) {
      return failure({
        code: 'REVISION_CONFLICT',
        expectedRevision: parsedInput.data.expectedRevision,
        currentRevision: stored.agent.revision,
      })
    }

    const updatedAt = this.#now()
    const revision = stored.agent.revision + 1
    const candidate = {
      agent: { ...stored.agent, revision, updatedAt },
      workflow: structuredClone(parsedInput.data.workflow),
      layout: structuredClone(parsedInput.data.layout),
      variables: structuredClone(parsedInput.data.variables),
      reusableTools: structuredClone(parsedInput.data.reusableTools),
    }
    const parsedDocument = this.#agentDocumentSchema.safeParse(candidate)
    if (!parsedDocument.success) return failure({ code: 'RESPONSE_INVALID' })

    const responseCandidate: unknown = this.#consumeInvalidResponse()
      ? { invalid: true }
      : { journeyId: stored.agent.journeyId, agentId: stored.agent.id, revision, updatedAt }
    const parsedResponse = saveAgentWorkflowSuccessSchema.safeParse(responseCandidate)
    if (!parsedResponse.success) return failure({ code: 'RESPONSE_INVALID' })
    this.#agentWorkflows.set(stored.agent.id, structuredClone(parsedDocument.data))
    return { ok: true, value: parsedResponse.data }
  }

  #consumeSimpleFailure(): { ok: false; error: RepositoryError } | null {
    if (this.#scenario.nextFailure !== 'NETWORK_FAILED') return null
    this.#scenario.nextFailure = null
    return failure({ code: 'NETWORK_FAILED' })
  }

  #consumeInvalidResponse(): boolean {
    if (this.#scenario.nextFailure !== 'RESPONSE_INVALID') return false
    this.#scenario.nextFailure = null
    return true
  }

  #transformCreateOrInstantiateResponse(
    response: CreateOrInstantiateAgentSuccess,
  ): CreateOrInstantiateAgentSuccess {
    const transform = this.#scenario.nextCreateOrInstantiateResponseTransform
    this.#scenario.nextCreateOrInstantiateResponseTransform = null
    return transform ? transform(structuredClone(response)) : response
  }

  #consumeConflict(): boolean {
    if (this.#scenario.nextFailure !== 'REVISION_CONFLICT') return false
    this.#scenario.nextFailure = null
    return true
  }
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : ''))
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Could not read file')))
    reader.readAsText(file)
  })
}

export function createInMemoryEditorRepositoryScenario(
  options: InMemoryEditorRepositoryOptions = {},
): { repository: OdysseyEditorRepository; controls: InMemoryEditorRepositoryControls } {
  const scenario: ScenarioState = {
    nextFailure: null,
    nextCreateOrInstantiateResponseTransform: null,
  }
  return {
    repository: new InMemoryEditorRepository(options, scenario),
    controls: {
      failNext(code) {
        scenario.nextFailure = code
      },
      transformNextCreateOrInstantiateResponse(transform) {
        scenario.nextCreateOrInstantiateResponseTransform = transform
      },
    },
  }
}
