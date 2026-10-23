import {
  systemToolDefinitionListSchema,
  type SystemToolDefinition,
  apiErrorEnvelopeSchema,
  addGuardrailInputSchema,
  addGuardrailSuccessSchema,
  createAgentLifecycleResponseSchemas,
  agentWorkflowEditorDocumentSchema,
  createJourneyAgentInputSchema,
  createJourneyInputSchema,
  deleteJourneyInputSchema,
  deleteJourneySuccessSchema,
  instantiateAgentTemplateInputSchema,
  journeyEditorDocumentSchema,
  journeySummaryListSchema,
  knowledgeSpaceSummaryPageSchema,
  knowledgeSpaceCategorySummarySchema,
  knowledgeSpaceDetailSchema,
  createKnowledgeSpaceCategoryInputSchema,
  createKnowledgeSpaceInputSchema,
  updateKnowledgeSpaceInputSchema,
  knowledgeSpaceRevisionCommandSchema,
  deleteKnowledgeSpaceSuccessSchema,
  knowledgeFileTreeSchema,
  knowledgeGraphOverviewSchema,
  validateKnowledgeGraphManifestRequestSchema,
  validateKnowledgeGraphManifestResultSchema,
  applyKnowledgeGraphManifestRequestSchema,
  applyKnowledgeGraphManifestResultSchema,
  knowledgeResourceDetailSchema,
  createKnowledgeFolderInputSchema,
  createKnowledgeFolderSuccessSchema,
  moveKnowledgeResourceInputSchema,
  moveKnowledgeResourceSuccessSchema,
  deleteKnowledgeResourceInputSchema,
  deleteKnowledgeResourceSuccessSchema,
  updateKnowledgeResourceContentInputSchema,
  updateKnowledgeResourceContentSuccessSchema,
  completeKnowledgeUploadSuccessSchema,
  prepareKnowledgeUploadSuccessSchema,
  removeOccupiedSlotInputSchema,
  removeOccupiedSlotSuccessSchema,
  removeGuardrailInputSchema,
  revisionConflictDetailsSchema,
  saveAgentAsTemplateInputSchema,
  saveAgentWorkflowInputSchema,
  saveAgentWorkflowSuccessSchema,
  saveJourneyInputSchema,
  saveJourneySuccessSchema,
  stateConflictDetailsSchema,
  validationErrorDetailsSchema,
  type AgentTemplate,
  type AddGuardrailInput,
  type AddGuardrailSuccess,
  type AgentWorkflowEditorDocument,
  type CreateJourneyAgentInput,
  type CreateJourneyInput,
  type CreateOrInstantiateAgentSuccess,
  type DeleteJourneyInput,
  type DeleteJourneySuccess,
  type InstantiateAgentTemplateInput,
  type JourneyEditorDocument,
  type JourneySummary,
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
  type RemoveOccupiedSlotInput,
  type RemoveOccupiedSlotSuccess,
  type RemoveGuardrailInput,
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
import type { KnowledgeResourceInspection, OdysseyEditorRepository, RepositoryOperationOptions, UploadKnowledgeFileInput } from './editorRepository'
import { consumeDevelopmentSaveFailure } from './developmentSaveFault'

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface HttpEditorRepositoryOptions {
  baseUrl: string
  fetchImplementation?: FetchImplementation
  systemVariableIds?: readonly string[]
}

function failure<T>(error: RepositoryError): RepositoryResult<T> { return { ok: false, error } }

function invalidRequest<T>(error: { issues: ReadonlyArray<{ path: PropertyKey[]; code: string }> }): RepositoryResult<T> {
  return failure({
    code: 'VALIDATION_FAILED',
    issues: error.issues.map((issue) => ({
      path: issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number'),
      code: issue.code,
    })),
  })
}

function normalizeApiError(status: number, candidate: unknown): RepositoryError {
  const parsed = apiErrorEnvelopeSchema.safeParse(candidate)
  if (!parsed.success) return { code: 'RESPONSE_INVALID' }
  const { code, details } = parsed.data.error
  if (code === 'NOT_FOUND' && status === 404) return { code }
  if (code === 'REVISION_CONFLICT' && status === 409) {
    const value = revisionConflictDetailsSchema.safeParse(details)
    return value.success ? { code, ...value.data } : { code: 'RESPONSE_INVALID' }
  }
  if (code === 'STATE_CONFLICT' && status === 409) {
    const value = stateConflictDetailsSchema.safeParse(details)
    return value.success ? { code, reason: value.data.reason, ...(value.data.routingImpact ? { routingImpact: value.data.routingImpact } : {}) } : { code: 'RESPONSE_INVALID' }
  }
  if (code === 'VALIDATION_FAILED' && status === 422) {
    const value = validationErrorDetailsSchema.safeParse(details)
    return value.success ? { code, issues: value.data.issues } : { code: 'RESPONSE_INVALID' }
  }
  if (code === 'LEGACY_PATTERN_UNSUPPORTED' && status === 422) return { code }
  if (code === 'CURRENT_WORKSPACE_UNAVAILABLE' && status === 503) return { code }
  return { code: 'RESPONSE_INVALID' }
}

export class HttpEditorRepository implements OdysseyEditorRepository {
  readonly #baseUrl: string
  readonly #fetch: FetchImplementation
  readonly #agentSchemas

  constructor(options: HttpEditorRepositoryOptions) {
    const url = new URL(options.baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('VITE_API_BASE_URL must use http or https')
    this.#baseUrl = url.toString().replace(/\/$/, '')
    this.#fetch = options.fetchImplementation ?? globalThis.fetch.bind(globalThis)
    this.#agentSchemas = createAgentLifecycleResponseSchemas(options.systemVariableIds)
  }

  async #request(path: string, init: RequestInit, options?: RepositoryOperationOptions): Promise<RepositoryResult<unknown>> {
    let response: Response
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, signal: options?.signal })
    } catch (error) {
      return failure(error instanceof DOMException && error.name === 'AbortError' ? { code: 'ABORTED' } : { code: 'NETWORK_FAILED' })
    }
    const text = await response.text()
    let body: unknown = null
    if (text.length > 0) {
      try { body = JSON.parse(text) as unknown } catch { return failure({ code: 'RESPONSE_INVALID' }) }
    }
    if (!response.ok) return failure(normalizeApiError(response.status, body))
    if (response.status === 204 && text.length > 0) return failure({ code: 'RESPONSE_INVALID' })
    return { ok: true, value: body }
  }

  #json(method: 'POST' | 'PUT', body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  }

  async listSystemToolDefinitions(options?: RepositoryOperationOptions): Promise<RepositoryResult<SystemToolDefinition[]>> {
    const result = await this.#request('/tool-definitions', { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = systemToolDefinitionListSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async listJourneys(options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneySummary[]>> {
    const result = await this.#request('/journeys', { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = journeySummaryListSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async listKnowledgeSpaces(
    input: { query?: string; page?: number; pageSize?: number; includeArchived?: boolean } = {},
    options?: RepositoryOperationOptions,
  ): Promise<RepositoryResult<KnowledgeSpaceSummaryPage>> {
    const parameters = new URLSearchParams()
    if (input.query !== undefined) parameters.set('query', input.query)
    if (input.page !== undefined) parameters.set('page', String(input.page))
    if (input.pageSize !== undefined) parameters.set('pageSize', String(input.pageSize))
    if (input.includeArchived !== undefined) parameters.set('includeArchived', String(input.includeArchived))
    const suffix = parameters.size ? `?${parameters.toString()}` : ''
    const result = await this.#request(`/knowledge-spaces${suffix}`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceSummaryPageSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async listKnowledgeSpaceCategories(options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceCategorySummary[]>> {
    const result = await this.#request('/knowledge-space-categories', { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceCategorySummarySchema.array().safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async createKnowledgeSpaceCategory(input: CreateKnowledgeSpaceCategoryInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceCategorySummary>> {
    const request = createKnowledgeSpaceCategoryInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request('/knowledge-space-categories', this.#json('POST', request.data), options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceCategorySummarySchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async createKnowledgeSpace(input: CreateKnowledgeSpaceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    const request = createKnowledgeSpaceInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request('/knowledge-spaces', this.#json('POST', request.data), options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceDetailSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadKnowledgeSpace(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceDetailSchema.safeParse(result.value)
    return parsed.success && parsed.data.id === knowledgeSpaceId
      ? { ok: true, value: parsed.data }
      : failure({ code: 'RESPONSE_INVALID' })
  }

  async updateKnowledgeSpace(input: UpdateKnowledgeSpaceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    const request = updateKnowledgeSpaceInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const { knowledgeSpaceId, ...body } = request.data
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}`, this.#json('PUT', body), options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceDetailSchema.safeParse(result.value)
    return parsed.success && parsed.data.id === knowledgeSpaceId ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async archiveKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    return this.#setKnowledgeSpaceArchived(input, 'archive', options)
  }

  async unarchiveKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    return this.#setKnowledgeSpaceArchived(input, 'unarchive', options)
  }

  async #setKnowledgeSpaceArchived(input: KnowledgeSpaceRevisionCommand, command: 'archive' | 'unarchive', options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeSpaceDetail>> {
    const request = knowledgeSpaceRevisionCommandSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(request.data.knowledgeSpaceId)}/commands/${command}`, this.#json('POST', { expectedRevision: request.data.expectedRevision }), options)
    if (!result.ok) return result
    const parsed = knowledgeSpaceDetailSchema.safeParse(result.value)
    return parsed.success && parsed.data.id === request.data.knowledgeSpaceId ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async deleteKnowledgeSpace(input: KnowledgeSpaceRevisionCommand, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteKnowledgeSpaceSuccess>> {
    const request = knowledgeSpaceRevisionCommandSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(request.data.knowledgeSpaceId)}`, { method: 'DELETE', headers: { 'If-Match': `"${request.data.expectedRevision}"` } }, options)
    if (!result.ok) return result
    if (result.value !== null) return failure({ code: 'RESPONSE_INVALID' })
    const parsed = deleteKnowledgeSpaceSuccessSchema.safeParse({ knowledgeSpaceId: request.data.knowledgeSpaceId })
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadKnowledgeFileTree(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeFileTree>> {
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/file-tree`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = knowledgeFileTreeSchema.safeParse(result.value)
    return parsed.success && parsed.data.knowledgeSpaceId === knowledgeSpaceId ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadKnowledgeGraph(knowledgeSpaceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeGraphOverview>> {
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/graph`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = knowledgeGraphOverviewSchema.safeParse(result.value)
    return parsed.success && parsed.data.knowledgeSpaceId === knowledgeSpaceId
      ? { ok: true, value: parsed.data }
      : failure({ code: 'RESPONSE_INVALID' })
  }

  async validateKnowledgeGraphManifest(knowledgeSpaceId: UUID, expectedRevision: number, manifest: KnowledgeGraphManifest, options?: RepositoryOperationOptions): Promise<RepositoryResult<ValidateKnowledgeGraphManifestResult>> {
    const request = validateKnowledgeGraphManifestRequestSchema.safeParse({ expectedRevision, manifest })
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/graph-manifest/validate`, this.#json('POST', request.data), options)
    if (!result.ok) return result
    const parsed = validateKnowledgeGraphManifestResultSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async applyKnowledgeGraphManifest(knowledgeSpaceId: UUID, input: { expectedRevision: number; validationToken: string; manifestChecksum: string; manifest: KnowledgeGraphManifest }, options?: RepositoryOperationOptions): Promise<RepositoryResult<ApplyKnowledgeGraphManifestResult>> {
    const request = applyKnowledgeGraphManifestRequestSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/graph-manifest/apply`, this.#json('POST', request.data), options)
    if (!result.ok) return result
    const parsed = applyKnowledgeGraphManifestResultSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadKnowledgeResource(knowledgeSpaceId: UUID, resourceId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<KnowledgeResourceInspection>> {
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/resources/${encodeURIComponent(resourceId)}`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = knowledgeResourceDetailSchema.safeParse(result.value)
    if (!parsed.success || parsed.data.knowledgeSpaceId !== knowledgeSpaceId || parsed.data.id !== resourceId) return failure({ code: 'RESPONSE_INVALID' })
    const detail: KnowledgeResourceDetail = parsed.data
    if (!isTextPreviewType(detail.mimeType)) return { ok: true, value: { detail, preview: { type: 'external' } } }
    try {
      const response = await this.#fetch(detail.downloadUrl, { method: 'GET', signal: options?.signal })
      if (!response.ok) return { ok: true, value: { detail, preview: { type: 'failed', error: { code: 'NETWORK_FAILED' } } } }
      const content = await response.text()
      const previewLimit = 200_000
      return { ok: true, value: { detail, preview: { type: 'text', content: content.slice(0, previewLimit), truncated: content.length > previewLimit } } }
    } catch (error) {
      if (error instanceof globalThis.DOMException && error.name === 'AbortError') return failure({ code: 'ABORTED' })
      return { ok: true, value: { detail, preview: { type: 'failed', error: { code: 'NETWORK_FAILED' } } } }
    }
  }

  async createKnowledgeFolder(input: CreateKnowledgeFolderInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateKnowledgeFolderSuccess>> {
    const request = createKnowledgeFolderInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const { knowledgeSpaceId, ...body } = request.data
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/folders`, this.#json('POST', body), options)
    if (!result.ok) return result
    const parsed = createKnowledgeFolderSuccessSchema.safeParse(result.value)
    return parsed.success && parsed.data.folder.knowledgeSpaceId === knowledgeSpaceId ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async moveKnowledgeResource(input: MoveKnowledgeResourceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<MoveKnowledgeResourceSuccess>> {
    const request = moveKnowledgeResourceInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const { knowledgeSpaceId, resourceId, ...body } = request.data
    const result = await this.#request(
      `/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/resources/${encodeURIComponent(resourceId)}/commands/move`,
      this.#json('POST', body),
      options,
    )
    if (!result.ok) return result
    const parsed = moveKnowledgeResourceSuccessSchema.safeParse(result.value)
    return parsed.success && parsed.data.resource.knowledgeSpaceId === knowledgeSpaceId && parsed.data.resource.id === resourceId
      ? { ok: true, value: parsed.data }
      : failure({ code: 'RESPONSE_INVALID' })
  }

  async deleteKnowledgeResource(input: DeleteKnowledgeResourceInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteKnowledgeResourceSuccess>> {
    const request = deleteKnowledgeResourceInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const result = await this.#request(
      `/knowledge-spaces/${encodeURIComponent(request.data.knowledgeSpaceId)}/resources/${encodeURIComponent(request.data.resourceId)}`,
      { method: 'DELETE', headers: { 'If-Match': `"${request.data.expectedRevision}"` } },
      options,
    )
    if (!result.ok) return result
    const parsed = deleteKnowledgeResourceSuccessSchema.safeParse(result.value)
    return parsed.success && parsed.data.resourceId === request.data.resourceId ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async updateKnowledgeResourceContent(input: UpdateKnowledgeResourceContentInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<UpdateKnowledgeResourceContentSuccess>> {
    const request = updateKnowledgeResourceContentInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    const { knowledgeSpaceId, resourceId, ...body } = request.data
    const result = await this.#request(`/knowledge-spaces/${encodeURIComponent(knowledgeSpaceId)}/resources/${encodeURIComponent(resourceId)}/content`, this.#json('PUT', body), options)
    if (!result.ok) return result
    const parsed = updateKnowledgeResourceContentSuccessSchema.safeParse(result.value)
    return parsed.success && parsed.data.resource.id === resourceId && parsed.data.resource.knowledgeSpaceId === knowledgeSpaceId
      ? { ok: true, value: parsed.data }
      : failure({ code: 'RESPONSE_INVALID' })
  }

  async uploadKnowledgeFile(input: UploadKnowledgeFileInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CompleteKnowledgeUploadSuccess>> {
    const contentType = input.file.type || inferKnowledgeFileContentType(input.file.name)
    if (!contentType) return failure({ code: 'REQUEST_INVALID' })
    const prepared = await this.#request(
      `/knowledge-spaces/${encodeURIComponent(input.knowledgeSpaceId)}/uploads/prepare`,
      this.#json('POST', { folderId: input.folderId, fileName: input.file.name, contentType, sizeBytes: input.file.size }),
      options,
    )
    if (!prepared.ok) return prepared
    const target = prepareKnowledgeUploadSuccessSchema.safeParse(prepared.value)
    if (!target.success) return failure({ code: 'RESPONSE_INVALID' })
    try {
      const uploadResponse = await this.#fetch(target.data.uploadUrl, {
        method: target.data.method,
        headers: target.data.requiredHeaders,
        body: input.file,
        signal: options?.signal,
      })
      if (!uploadResponse.ok) return failure({ code: 'NETWORK_FAILED' })
    } catch (error) {
      if (error instanceof globalThis.DOMException && error.name === 'AbortError') return failure({ code: 'ABORTED' })
      return failure({ code: 'NETWORK_FAILED' })
    }
    const completed = await this.#request(
      `/knowledge-spaces/${encodeURIComponent(input.knowledgeSpaceId)}/uploads/complete`,
      this.#json('POST', { artifactId: target.data.artifactId, expectedRevision: input.expectedRevision }),
      options,
    )
    if (!completed.ok) return completed
    const parsed = completeKnowledgeUploadSuccessSchema.safeParse(completed.value)
    return parsed.success && parsed.data.resource.knowledgeSpaceId === input.knowledgeSpaceId ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async createJourney(input: CreateJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>> {
    const request = createJourneyInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const result = await this.#request('/journeys', this.#json('POST', request.data), options)
    if (!result.ok) return result
    const parsed = journeyEditorDocumentSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadJourney(journeyId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>> {
    const result = await this.#request(`/journeys/${encodeURIComponent(journeyId)}`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = journeyEditorDocumentSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async saveJourney(input: SaveJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<SaveJourneySuccess>> {
    const request = saveJourneyInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    if (consumeDevelopmentSaveFailure()) return failure({ code: 'NETWORK_FAILED' })
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}`, this.#json('PUT', { expectedRevision: request.data.expectedRevision, pattern: request.data.pattern, ...(request.data.routingConfirmation ? { routingConfirmation: request.data.routingConfirmation } : {}) }), options)
    if (!result.ok) return result
    const document = journeyEditorDocumentSchema.safeParse(result.value)
    if (!document.success || document.data.journey.id !== request.data.journeyId) return failure({ code: 'RESPONSE_INVALID' })
    const parsed = saveJourneySuccessSchema.safeParse({ document: document.data, journeyId: document.data.journey.id, revision: document.data.journey.revision, updatedAt: document.data.journey.updatedAt })
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async deleteJourney(input: DeleteJourneyInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<DeleteJourneySuccess>> {
    const request = deleteJourneyInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}`, { method: 'DELETE', headers: { 'If-Match': `"${request.data.expectedRevision}"` } }, options)
    if (!result.ok) return result
    if (result.value !== null) return failure({ code: 'RESPONSE_INVALID' })
    const parsed = deleteJourneySuccessSchema.safeParse({ journeyId: request.data.journeyId })
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadAgentWorkflow(journeyId: UUID, agentId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<AgentWorkflowEditorDocument>> {
    const result = await this.#request(`/journeys/${encodeURIComponent(journeyId)}/agents/${encodeURIComponent(agentId)}`, { method: 'GET' }, options)
    if (!result.ok) return result
    const validated = agentWorkflowEditorDocumentSchema.safeParse(result.value)
    return validated.success ? { ok: true, value: validated.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async saveAgentWorkflow(input: SaveAgentWorkflowInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<SaveAgentWorkflowSuccess>> {
    const request = saveAgentWorkflowInputSchema.safeParse(input)
    if (!request.success) return invalidRequest(request.error)
    if (consumeDevelopmentSaveFailure()) return failure({ code: 'NETWORK_FAILED' })
    const { journeyId, agentId, ...body } = request.data
    const result = await this.#request(`/journeys/${encodeURIComponent(journeyId)}/agents/${encodeURIComponent(agentId)}`, this.#json('PUT', body), options)
    if (!result.ok) return result
    const document = agentWorkflowEditorDocumentSchema.safeParse(result.value)
    if (!document.success || document.data.agent.id !== agentId || document.data.agent.journeyId !== journeyId) return failure({ code: 'RESPONSE_INVALID' })
    const parsed = saveAgentWorkflowSuccessSchema.safeParse({ journeyId, agentId, revision: document.data.agent.revision, updatedAt: document.data.agent.updatedAt })
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async listAgentTemplates(options?: RepositoryOperationOptions): Promise<RepositoryResult<AgentTemplate[]>> {
    const result = await this.#request('/agent-templates', { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = this.#agentSchemas.agentTemplateList.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async loadAgentTemplate(templateId: UUID, options?: RepositoryOperationOptions): Promise<RepositoryResult<AgentTemplate>> {
    const result = await this.#request(`/agent-templates/${encodeURIComponent(templateId)}`, { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = this.#agentSchemas.agentTemplate.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async createJourneyAgent(input: CreateJourneyAgentInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateOrInstantiateAgentSuccess>> {
    const request = createJourneyAgentInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}/slots/${encodeURIComponent(request.data.slotId)}/agent`, this.#json('POST', { expectedRevision: request.data.expectedRevision }), options)
    if (!result.ok) return result
    const parsed = this.#agentSchemas.createOrInstantiate.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async saveAgentAsTemplate(input: SaveAgentAsTemplateInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<SaveAgentAsTemplateSuccess>> {
    const request = saveAgentAsTemplateInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}/agents/${encodeURIComponent(request.data.agentId)}/commands/save-as-template`, this.#json('POST', { name: request.data.name, description: request.data.description }), options)
    if (!result.ok) return result
    const parsed = this.#agentSchemas.agentTemplate.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async instantiateAgentTemplate(input: InstantiateAgentTemplateInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<CreateOrInstantiateAgentSuccess>> {
    const request = instantiateAgentTemplateInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}/slots/${encodeURIComponent(request.data.slotId)}/agent-template/${encodeURIComponent(request.data.templateId)}`, this.#json('POST', { expectedRevision: request.data.expectedRevision, ...(request.data.endAssignments ? { endAssignments: request.data.endAssignments } : {}) }), options)
    if (!result.ok) return result
    const parsed = this.#agentSchemas.createOrInstantiate.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async removeOccupiedSlot(input: RemoveOccupiedSlotInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<RemoveOccupiedSlotSuccess>> {
    const request = removeOccupiedSlotInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const { journeyId, slotId, ...body } = request.data
    const result = await this.#request(`/journeys/${encodeURIComponent(journeyId)}/slots/${encodeURIComponent(slotId)}/commands/remove`, this.#json('POST', body), options)
    if (!result.ok) return result
    const parsed = removeOccupiedSlotSuccessSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async addGuardrail(input: AddGuardrailInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<AddGuardrailSuccess>> {
    const request = addGuardrailInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const { journeyId, side, expectedRevision } = request.data
    const result = await this.#request(
      `/journeys/${encodeURIComponent(journeyId)}/guardrails/${side}/commands/add`,
      this.#json('POST', { expectedRevision }),
      options,
    )
    if (!result.ok) return result
    const parsed = addGuardrailSuccessSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
  }

  async removeGuardrail(input: RemoveGuardrailInput, options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneyEditorDocument>> {
    const request = removeGuardrailInputSchema.safeParse(input)
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
    const { journeyId, side, expectedRevision, expectedAgentId } = request.data
    const result = await this.#request(
      `/journeys/${encodeURIComponent(journeyId)}/guardrails/${side}/commands/remove`,
      this.#json('POST', { expectedRevision, expectedAgentId }),
      options,
    )
    if (!result.ok) return result
    const parsed = journeyEditorDocumentSchema.safeParse(result.value)
    return parsed.success && parsed.data.journey.id === journeyId
      ? { ok: true, value: parsed.data }
      : failure({ code: 'RESPONSE_INVALID' })
  }
}

function inferKnowledgeFileContentType(fileName: string): string | undefined {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  return {
    '.json': 'application/json',
    '.markdown': 'text/markdown',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  }[extension]
}

function isTextPreviewType(mimeType: string | null): boolean {
  return mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'application/json'
}
