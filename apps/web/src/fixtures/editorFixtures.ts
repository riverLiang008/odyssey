import {
  agentWorkflowEditorDocumentSchema,
  canvasLayoutSchema,
  journeyEditorDocumentSchema,
  patternConfigSchema,
  workflowGraphSchema,
  type AgentWorkflowEditorDocument,
  type CanvasLayout,
  type JourneyEditorDocument,
  type PatternConfig,
  type PatternKind,
  type WorkflowGraph,
} from '@odyssey/schemas'

export const FIXTURE_IDS = {
  workspace: '0195f076-b6e6-7ef0-98db-d721990f8000',
  journey: '0195f076-b6e6-7ef0-98db-d721990f8800',
  researchAgent: '0195f076-b6e6-7ef0-98db-d721990f8801',
  plannerAgent: '0195f076-b6e6-7ef0-98db-d721990f8802',
  reviewerAgent: '0195f076-b6e6-7ef0-98db-d721990f8803',
  knowledgeSpace: '0195f076-b6e6-7ef0-98db-d721990f8890',
  variable: '0195f076-b6e6-7ef0-98db-d721990f8860',
  reusableTool: '0195f076-b6e6-7ef0-98db-d721990f8870',
} as const

const FIXTURE_TIME = '2026-08-12T00:00:00Z'

const PATTERN_IDS: Record<PatternKind, string> = {
  hub_and_spoke: '0195f076-b6e6-7ef0-98db-d721990f8a10',
  diamond_loop: '0195f076-b6e6-7ef0-98db-d721990f8a20',
  linear_sequence: '0195f076-b6e6-7ef0-98db-d721990f8a30',
  solo_component: '0195f076-b6e6-7ef0-98db-d721990f8a40',
}

const SLOT_IDS = [
  '0195f076-b6e6-7ef0-98db-d721990f8b10',
  '0195f076-b6e6-7ef0-98db-d721990f8b11',
  '0195f076-b6e6-7ef0-98db-d721990f8b12',
] as const
const ROUTE_IDS = [
  '0195f076-b6e6-7ef0-98db-d721990f8c10',
  '0195f076-b6e6-7ef0-98db-d721990f8c11',
  '0195f076-b6e6-7ef0-98db-d721990f8c12',
] as const

export interface PatternFixtureOptions {
  kind?: PatternKind
  agentIds?: Array<string | null>
}

export function createPatternConfigFixture(
  options: PatternFixtureOptions = {},
): PatternConfig {
  const kind = options.kind ?? 'linear_sequence'
  const agentIds = options.agentIds ?? [FIXTURE_IDS.researchAgent, FIXTURE_IDS.plannerAgent]
  const slotCount = kind === 'solo_component' ? 1 : agentIds.length
  const slots = Array.from({ length: slotCount }, (_, index) => ({
    id: SLOT_IDS[index],
    topologyRole:
      kind === 'hub_and_spoke' ? (index === 0 ? 'hub' : 'spoke') :
      kind === 'diamond_loop' ? (index === 0 ? 'entry' : 'loop') :
      kind === 'solo_component' ? 'solo' : null,
    label: `Agent ${index + 1}`,
    order: kind === 'linear_sequence' || kind === 'diamond_loop' ? index : null,
    agentId: agentIds[index] ?? null,
    configuration: {},
  }))
  const routes = kind === 'solo_component' ? [] : kind === 'hub_and_spoke'
    ? slots.slice(1).map((slot, index) => ({
        id: ROUTE_IDS[index], sourceSlotId: slots[0]!.id,
        target: { type: 'slot' as const, slotId: slot.id },
      }))
    : slots.map((slot, index) => ({
        id: ROUTE_IDS[index], sourceSlotId: slot.id,
        target: kind === 'diamond_loop'
          ? { type: 'slot' as const, slotId: slots[(index + 1) % slots.length]!.id }
          : index + 1 < slots.length
            ? { type: 'slot' as const, slotId: slots[index + 1]!.id }
            : { type: 'journey_end' as const },
      }))

  return patternConfigSchema.parse({
    schemaVersion: '1.0.0',
    id: PATTERN_IDS[kind],
    templateKey: kind,
    kind,
    name: `${kind} fixture`,
    slots,
    routes,
    configuration: {},
  })
}

export type WorkflowFixtureVariant = 'minimal' | 'research' | 'loop'

