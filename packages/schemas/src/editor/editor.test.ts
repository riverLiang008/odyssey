import { describe, expect, it } from 'vitest'

import { createAgentTemplateSchema, journeyEditorDocumentSchema, agentWorkflowEditorDocumentSchema } from './editor'
import { createAgentLifecycleResponseSchemas } from '../repository'

const id = (suffix: string) => `0195f076-b6e6-7ef0-98db-${suffix.padStart(12, '0')}`
const time = '2026-08-13T00:00:00Z'

function templateCandidate() {
  return {
    schemaVersion: '1.0.0', id: id('1'), name: 'Minimal', description: null,
    source: 'user', ownerWorkspaceId: id('2') as string | null, sourceTemplateId: null,
    visibility: 'private', publicationStatus: 'draft', dependencies: [],
    snapshot: {
      workflow: {
        schemaVersion: '1.0.0',
        nodes: [
          { id: id('3'), type: 'start', name: 'Start', config: {} },
          { id: id('4'), type: 'end', name: 'End', config: {} },
        ],
        edges: [{ id: id('5'), sourceNodeId: id('3'), targetNodeId: id('4') }],
      },
      layout: {
        schemaVersion: '1.0.0',
        nodePlacements: [{ nodeId: id('3'), x: 0, y: 0 }, { nodeId: id('4'), x: 200, y: 0 }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      variables: [], reusableTools: [],
    },
    publishedAt: null, createdAt: time, updatedAt: time,
  }
}

describe('Agent Template contract', () => {
  it('accepts a private user snapshot with a valid aggregate', () => {
    expect(createAgentTemplateSchema().safeParse(templateCandidate()).success).toBe(true)
  })

  it('rejects user templates without an owner and unresolved layout references', () => {
    const candidate = templateCandidate()
    candidate.ownerWorkspaceId = null
    candidate.snapshot.layout.nodePlacements[0]!.nodeId = id('99')
    expect(createAgentTemplateSchema().safeParse(candidate).success).toBe(false)
  })

  it('enforces canonical dependency and publication invariants', () => {
    const candidate = templateCandidate()
    candidate.source = 'built_in'
    candidate.ownerWorkspaceId = null
    expect(createAgentTemplateSchema().safeParse(candidate).success).toBe(false)

    const published = templateCandidate()
    Object.assign(published, {
      visibility: 'public', publicationStatus: 'published', publishedAt: time,
      dependencies: [{ id: id('20'), kind: 'knowledge_space', key: 'research_knowledge', label: 'Research Knowledge', required: true }],
    })
    expect(createAgentTemplateSchema().safeParse(published).success).toBe(true)
    Object.assign(published, { dependencies: [
      { id: id('20'), kind: 'knowledge_space', key: 'research_knowledge', label: 'Research Knowledge', required: true },
      { id: id('21'), kind: 'knowledge_space', key: 'research_knowledge', label: 'Duplicate', required: false },
    ] })
    expect(createAgentTemplateSchema().safeParse(published).success).toBe(false)
  })
})

describe('Agent lifecycle success contract', () => {
  it('rejects valid-shaped cross-document identity and summary drift', () => {
    const journey = journeyEditorDocumentSchema.parse({
      journey: { id: id('30'), workspaceId: id('31'), name: 'Journey', description: null, status: 'draft', tags: [], revision: 1, createdAt: time, updatedAt: time },
      pattern: { schemaVersion: '1.0.0', id: id('32'), templateKey: 'solo_component', kind: 'solo_component', name: 'Solo', slots: [{ id: id('33'), topologyRole: 'solo', label: 'Solo', order: null, agentId: id('34'), configuration: {} }], routes: [], configuration: {} },
      agents: [{ id: id('34'), name: 'Agent', description: null, revision: 1, updatedAt: time }],
      inputGuardrail: { state: 'inactive' },
      outputGuardrail: { state: 'inactive' },
    })
    const agent = agentWorkflowEditorDocumentSchema.parse({
      agent: { id: id('34'), journeyId: id('30'), name: 'Agent', description: null, revision: 1, createdAt: time, updatedAt: time },
      workflow: { schemaVersion: '1.0.0', nodes: [{ id: id('35'), type: 'start', name: 'Start', config: {} }, { id: id('36'), type: 'end', name: 'End', config: {} }], edges: [{ id: id('37'), sourceNodeId: id('35'), targetNodeId: id('36') }] },
      layout: { schemaVersion: '1.0.0', nodePlacements: [{ nodeId: id('35'), x: 0, y: 0 }, { nodeId: id('36'), x: 200, y: 0 }], viewport: { x: 0, y: 0, zoom: 1 } },
      variables: [], reusableTools: [],
    })
    const schema = createAgentLifecycleResponseSchemas().createOrInstantiate
    expect(schema.safeParse({ journey, agent }).success).toBe(true)
    const wrongJourneyAgent = structuredClone(agent)
    wrongJourneyAgent.agent.journeyId = id('38') as typeof wrongJourneyAgent.agent.journeyId
    expect(schema.safeParse({ journey, agent: wrongJourneyAgent }).success).toBe(false)
    const driftedJourney = structuredClone(journey)
    driftedJourney.agents[0]!.name = 'Drifted'
    expect(schema.safeParse({ journey: driftedJourney, agent }).success).toBe(false)
    const orphanJourney = structuredClone(journey)
    orphanJourney.pattern.slots[0]!.agentId = null
    expect(schema.safeParse({ journey: orphanJourney, agent }).success).toBe(false)
  })
})
