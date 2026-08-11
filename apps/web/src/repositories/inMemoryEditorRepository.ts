import {
  agentWorkflowEditorDocumentSchema,
  journeyEditorDocumentSchema,
  saveAgentWorkflowInputSchema,
  saveAgentWorkflowSuccessSchema,
  saveJourneyInputSchema,
  saveJourneySuccessSchema,
  type AgentWorkflowEditorDocument,
  type JourneyEditorDocument,
  type RepositoryError,
  type RepositoryResult,
  type SaveAgentWorkflowInput,
  type SaveAgentWorkflowSuccess,
  type SaveJourneyInput,
  type SaveJourneySuccess,
  type UUID,
} from '@odyssey/schemas'

import type { EditorRepository, RepositoryOperationOptions } from './editorRepository'

type InjectableFailure = 'NETWORK_FAILED' | 'RESPONSE_INVALID' | 'REVISION_CONFLICT'

export interface InMemoryEditorRepositoryOptions {
  journeys?: JourneyEditorDocument[]
  agentWorkflows?: AgentWorkflowEditorDocument[]
  latencyMs?: number
  now?: () => string
}

export interface InMemoryEditorRepositoryControls {
  failNext(code: InjectableFailure): void
}

interface ScenarioState {
  nextFailure: InjectableFailure | null
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

export class InMemoryEditorRepository implements EditorRepository {
  readonly #journeys = new Map<string, JourneyEditorDocument>()
  readonly #agentWorkflows = new Map<string, AgentWorkflowEditorDocument>()
  readonly #latencyMs: number
  readonly #now: () => string
  readonly #scenario: ScenarioState

  constructor(options: InMemoryEditorRepositoryOptions = {}, scenario?: ScenarioState) {
    this.#latencyMs = options.latencyMs ?? 0
    this.#now = options.now ?? (() => new Date().toISOString())
    this.#scenario = scenario ?? { nextFailure: null }
    for (const document of options.journeys ?? []) {
      this.#journeys.set(document.journey.id, structuredClone(document))
    }
    for (const document of options.agentWorkflows ?? []) {
      this.#agentWorkflows.set(document.agent.id, structuredClone(document))
    }
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
    const parsed = agentWorkflowEditorDocumentSchema.safeParse(candidate)
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
    const parsedDocument = agentWorkflowEditorDocumentSchema.safeParse(candidate)
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

  #consumeConflict(): boolean {
    if (this.#scenario.nextFailure !== 'REVISION_CONFLICT') return false
    this.#scenario.nextFailure = null
    return true
  }
}

export function createInMemoryEditorRepositoryScenario(
  options: InMemoryEditorRepositoryOptions = {},
): { repository: EditorRepository; controls: InMemoryEditorRepositoryControls } {
  const scenario: ScenarioState = { nextFailure: null }
  return {
    repository: new InMemoryEditorRepository(options, scenario),
    controls: {
      failNext(code) {
        scenario.nextFailure = code
      },
    },
  }
}
