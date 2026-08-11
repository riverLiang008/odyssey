import {
  agentWorkflowEditorDocumentSchema,
  journeyEditorDocumentSchema,
  type AgentWorkflowEditorDocument,
  type JourneyEditorDocument,
} from '@odyssey/schemas'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInMemoryEditorRepositoryScenario } from './inMemoryEditorRepository'

const JOURNEY_ID = '0195f076-b6e6-7ef0-98db-d721990f8800'
const WORKSPACE_ID = '0195f076-b6e6-7ef0-98db-d721990f8000'
const AGENT_ID = '0195f076-b6e6-7ef0-98db-d721990f8801'
const PATTERN_ID = '0195f076-b6e6-7ef0-98db-d721990f8820'
const SLOT_ID = '0195f076-b6e6-7ef0-98db-d721990f8810'
const ROUTE_ID = '0195f076-b6e6-7ef0-98db-d721990f8821'
const START_ID = '0195f076-b6e6-7ef0-98db-d721990f8830'
const END_ID = '0195f076-b6e6-7ef0-98db-d721990f8832'
const EDGE_ID = '0195f076-b6e6-7ef0-98db-d721990f8840'
const INITIAL_TIME = '2026-08-12T00:00:00Z'
const SAVED_TIME = '2026-08-12T01:00:00Z'

function createJourneyDocument(): JourneyEditorDocument {
  return journeyEditorDocumentSchema.parse({
    journey: {
      id: JOURNEY_ID,
      workspaceId: WORKSPACE_ID,
      name: 'Research System',
      description: null,
      status: 'draft',
      tags: ['research'],
      revision: 1,
      createdAt: INITIAL_TIME,
      updatedAt: INITIAL_TIME,
    },
    pattern: {
      schemaVersion: '1.0.0',
      id: PATTERN_ID,
      templateKey: 'solo_component',
      kind: 'solo_component',
      name: 'Research pattern',
      slots: [
        {
          id: SLOT_ID,
          topologyRole: null,
          label: 'Research',
          order: 0,
          agentId: AGENT_ID,
          configuration: {},
        },
      ],
      routes: [
        { id: ROUTE_ID, sourceSlotId: SLOT_ID, target: { type: 'journey_end' } },
      ],
      configuration: {},
    },
    agents: [
      {
        id: AGENT_ID,
        name: 'Research Agent',
        description: null,
        revision: 1,
        updatedAt: INITIAL_TIME,
      },
    ],
  })
}