const NODE_IDS = {
  start: '0195f076-b6e6-7ef0-98db-d721990f8d10',
  action: '0195f076-b6e6-7ef0-98db-d721990f8d11',
  branch: '0195f076-b6e6-7ef0-98db-d721990f8d12',
  task: '0195f076-b6e6-7ef0-98db-d721990f8d13',
  loop: '0195f076-b6e6-7ef0-98db-d721990f8d14',
  end: '0195f076-b6e6-7ef0-98db-d721990f8d15',
  loopStart: '0195f076-b6e6-7ef0-98db-d721990f8d16',
  loopTask: '0195f076-b6e6-7ef0-98db-d721990f8d17',
  loopAction: '0195f076-b6e6-7ef0-98db-d721990f8d18',
  loopEnd: '0195f076-b6e6-7ef0-98db-d721990f8d19',
} as const
const EDGE_IDS = Array.from(
  { length: 12 },
  (_, index) => `0195f076-b6e6-7ef0-98db-d721990f8e${String(index).padStart(2, '0')}`,
)

function startNode() {
  return { id: NODE_IDS.start, type: 'start' as const, name: 'Start', config: {} }
}
function endNode() {
  return { id: NODE_IDS.end, type: 'end' as const, name: 'End', config: {} }
}
function agentActionNode(id: string = NODE_IDS.action) {
  return {
    id,
    type: 'agent_action' as const,
    name: 'Research and synthesize',
    config: {
      model: 'gpt-4o',
      goal: { kind: 'literal' as const, value: 'Research the requested topic.' },
      knowledgeSpaceIds: [FIXTURE_IDS.knowledgeSpace],
      reusableToolIds: [FIXTURE_IDS.reusableTool],
    },
  }
}
function taskNode(id: string = NODE_IDS.task) {
  return {
    id,
    type: 'task' as const,
    name: 'Prepare brief',
    config: { localVariables: [], steps: [] },
  }
}
function edge(index: number, sourceNodeId: string, targetNodeId: string, sourceHandleId?: string) {
  return { id: EDGE_IDS[index], sourceNodeId, targetNodeId, ...(sourceHandleId ? { sourceHandleId } : {}) }
}

export function createWorkflowGraphFixture(
  variant: WorkflowFixtureVariant = 'minimal',
): WorkflowGraph {
  if (variant === 'minimal') {
    return workflowGraphSchema.parse({
      schemaVersion: '1.0.0',
      nodes: [startNode(), endNode()],
      edges: [edge(0, NODE_IDS.start, NODE_IDS.end)],
    })
  }

  if (variant === 'research') {
    const caseId = '0195f076-b6e6-7ef0-98db-d721990f8f10'
    const defaultId = '0195f076-b6e6-7ef0-98db-d721990f8f11'
    return workflowGraphSchema.parse({
      schemaVersion: '1.0.0',
      nodes: [
        startNode(),
        agentActionNode(),
        {
          id: NODE_IDS.branch,
          type: 'branch',
          name: 'Enough sources?',
          config: {
            cases: [
              {
                id: caseId,
                label: 'Enough evidence',
                match: 'all',
                conditions: [
                  {
                    id: '0195f076-b6e6-7ef0-98db-d721990f8f12',
                    left: { kind: 'variable', variableId: FIXTURE_IDS.variable },
                    operator: 'gte',
                    right: { kind: 'literal', value: 3 },
                  },
                ],
              },
            ],
            defaultCase: { id: defaultId, label: 'Gather more' },
          },
        },
        taskNode(),
        endNode(),
      ],
      edges: [
        edge(0, NODE_IDS.start, NODE_IDS.action),
        edge(1, NODE_IDS.action, NODE_IDS.branch),
        edge(2, NODE_IDS.branch, NODE_IDS.task, caseId),
        edge(3, NODE_IDS.branch, NODE_IDS.end, defaultId),
        edge(4, NODE_IDS.task, NODE_IDS.end),
      ],
    })
  }

  const bodyNodes = [
    { id: NODE_IDS.loopStart, type: 'loop_start', name: 'Loop Start', config: {} },
    taskNode(NODE_IDS.loopTask),
    agentActionNode(NODE_IDS.loopAction),
    { id: NODE_IDS.loopEnd, type: 'loop_end', name: 'Loop End', config: {} },
  ]
  return workflowGraphSchema.parse({
    schemaVersion: '1.0.0',
    nodes: [
      startNode(),
      {
        id: NODE_IDS.loop,
        type: 'loop',
        name: 'Gather evidence',
        config: {
          maxTurns: 3,
          exitCondition: {
            kind: 'variable_comparison',
            variableId: FIXTURE_IDS.variable,
            operator: 'gte',
            value: 3,
          },
          body: {
            graph: {
              nodes: bodyNodes,
              edges: [
                edge(5, NODE_IDS.loopStart, NODE_IDS.loopTask),
                edge(6, NODE_IDS.loopTask, NODE_IDS.loopAction),
                edge(7, NODE_IDS.loopAction, NODE_IDS.loopEnd),
              ],
            },
            layout: {
              nodePlacements: bodyNodes.map((node, index) => ({ nodeId: node.id, x: index * 180, y: 120 })),
              viewport: { x: 0, y: 0, zoom: 1 },
            },
          },
        },
      },
      endNode(),
    ],
    edges: [edge(0, NODE_IDS.start, NODE_IDS.loop), edge(1, NODE_IDS.loop, NODE_IDS.end)],
  })
}

