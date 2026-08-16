import {
  createAgentLifecycleResponseSchemas,
  createJourneyAgentInputSchema,
  instantiateAgentTemplateInputSchema,
  removeOccupiedSlotInputSchema,
  removeOccupiedSlotSuccessSchema,
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
  type AgentTemplate,
  type AgentWorkflowEditorDocument,
  type CreateJourneyAgentInput,
  type CreateOrInstantiateAgentSuccess,
  type InstantiateAgentTemplateInput,
  type RemoveOccupiedSlotInput,
  type RemoveOccupiedSlotSuccess,
  type JourneyEditorDocument,
  type JourneySummary,
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
  instantiateAgentTemplate,
  saveAgentAsTemplate,
  type AgentLifecycleIdFactory,
} from '@/domain/agent-template'
import { instantiatePattern, removeSlot as removePatternSlot, unassignAgent, type PatternIdFactory } from '@/domain/pattern'
import type { AgentLifecycleRepository, EditorRepository, JourneyLifecycleRepository, OdysseyEditorRepository, RepositoryOperationOptions } from './editorRepository'

type InjectableFailure = 'NETWORK_FAILED' | 'RESPONSE_INVALID' | 'REVISION_CONFLICT'

export interface InMemoryEditorRepositoryOptions {
  journeys?: JourneyEditorDocument[]
  agentWorkflows?: AgentWorkflowEditorDocument[]
  agentTemplates?: AgentTemplate[]
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

export class InMemoryEditorRepository implements EditorRepository, AgentLifecycleRepository, JourneyLifecycleRepository {
  readonly #journeys = new Map<string, JourneyEditorDocument>()
  readonly #agentWorkflows = new Map<string, AgentWorkflowEditorDocument>()
  readonly #agentTemplates = new Map<string, AgentTemplate>()
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
