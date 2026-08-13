import { uuidSchema, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { duplicateAgentAggregate, type AgentDuplicationIdFactory } from './agentDuplication'

function factory(start = 1000): AgentDuplicationIdFactory {
  let sequence = start
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return {
    agentId: next,
    workflowNodeId: next,
    workflowEdgeId: next,
    branchHandleId: next,
    branchConditionId: next,
    variableId: next,
    reusableToolId: next,
    toolStepId: next,
    configurationEntryId: next,
  }
}

function journeyWithEmptyTarget(sourceAgentId: UUID) {
  const journey = createJourneyEditorDocumentFixture()
  const sourceSlot = journey.pattern.slots.find((slot) => slot.agentId === sourceAgentId)!
  const targetSlot = journey.pattern.slots.find((slot) => slot.id !== sourceSlot.id)!
  targetSlot.agentId = null
  return { journey, sourceSlot, targetSlot }
}

describe('duplicateAgentAggregate', () => {
  it('deep clones an Agent, remaps owned IDs/references, and preserves external references', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const journeyBefore = structuredClone(journey)
    const sourceBefore = structuredClone(source)
    const result = duplicateAgentAggregate(
      journey,
      source,
      { sourceSlotId: sourceSlot.id, targetSlotId: targetSlot.id, name: 'Research Agent Copy', now: '2026-08-13T00:00:00Z' },
      factory(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.code)
    expect(journey).toEqual(journeyBefore)
    expect(source).toEqual(sourceBefore)
    expect(result.value.agent.agent.id).not.toBe(source.agent.id)
    expect(result.value.agent.agent.revision).toBe(1)
    expect(result.value.agent.agent.journeyId).toBe(source.agent.journeyId)
    expect(result.value.journey.pattern.slots.find((slot) => slot.id === targetSlot.id)?.agentId).toBe(result.value.agent.agent.id)
    expect(result.value.journey.agents.at(-1)?.name).toBe('Research Agent Copy')

    const sourceOwnedIds = [
      source.agent.id,
      ...source.variables.map((variable) => variable.id),
      ...source.reusableTools.map((tool) => tool.id),
      ...source.workflow.nodes.map((node) => node.id),
      ...source.workflow.edges.map((edge) => edge.id),
    ]
    const serializedClone = JSON.stringify(result.value.agent)
    sourceOwnedIds.forEach((ownedId) => expect(serializedClone).not.toContain(ownedId))
    expect(serializedClone).toContain(FIXTURE_IDS.knowledgeSpace)
  })

  it('remaps nested Loop graph IDs and layout references', () => {
    const source = createAgentWorkflowEditorDocumentFixture('loop')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const result = duplicateAgentAggregate(
      journey,
      source,
      { sourceSlotId: sourceSlot.id, targetSlotId: targetSlot.id, name: 'Loop Copy', now: '2026-08-13T00:00:00Z' },
      factory(2000),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.code)
    const oldLoop = source.workflow.nodes.find((node) => node.type === 'loop')!
    const newLoop = result.value.agent.workflow.nodes.find((node) => node.type === 'loop')!
    oldLoop.config.body.graph.nodes.forEach((node) => expect(JSON.stringify(newLoop)).not.toContain(node.id))
    const newNodeIds = new Set(newLoop.config.body.graph.nodes.map((node) => node.id))
    expect(newLoop.config.body.layout.nodePlacements.every((placement) => newNodeIds.has(placement.nodeId))).toBe(true)
  })

  it('remaps Task-local, Tool-step, reusable Tool, and API entry IDs while preserving template provenance', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const task = source.workflow.nodes.find((node) => node.type === 'task')!
    const localVariableId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000001')
    const stepId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000002')
    const headerId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000003')
    const formEntryId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000004')
    const reusableToolId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000005')
    const reusableHeaderId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000006')
    const sourceTemplateId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-100000000099')
    task.config.localVariables.push({ id: localVariableId, key: 'response', dataType: 'json', defaultValue: null })
    task.config.steps.push({
      id: stepId,
      kind: 'api_request',
      failureBehavior: { kind: 'fail_task' },
      configuration: {
        method: 'POST',
        url: { kind: 'literal', value: 'https://example.test' },
        headers: [{ id: headerId, name: 'X-Count', value: { kind: 'variable', variableId: source.variables[0]!.id } }],
        body: { kind: 'form_data', entries: [{ id: formEntryId, name: 'payload', value: { kind: 'variable', variableId: localVariableId } }] },
      },
      outputMapping: { sourceKey: 'response.data', targetVariableId: localVariableId },
    })
    source.reusableTools.push({
      id: reusableToolId,
      name: 'API Tool',
      sourceTemplateId,
      kind: 'api_request',
      inputBindings: [{ kind: 'variable', variableId: source.variables[0]!.id }],
      outputBinding: { sourceKey: 'response.data', targetVariableId: source.variables[0]!.id },
      configuration: {
        method: 'GET',
        url: { kind: 'literal', value: 'https://example.test' },
        headers: [{ id: reusableHeaderId, name: 'X-Test', value: { kind: 'literal', value: 'yes' } }],
        body: { kind: 'none' },
      },
    })
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const result = duplicateAgentAggregate(
      journey,
      source,
      { sourceSlotId: sourceSlot.id, targetSlotId: targetSlot.id, name: 'Tool Copy', now: '2026-08-13T00:00:00Z' },
      factory(3000),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.code)
    const serialized = JSON.stringify(result.value.agent)
    const ownedIds = [localVariableId, stepId, headerId, formEntryId, reusableToolId, reusableHeaderId]
    ownedIds.forEach((ownedId) => expect(serialized).not.toContain(ownedId))
    expect(serialized).toContain(sourceTemplateId)
    expect(serialized).toContain(FIXTURE_IDS.knowledgeSpace)
  })

  it.each([
    ['SOURCE_SLOT_NOT_FOUND', 'source_missing'],
    ['TARGET_SLOT_NOT_FOUND', 'target_missing'],
    ['SOURCE_SLOT_EMPTY', 'source_empty'],
    ['TARGET_SLOT_OCCUPIED', 'target_occupied'],
    ['INVALID_AGENT_NAME', 'empty_name'],
  ] as const)('fails atomically with %s', (expectedCode, variant) => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    if (variant === 'source_empty') sourceSlot.agentId = null
    if (variant === 'target_occupied') targetSlot.agentId = uuidSchema.parse(FIXTURE_IDS.plannerAgent)
    const before = structuredClone(journey)
    const result = duplicateAgentAggregate(
      journey,
      source,
      {
        sourceSlotId: variant === 'source_missing' ? uuidSchema.parse('0195f076-b6e6-7ef0-98db-eeeeeeeeeeee') : sourceSlot.id,
        targetSlotId: variant === 'target_missing' ? uuidSchema.parse('0195f076-b6e6-7ef0-98db-dddddddddddd') : targetSlot.id,
        name: variant === 'empty_name' ? '   ' : 'Copy',
        now: '2026-08-13T00:00:00Z',
      },
      factory(),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe(expectedCode)
    expect(journey).toEqual(before)
  })

  it('rejects duplicate generated IDs atomically', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const collision = uuidSchema.parse('0195f076-b6e6-7ef0-98db-cccccccccccc')
    const collidingFactory: AgentDuplicationIdFactory = {
      agentId: () => collision,
      workflowNodeId: () => collision,
      workflowEdgeId: () => collision,
      branchHandleId: () => collision,
      branchConditionId: () => collision,
      variableId: () => collision,
      reusableToolId: () => collision,
      toolStepId: () => collision,
      configurationEntryId: () => collision,
    }
    const result = duplicateAgentAggregate(
      journey,
      source,
      { sourceSlotId: sourceSlot.id, targetSlotId: targetSlot.id, name: 'Copy', now: '2026-08-13T00:00:00Z' },
      collidingFactory,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATED_ID_COLLISION')
  })

  it('rejects descendant IDs colliding with Journey-owned IDs', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const base = factory(6000)
    const collidingFactory: AgentDuplicationIdFactory = {
      ...base,
      workflowNodeId: () => journey.pattern.slots[0]!.id,
    }
    const result = duplicateAgentAggregate(journey, source, {
      sourceSlotId: sourceSlot.id,
      targetSlotId: targetSlot.id,
      name: 'Collision',
      now: '2026-08-13T00:00:00Z',
    }, collidingFactory)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATED_ID_COLLISION')
  })

  it('rejects generated IDs colliding with a Task knowledge-retrieval Knowledge Space ID', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const task = source.workflow.nodes.find((node) => node.type === 'task')!
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-200000000001')
    task.config.steps.push({
      id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-200000000002'),
      kind: 'knowledge_retrieval',
      label: 'Retrieve task knowledge',
      configuration: { knowledgeSpaceId, query: { kind: 'literal', value: 'evidence' }, topK: 5 },
      outputMapping: { sourceKey: 'retrieved_documents', targetVariableId: source.variables[0]!.id },
      failureBehavior: { kind: 'fail_task' },
    })
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const collidingFactory = factory(10000)
    collidingFactory.workflowNodeId = () => knowledgeSpaceId

    const result = duplicateAgentAggregate(journey, source, {
      sourceSlotId: sourceSlot.id,
      targetSlotId: targetSlot.id,
      name: 'Collision',
      now: '2026-08-13T00:00:00Z',
    }, collidingFactory)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATED_ID_COLLISION')
  })

  it('rejects generated IDs colliding with a Loop Task knowledge-retrieval Knowledge Space ID', () => {
    const source = createAgentWorkflowEditorDocumentFixture('loop')
    const loop = source.workflow.nodes.find((node) => node.type === 'loop')!
    const task = loop.config.body.graph.nodes.find((node) => node.type === 'task')!
    const knowledgeSpaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-300000000001')
    task.config.steps.push({
      id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-300000000002'),
      kind: 'knowledge_retrieval',
      label: 'Retrieve loop knowledge',
      configuration: { knowledgeSpaceId, query: { kind: 'literal', value: 'evidence' }, topK: 5 },
      outputMapping: { sourceKey: 'retrieved_documents', targetVariableId: source.variables[0]!.id },
      failureBehavior: { kind: 'fail_task' },
    })
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const collidingFactory = factory(11000)
    collidingFactory.workflowNodeId = () => knowledgeSpaceId

    const result = duplicateAgentAggregate(journey, source, {
      sourceSlotId: sourceSlot.id,
      targetSlotId: targetSlot.id,
      name: 'Loop Collision',
      now: '2026-08-13T00:00:00Z',
    }, collidingFactory)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATED_ID_COLLISION')
  })

  it('preserves external and literal strings even when equal to an owned UUID', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const ownedNodeId = source.workflow.nodes[0]!.id
    source.workflow.nodes.find((node) => node.type === 'agent_action')!.config.knowledgeSpaceIds = [ownedNodeId]
    source.variables[0]!.defaultValue = ownedNodeId
    source.reusableTools[0]!.sourceTemplateId = ownedNodeId
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const result = duplicateAgentAggregate(journey, source, {
      sourceSlotId: sourceSlot.id,
      targetSlotId: targetSlot.id,
      name: 'Preserved',
      now: '2026-08-13T00:00:00Z',
    }, factory(7000))
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.code)
    expect(result.value.agent.workflow.nodes.find((node) => node.type === 'agent_action')?.config.knowledgeSpaceIds).toEqual([ownedNodeId])
    expect(result.value.agent.variables[0]?.defaultValue).toBe(ownedNodeId)
    expect(result.value.agent.reusableTools[0]?.sourceTemplateId).toBe(ownedNodeId)
  })

  it('returns a typed failure when any factory method throws', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const throwingFactory = factory(8000)
    throwingFactory.agentId = () => { throw new Error('entropy unavailable') }
    const result = duplicateAgentAggregate(journey, source, {
      sourceSlotId: sourceSlot.id,
      targetSlotId: targetSlot.id,
      name: 'Failure',
      now: '2026-08-13T00:00:00Z',
    }, throwingFactory)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ID_FACTORY_FAILED')
  })

  it('does not treat UUID text in Journey metadata as an identity collision', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const { journey, sourceSlot, targetSlot } = journeyWithEmptyTarget(source.agent.id)
    const generatedAgentId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-999999999999')
    journey.journey.description = `Example text ${generatedAgentId}`
    const ids = factory(9000)
    ids.agentId = () => generatedAgentId
    const result = duplicateAgentAggregate(journey, source, {
      sourceSlotId: sourceSlot.id,
      targetSlotId: targetSlot.id,
      name: 'Allowed',
      now: '2026-08-13T00:00:00Z',
    }, ids)
    expect(result.ok).toBe(true)
  })
})
