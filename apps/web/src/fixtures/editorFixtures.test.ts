import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

import { PATTERN_KINDS, createAgentWorkflowEditorDocumentSchema, uuidSchema } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { createInMemoryEditorRepositoryScenario } from '../repositories'
import {
  createAgentWorkflowEditorDocumentFixture,
  createJourneyEditorDocumentFixture,
  createPatternConfigFixture,
  createWorkflowGraphFixture,
  FIXTURE_IDS,
} from './editorFixtures'

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : extname(entry.name) === '.ts' && !entry.name.endsWith('.test.ts')
        ? [path]
        : []
  })
}

describe('M2.1 deterministic fixtures', () => {
  it('builds every frozen Pattern kind through the runtime contract', () => {
    const patterns = PATTERN_KINDS.map((kind) => createPatternConfigFixture({ kind }))
    expect(patterns.map((pattern) => pattern.kind)).toEqual(PATTERN_KINDS)
  })

  it('builds minimal, research, and Loop proof workflows', () => {
    const minimal = createWorkflowGraphFixture('minimal')
    const research = createWorkflowGraphFixture('research')
    const loop = createWorkflowGraphFixture('loop')

    expect(minimal.nodes.map((node) => node.type)).toEqual(['start', 'end'])
    expect(research.nodes.map((node) => node.type)).toEqual([
      'start',
      'agent_action',
      'branch',
      'task',
      'end',
    ])
    expect(loop.nodes.map((node) => node.type)).toEqual(['start', 'loop', 'end'])
  })

  it('returns fresh objects instead of shared mutable singletons', () => {
    const first = createJourneyEditorDocumentFixture()
    const second = createJourneyEditorDocumentFixture()
    first.journey.name = 'Mutated by a test'
    first.pattern.slots[0]!.label = 'Mutated slot'

    expect(second.journey.name).toBe('Research System')
    expect(second.pattern.slots[0]?.label).toBe('Agent 1')
  })
})

describe('M2.1 repository round trip', () => {
  it('round-trips Journey and Agent aggregate replacements', async () => {
    const journey = createJourneyEditorDocumentFixture()
    const agentDocuments = (['minimal', 'research', 'loop'] as const).map((variant) =>
      createAgentWorkflowEditorDocumentFixture(variant),
    )
    const { repository } = createInMemoryEditorRepositoryScenario({
      journeys: [journey],
      agentWorkflows: agentDocuments,
      now: () => '2026-08-12T02:00:00Z',
    })

    const loadedJourney = await repository.loadJourney(journey.journey.id)
    expect(loadedJourney.ok).toBe(true)
    if (!loadedJourney.ok) return
    loadedJourney.value.pattern.name = 'Round-tripped pattern'
    const journeySave = await repository.saveJourney({
      journeyId: journey.journey.id,
      expectedRevision: loadedJourney.value.journey.revision,
      pattern: loadedJourney.value.pattern,
    })
    expect(journeySave.ok && journeySave.value.revision).toBe(2)

    const researchAgent = agentDocuments[1]
    const loadedAgent = await repository.loadAgentWorkflow(
      researchAgent.agent.journeyId,
      researchAgent.agent.id,
    )
    expect(loadedAgent.ok).toBe(true)
    if (!loadedAgent.ok) return
    loadedAgent.value.layout.viewport.zoom = 1.25
    const agentSave = await repository.saveAgentWorkflow({
      journeyId: loadedAgent.value.agent.journeyId,
      agentId: loadedAgent.value.agent.id,
      expectedRevision: loadedAgent.value.agent.revision,
      workflow: loadedAgent.value.workflow,
      layout: loadedAgent.value.layout,
      variables: loadedAgent.value.variables,
      reusableTools: loadedAgent.value.reusableTools,
    })
    expect(agentSave.ok && agentSave.value.revision).toBe(2)

    const reloadedJourney = await repository.loadJourney(journey.journey.id)
    const reloadedAgent = await repository.loadAgentWorkflow(
      researchAgent.agent.journeyId,
      researchAgent.agent.id,
    )
    expect(reloadedJourney.ok && reloadedJourney.value.pattern.name).toBe(
      'Round-tripped pattern',
    )
    expect(reloadedAgent.ok && reloadedAgent.value.layout.viewport.zoom).toBe(1.25)
    expect(reloadedJourney.ok && reloadedJourney.value.journey.revision).toBe(2)
    expect(reloadedAgent.ok && reloadedAgent.value.agent.revision).toBe(2)
  })
})