function createAgentDocument(): AgentWorkflowEditorDocument {
  return agentWorkflowEditorDocumentSchema.parse({
    agent: {
      id: AGENT_ID,
      journeyId: JOURNEY_ID,
      name: 'Research Agent',
      description: null,
      revision: 1,
      createdAt: INITIAL_TIME,
      updatedAt: INITIAL_TIME,
    },
    workflow: {
      schemaVersion: '1.0.0',
      nodes: [
        { id: START_ID, type: 'start', name: 'Start', config: {} },
        { id: END_ID, type: 'end', name: 'End', config: {} },
      ],
      edges: [{ id: EDGE_ID, sourceNodeId: START_ID, targetNodeId: END_ID }],
    },
    layout: {
      schemaVersion: '1.0.0',
      nodePlacements: [
        { nodeId: START_ID, x: 80, y: 220 },
        { nodeId: END_ID, x: 520, y: 220 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    variables: [],
    reusableTools: [],
  })
}

function createScenario(latencyMs = 0) {
  return createInMemoryEditorRepositoryScenario({
    journeys: [createJourneyDocument()],
    agentWorkflows: [createAgentDocument()],
    latencyMs,
    now: () => SAVED_TIME,
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('InMemoryEditorRepository', () => {
  it('returns deep-cloned documents from load', async () => {
    const { repository } = createScenario()
    const first = await repository.loadJourney(createJourneyDocument().journey.id)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    first.value.journey.name = 'Caller mutation'
    first.value.pattern.slots[0]!.label = 'Changed slot'

    const second = await repository.loadJourney(createJourneyDocument().journey.id)
    expect(second.ok && second.value.journey.name).toBe('Research System')
    expect(second.ok && second.value.pattern.slots[0]?.label).toBe('Research')
  })

  it('atomically saves a Journey replacement and increments revision', async () => {
    const { repository } = createScenario()
    const document = createJourneyDocument()
    const pattern = structuredClone(document.pattern)
    pattern.name = 'Updated pattern'
    const result = await repository.saveJourney({
      journeyId: document.journey.id,
      expectedRevision: 1,
      pattern,
    })
    pattern.name = 'Caller changed after save'

    expect(result).toEqual({
      ok: true,
      value: { journeyId: document.journey.id, revision: 2, updatedAt: SAVED_TIME },
    })
    const loaded = await repository.loadJourney(document.journey.id)
    expect(loaded.ok && loaded.value.pattern.name).toBe('Updated pattern')
  })

  it('returns conflict without writing when expected revision is stale', async () => {
    const { repository, controls } = createScenario()
    const document = createJourneyDocument()
    const pattern = structuredClone(document.pattern)
    pattern.name = 'Must not persist'
    const result = await repository.saveJourney({
      journeyId: document.journey.id,
      expectedRevision: 2,
      pattern,
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'REVISION_CONFLICT', expectedRevision: 2, currentRevision: 1 },
    })
    controls.failNext('REVISION_CONFLICT')
    expect(
      await repository.saveJourney({
        journeyId: document.journey.id,
        expectedRevision: 1,
        pattern,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'REVISION_CONFLICT', expectedRevision: 1, currentRevision: 1 },
    })
    const loaded = await repository.loadJourney(document.journey.id)
    expect(loaded.ok && loaded.value.pattern.name).toBe('Research pattern')
  })

  it('injects network and invalid-response failures without writing', async () => {
    const { repository, controls } = createScenario()
    const document = createJourneyDocument()
    const pattern = structuredClone(document.pattern)
    pattern.name = 'Must not persist'

    controls.failNext('NETWORK_FAILED')
    expect(
      await repository.saveJourney({ journeyId: document.journey.id, expectedRevision: 1, pattern }),
    ).toEqual({ ok: false, error: { code: 'NETWORK_FAILED' } })

    controls.failNext('RESPONSE_INVALID')
    expect(await repository.loadJourney(document.journey.id)).toEqual({
      ok: false,
      error: { code: 'RESPONSE_INVALID' },
    })
    const loaded = await repository.loadJourney(document.journey.id)
    expect(loaded.ok && loaded.value.journey.revision).toBe(1)
  })

  it('supports deterministic abort during injected latency', async () => {
    vi.useFakeTimers()
    const { repository } = createScenario(100)
    const controller = new AbortController()
    const pending = repository.loadJourney(createJourneyDocument().journey.id, {
      signal: controller.signal,
    })
    controller.abort()
    await vi.runAllTimersAsync()
    expect(await pending).toEqual({ ok: false, error: { code: 'ABORTED' } })
  })

  it('saves Agent workflow independently from Journey revision', async () => {
    const { repository } = createScenario()
    const agent = createAgentDocument()
    const result = await repository.saveAgentWorkflow({
      journeyId: agent.agent.journeyId,
      agentId: agent.agent.id,
      expectedRevision: 1,
      workflow: agent.workflow,
      layout: agent.layout,
      variables: agent.variables,
      reusableTools: agent.reusableTools,
    })
    expect(result.ok && result.value.revision).toBe(2)

    const journey = await repository.loadJourney(agent.agent.journeyId)
    expect(journey.ok && journey.value.journey.revision).toBe(1)
  })

  it('rejects an Agent save whose layout references a missing node', async () => {
    const { repository } = createScenario()
    const agent = createAgentDocument()
    const unrelatedNodeId = createJourneyDocument().pattern.slots[0]!.id
    const invalidLayout = {
      ...agent.layout,
      nodePlacements: [
        ...agent.layout.nodePlacements,
        { nodeId: unrelatedNodeId, x: 0, y: 0 },
      ],
    }
    const result = await repository.saveAgentWorkflow({
      journeyId: agent.agent.journeyId,
      agentId: agent.agent.id,
      expectedRevision: 1,
      workflow: agent.workflow,
      layout: invalidLayout,
      variables: agent.variables,
      reusableTools: agent.reusableTools,
    })
    expect(result).toEqual({ ok: false, error: { code: 'RESPONSE_INVALID' } })
  })

  it('keeps repository instances isolated', async () => {
    const first = createScenario().repository
    const second = createScenario().repository
    const document = createJourneyDocument()
    const pattern = structuredClone(document.pattern)
    pattern.name = 'First repository only'
    await first.saveJourney({ journeyId: document.journey.id, expectedRevision: 1, pattern })

    const other = await second.loadJourney(document.journey.id)
    expect(other.ok && other.value.pattern.name).toBe('Research pattern')
  })
})
