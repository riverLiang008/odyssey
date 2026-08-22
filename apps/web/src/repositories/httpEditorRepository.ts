import {
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
import type { OdysseyEditorRepository, RepositoryOperationOptions } from './editorRepository'

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface HttpEditorRepositoryOptions {
  baseUrl: string
  fetchImplementation?: FetchImplementation
  systemVariableIds?: readonly string[]
}

function failure<T>(error: RepositoryError): RepositoryResult<T> { return { ok: false, error } }

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
    return value.success ? { code, reason: value.data.reason } : { code: 'RESPONSE_INVALID' }
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

  async listJourneys(options?: RepositoryOperationOptions): Promise<RepositoryResult<JourneySummary[]>> {
    const result = await this.#request('/journeys', { method: 'GET' }, options)
    if (!result.ok) return result
    const parsed = journeySummaryListSchema.safeParse(result.value)
    return parsed.success ? { ok: true, value: parsed.data } : failure({ code: 'RESPONSE_INVALID' })
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
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}`, this.#json('PUT', { expectedRevision: request.data.expectedRevision, pattern: request.data.pattern }), options)
    if (!result.ok) return result
    const document = journeyEditorDocumentSchema.safeParse(result.value)
    if (!document.success || document.data.journey.id !== request.data.journeyId) return failure({ code: 'RESPONSE_INVALID' })
    const parsed = saveJourneySuccessSchema.safeParse({ journeyId: document.data.journey.id, revision: document.data.journey.revision, updatedAt: document.data.journey.updatedAt })
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
    if (!request.success) return failure({ code: 'REQUEST_INVALID' })
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
    const result = await this.#request(`/journeys/${encodeURIComponent(request.data.journeyId)}/slots/${encodeURIComponent(request.data.slotId)}/agent-template/${encodeURIComponent(request.data.templateId)}`, this.#json('POST', { expectedRevision: request.data.expectedRevision }), options)
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