describe('M2.1 boundary audit', () => {
  it('keeps shared schemas platform-neutral', () => {
    const schemaRoot = resolve(process.cwd(), '../../packages/schemas/src')
    const source = collectTypeScriptFiles(schemaRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/from ['"](?:vue|pinia|vue-router|naive-ui|@vue-flow)/)
    expect(source).not.toContain('Record<string, unknown>')
  })

  it('keeps UI-only fields out of repository documents', () => {
    const journey = createJourneyEditorDocumentFixture()
    const agent = createAgentWorkflowEditorDocumentFixture('loop')
    const persisted = JSON.stringify({ journey, agent })

    for (const forbiddenField of [
      'selectedNodeId',
      'selectedSlotId',
      'openPanel',
      'focusMode',
      'dragSession',
      'normalized_name',
      'nodePositions',
      'sourceHandle',
    ]) {
      expect(persisted).not.toContain(`"${forbiddenField}"`)
    }
    expect(agent.agent.journeyId).toBe(FIXTURE_IDS.journey)
  })
})

describe('M2.1 aggregate reference validation', () => {
  it('recursively rejects missing reusable Tools in Loop body Agent Actions', () => {
    const document = createAgentWorkflowEditorDocumentFixture('loop')
    const loop = document.workflow.nodes.find((node) => node.type === 'loop')
    expect(loop?.type).toBe('loop')
    if (loop?.type !== 'loop') return
    const action = loop.config.body.graph.nodes.find((node) => node.type === 'agent_action')
    expect(action?.type).toBe('agent_action')
    if (action?.type !== 'agent_action') return
    action.config.reusableToolIds = [uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8999')]
    expect(createAgentWorkflowEditorDocumentSchema().safeParse(document).success).toBe(false)
  })

  it('rejects out-of-scope Task Variables and accepts explicitly registered System Variables', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const task = document.workflow.nodes.find((node) => node.type === 'task')
    expect(task?.type).toBe('task')
    if (task?.type !== 'task') return
    const systemVariableId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8998')
    task.config.steps = [
      {
        id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8997'),
        kind: 'llm_call',
        label: null,
        configuration: { model: 'gpt-4o', prompt: { kind: 'variable', variableId: systemVariableId } },
        outputMapping: { sourceKey: 'response.text', targetVariableId: document.variables[0]!.id },
        failureBehavior: { kind: 'fail_task' },
      },
    ]
    expect(createAgentWorkflowEditorDocumentSchema().safeParse(document).success).toBe(false)
    expect(
      createAgentWorkflowEditorDocumentSchema({ systemVariableIds: [systemVariableId] }).safeParse(document).success,
    ).toBe(true)
  })

  it('rejects read-only write targets and aggregate-wide duplicate Variable IDs', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    document.variables[0]!.readOnly = true
    const task = document.workflow.nodes.find((node) => node.type === 'task')
    expect(task?.type).toBe('task')
    if (task?.type !== 'task') return
    task.config.localVariables = [
      { id: document.variables[0]!.id, key: 'duplicate', dataType: 'json', defaultValue: null },
    ]
    task.config.steps = [
      {
        id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8996'),
        kind: 'set_variable',
        label: null,
        configuration: { targetVariableId: document.variables[0]!.id, operation: 'assign', value: { kind: 'literal', value: 1 } },
        outputMapping: null,
        failureBehavior: { kind: 'fail_task' },
      },
    ]
    expect(createAgentWorkflowEditorDocumentSchema().safeParse(document).success).toBe(false)
  })

  it('validates reusable Tool Variable inputs and writable outputs', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const missingVariableId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8995')
    document.reusableTools[0]!.inputBindings = [{ kind: 'variable', variableId: missingVariableId }]
    expect(createAgentWorkflowEditorDocumentSchema().safeParse(document).success).toBe(false)

    document.reusableTools[0]!.inputBindings = []
    document.variables[0]!.readOnly = true
    document.reusableTools[0]!.outputBinding = {
      sourceKey: 'retrieved_documents',
      targetVariableId: document.variables[0]!.id,
    }
    expect(createAgentWorkflowEditorDocumentSchema().safeParse(document).success).toBe(false)
  })
})
