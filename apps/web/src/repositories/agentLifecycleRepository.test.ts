import { uuidSchema, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { saveAgentAsTemplate, type AgentLifecycleIdFactory } from '@/domain/agent-template'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { createInMemoryEditorRepositoryScenario } from './inMemoryEditorRepository'

function factory(start = 70000): AgentLifecycleIdFactory {
  let sequence = start
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return {
    agentId: next, agentTemplateId: next, workflowNodeId: next, workflowEdgeId: next,
    branchHandleId: next, branchConditionId: next, variableId: next, reusableToolId: next,
    toolStepId: next, configurationEntryId: next,
  }
}

describe('Agent lifecycle repository', () => {
  it('starts with a real empty Template library and exposes Save as Template results', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const agent = createAgentWorkflowEditorDocumentFixture('research')
    const { repository } = createInMemoryEditorRepositoryScenario({ journeys: [journey], agentWorkflows: [agent], idFactory: factory() })
    const empty = await repository.listAgentTemplates(uuidSchema.parse(FIXTURE_IDS.workspace))
    expect(empty).toEqual({ ok: true, value: [] })
    const saved = await repository.saveAgentAsTemplate({
      journeyId: journey.journey.id, agentId: agent.agent.id, ownerWorkspaceId: journey.journey.workspaceId,
      name: 'Saved Research', description: null,
    })
    expect(saved.ok).toBe(true)
    const listed = await repository.listAgentTemplates(journey.journey.workspaceId)
    expect(listed.ok && listed.value.map((template) => template.name)).toEqual(['Saved Research'])
  })

  it('does not write Create Agent state when the response is invalid', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const emptySlot = journey.pattern.slots.at(-1)!
    emptySlot.agentId = null
    const { repository, controls } = createInMemoryEditorRepositoryScenario({ journeys: [journey], idFactory: factory(80000) })
    controls.failNext('RESPONSE_INVALID')
    const result = await repository.createJourneyAgent({ journeyId: journey.journey.id, slotId: emptySlot.id, name: 'Atomic', description: null })
    expect(result.ok).toBe(false)
    const loaded = await repository.loadJourney(journey.journey.id)
    expect(loaded.ok && loaded.value.pattern.slots.find((slot) => slot.id === emptySlot.id)?.agentId).toBeNull()
    expect(loaded.ok && loaded.value.agents).toEqual(journey.agents)
  })

  it('atomically rejects internally consistent lifecycle responses for another Journey', async () => {
    const otherJourneyId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-565656565656')

    const assertRejected = async (operation: 'create' | 'instantiate') => {
      const journey = createJourneyEditorDocumentFixture()
      const emptySlot = journey.pattern.slots.at(-1)!
      emptySlot.agentId = null
      const templateResult = saveAgentAsTemplate(
        createAgentWorkflowEditorDocumentFixture('research'),
        journey.journey.workspaceId,
        'Local Template',
        null,
        '2026-08-13T00:00:00Z',
        factory(operation === 'create' ? 130000 : 140000),
      )
      if (!templateResult.ok) throw new Error(templateResult.error.code)
      const { repository, controls } = createInMemoryEditorRepositoryScenario({
        journeys: [journey],
        agentTemplates: [templateResult.value],
        idFactory: factory(operation === 'create' ? 150000 : 160000),
      })
      let returnedAgentId: UUID | null = null
      controls.transformNextCreateOrInstantiateResponse((response) => {
        returnedAgentId = response.agent.agent.id
        response.journey.journey.id = otherJourneyId
        response.agent.agent.journeyId = otherJourneyId
        return response
      })

      const result = operation === 'create'
        ? await repository.createJourneyAgent({
            journeyId: journey.journey.id,
            slotId: emptySlot.id,
            name: 'Wrong Journey',
            description: null,
          })
        : await repository.instantiateAgentTemplate({
            journeyId: journey.journey.id,
            slotId: emptySlot.id,
            templateId: templateResult.value.id,
            dependencyMappings: [],
          })

      expect(result).toEqual({ ok: false, error: { code: 'RESPONSE_INVALID' } })
      const loadedJourney = await repository.loadJourney(journey.journey.id)
      expect(loadedJourney.ok && loadedJourney.value).toEqual(journey)
      expect(returnedAgentId).not.toBeNull()
      if (returnedAgentId) {
        expect(await repository.loadAgentWorkflow(journey.journey.id, returnedAgentId)).toEqual({
          ok: false,
          error: { code: 'NOT_FOUND' },
        })
      }
    }

    await assertRejected('create')
    await assertRejected('instantiate')
  })

  it('reuses the System Variable registry across save, list, load, and instantiate', async () => {
    const systemVariableId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-abcdefabcdef')
    const journey = createJourneyEditorDocumentFixture()
    const emptySlot = journey.pattern.slots.at(-1)!
    emptySlot.agentId = null
    const agent = createAgentWorkflowEditorDocumentFixture('research')
    const action = agent.workflow.nodes.find((node) => node.type === 'agent_action')!
    action.config.goal = { kind: 'variable', variableId: systemVariableId }
    const { repository } = createInMemoryEditorRepositoryScenario({
      journeys: [journey], agentWorkflows: [agent], systemVariableIds: [systemVariableId], idFactory: factory(90000),
    })
    const saved = await repository.saveAgentAsTemplate({
      journeyId: journey.journey.id, agentId: agent.agent.id, ownerWorkspaceId: journey.journey.workspaceId,
      name: 'System-aware', description: null,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error(saved.error.code)
    expect((await repository.listAgentTemplates(journey.journey.workspaceId)).ok).toBe(true)
    const loaded = await repository.loadAgentTemplate(journey.journey.workspaceId, saved.value.id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) throw new Error(loaded.error.code)
    loaded.value.name = 'mutated client copy'
    const reloaded = await repository.loadAgentTemplate(journey.journey.workspaceId, saved.value.id)
    expect(reloaded.ok && reloaded.value.name).toBe('System-aware')
    const instantiated = await repository.instantiateAgentTemplate({
      journeyId: journey.journey.id, slotId: emptySlot.id, templateId: saved.value.id, dependencyMappings: [],
    })
    expect(instantiated.ok).toBe(true)
  })

  it('supports abort and invalid-response isolation for Template load/save', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const agent = createAgentWorkflowEditorDocumentFixture('research')
    const { repository, controls } = createInMemoryEditorRepositoryScenario({ journeys: [journey], agentWorkflows: [agent], idFactory: factory(100000) })
    controls.failNext('RESPONSE_INVALID')
    const failed = await repository.saveAgentAsTemplate({
      journeyId: journey.journey.id, agentId: agent.agent.id, ownerWorkspaceId: journey.journey.workspaceId,
      name: 'Must not persist', description: null,
    })
    expect(failed.ok).toBe(false)
    expect(await repository.listAgentTemplates(journey.journey.workspaceId)).toEqual({ ok: true, value: [] })
    const controller = new AbortController()
    controller.abort()
    expect(await repository.loadAgentTemplate(journey.journey.workspaceId, uuidSchema.parse(FIXTURE_IDS.reusableTool), { signal: controller.signal })).toEqual({ ok: false, error: { code: 'ABORTED' } })
  })

  it('lists and instantiates another Workspace public Template through dependency mapping', async () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const otherWorkspaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-121212121212')
    const dependencyId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-343434343434')
    const saved = saveAgentAsTemplate(source, otherWorkspaceId, 'Public Research', null, '2026-08-13T00:00:00Z', factory(110000))
    if (!saved.ok) throw new Error(saved.error.code)
    Object.assign(saved.value, {
      visibility: 'public', publicationStatus: 'published', publishedAt: '2026-08-13T00:00:00Z',
      dependencies: [{ id: dependencyId, kind: 'knowledge_space', key: 'research_knowledge', label: 'Research Knowledge', required: true }],
    })
    saved.value.snapshot.reusableTools.forEach((tool) => {
      if (tool.kind === 'knowledge_retrieval') tool.configuration.knowledgeSpaceId = dependencyId
    })
    saved.value.snapshot.workflow.nodes.forEach((node) => {
      if (node.type === 'agent_action') node.config.knowledgeSpaceIds = [dependencyId]
    })
    const journey = createJourneyEditorDocumentFixture()
    const emptySlot = journey.pattern.slots.at(-1)!
    emptySlot.agentId = null
    const { repository } = createInMemoryEditorRepositoryScenario({ journeys: [journey], agentTemplates: [saved.value], idFactory: factory(120000) })
    const listed = await repository.listAgentTemplates(journey.journey.workspaceId)
    expect(listed.ok && listed.value.map((template) => template.id)).toContain(saved.value.id)
    expect((await repository.loadAgentTemplate(journey.journey.workspaceId, saved.value.id)).ok).toBe(true)
    const instantiated = await repository.instantiateAgentTemplate({
      journeyId: journey.journey.id, slotId: emptySlot.id, templateId: saved.value.id,
      dependencyMappings: [{ dependencyId, assetId: uuidSchema.parse(FIXTURE_IDS.knowledgeSpace) }],
    })
    expect(instantiated.ok).toBe(true)
    if (!instantiated.ok) throw new Error(instantiated.error.code)
    expect(JSON.stringify(instantiated.value.agent)).toContain(FIXTURE_IDS.knowledgeSpace)
    expect(JSON.stringify(instantiated.value.agent)).not.toContain(dependencyId)
  })
})