export function createCanvasLayoutFixture(graph: WorkflowGraph): CanvasLayout {
  return canvasLayoutSchema.parse({
    schemaVersion: '1.0.0',
    nodePlacements: graph.nodes.map((node, index) => ({ nodeId: node.id, x: 80 + index * 220, y: 220 })),
    viewport: { x: 0, y: 0, zoom: 1 },
  })
}

const AGENT_FIXTURES = {
  minimal: { id: FIXTURE_IDS.plannerAgent, name: 'Planner Agent' },
  research: { id: FIXTURE_IDS.researchAgent, name: 'Research Agent' },
  loop: { id: FIXTURE_IDS.reviewerAgent, name: 'Reviewer Agent' },
} as const

export function createAgentWorkflowEditorDocumentFixture(
  variant: WorkflowFixtureVariant = 'research',
): AgentWorkflowEditorDocument {
  const graph = createWorkflowGraphFixture(variant)
  const agent = AGENT_FIXTURES[variant]
  return agentWorkflowEditorDocumentSchema.parse({
    agent: {
      id: agent.id,
      journeyId: FIXTURE_IDS.journey,
      name: agent.name,
      description: `${variant} proof workflow`,
      revision: 1,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    workflow: graph,
    layout: createCanvasLayoutFixture(graph),
    variables: [
      {
        id: FIXTURE_IDS.variable,
        key: 'source_count',
        displayName: 'Source count',
        description: null,
        dataType: 'number',
        ownership: 'agent_managed',
        defaultValue: 0,
        readOnly: false,
      },
    ],
    reusableTools: [
      {
        id: FIXTURE_IDS.reusableTool,
        name: 'Search Product Documents',
        kind: 'knowledge_retrieval',
        sourceTemplateId: null,
        configuration: { knowledgeSpaceId: FIXTURE_IDS.knowledgeSpace, topK: 5 },
        inputBindings: [],
        outputBinding: null,
      },
    ],
  })
}

export function createJourneyEditorDocumentFixture(): JourneyEditorDocument {
  const agentDocuments = (['research', 'minimal', 'loop'] as const).map((variant) =>
    createAgentWorkflowEditorDocumentFixture(variant),
  )
  return journeyEditorDocumentSchema.parse({
    journey: {
      id: FIXTURE_IDS.journey,
      workspaceId: FIXTURE_IDS.workspace,
      name: 'Research System',
      description: 'Deterministic M2 interaction proof fixture.',
      status: 'draft',
      tags: ['research'],
      revision: 1,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    },
    pattern: createPatternConfigFixture({
      kind: 'linear_sequence',
      agentIds: agentDocuments.map((document) => document.agent.id),
    }),
    agents: agentDocuments.map((document) => ({
      id: document.agent.id,
      name: document.agent.name,
      description: document.agent.description,
      revision: document.agent.revision,
      updatedAt: document.agent.updatedAt,
    })),
    inputGuardrail: { state: 'inactive' },
    outputGuardrail: { state: 'inactive' },
  })
}

export function createAgentWorkflowFixture(
  variant: WorkflowFixtureVariant = 'research',
): AgentWorkflowEditorDocument {
  return createAgentWorkflowEditorDocumentFixture(variant)
}
