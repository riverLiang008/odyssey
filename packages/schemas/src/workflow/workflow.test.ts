import { describe, expect, it } from 'vitest'

import {
  TOOL_KINDS,
  agentReusableToolSchema,
  agentVariableSchema,
  canvasLayoutSchema,
  toolStepSchema,
  valueSourceSchema,
  workflowGraphSchema,
} from './index'

const IDS = {
  start: '0195f076-b6e6-7ef0-98db-d721990f8830',
  action: '0195f076-b6e6-7ef0-98db-d721990f8831',
  end: '0195f076-b6e6-7ef0-98db-d721990f8832',
  task: '0195f076-b6e6-7ef0-98db-d721990f8865',
  variable: '0195f076-b6e6-7ef0-98db-d721990f8860',
  localVariable: '0195f076-b6e6-7ef0-98db-d721990f8866',
  outputVariable: '0195f076-b6e6-7ef0-98db-d721990f8867',
  knowledgeSpace: '0195f076-b6e6-7ef0-98db-d721990f8890',
  reusableTool: '0195f076-b6e6-7ef0-98db-d721990f8870',
  edgeOne: '0195f076-b6e6-7ef0-98db-d721990f8840',
  edgeTwo: '0195f076-b6e6-7ef0-98db-d721990f8841',
} as const

const templateValue = {
  kind: 'template',
  segments: [
    { kind: 'text', text: 'Find evidence for ' },
    { kind: 'variable', variableId: IDS.variable },
  ],
} as const

function failureBehavior() {
  return { kind: 'fail_task' as const }
}

function createToolSteps() {
  return [
    {
      id: '0195f076-b6e6-7ef0-98db-d721990f8871',
      kind: 'knowledge_retrieval',
      label: 'Retrieve evidence',
      configuration: { knowledgeSpaceId: IDS.knowledgeSpace, query: templateValue, topK: 5 },
      outputMapping: { sourceKey: 'retrieved_documents', targetVariableId: IDS.localVariable },
      failureBehavior: { kind: 'retry', maxAttempts: 2 },
    },
    {
      id: '0195f076-b6e6-7ef0-98db-d721990f8872',
      kind: 'script_execution',
      label: 'Filter results',
      configuration: {
        language: 'python',
        inputs: [{ alias: 'documents', variableId: IDS.localVariable }],
        script: 'result = documents',
      },
      outputMapping: { sourceKey: 'result', targetVariableId: IDS.outputVariable },
      failureBehavior: failureBehavior(),
    },
    {
      id: '0195f076-b6e6-7ef0-98db-d721990f8873',
      kind: 'api_request',
      label: null,
      configuration: { method: 'GET', url: templateValue, headers: [], body: { kind: 'none' } },
      outputMapping: { sourceKey: 'response.data', targetVariableId: IDS.outputVariable },
      failureBehavior: failureBehavior(),
    },
    {
      id: '0195f076-b6e6-7ef0-98db-d721990f8874',
      kind: 'set_variable',
      label: 'Set status',
      configuration: { targetVariableId: IDS.outputVariable, operation: 'assign', value: templateValue },
      outputMapping: null,
      failureBehavior: failureBehavior(),
    },
    {
      id: '0195f076-b6e6-7ef0-98db-d721990f8875',
      kind: 'llm_call',
      label: 'Summarize',
      configuration: { model: 'gpt-4o', prompt: templateValue },
      outputMapping: { sourceKey: 'response.text', targetVariableId: IDS.outputVariable },
      failureBehavior: failureBehavior(),
    },
  ]
}

function createWorkflow() {
  return {
    schemaVersion: '1.0.0',
    nodes: [
      { id: IDS.start, type: 'start', name: 'Start', config: {} },
      {
        id: IDS.action,
        type: 'agent_action',
        name: 'Research and synthesize',
        config: {
          model: 'gpt-4o',
          goal: templateValue,
          knowledgeSpaceIds: [IDS.knowledgeSpace],
          reusableToolIds: [IDS.reusableTool],
        },
      },
      { id: IDS.end, type: 'end', name: 'End', config: {} },
    ],
    edges: [
      { id: IDS.edgeOne, sourceNodeId: IDS.start, targetNodeId: IDS.action },
      { id: IDS.edgeTwo, sourceNodeId: IDS.action, targetNodeId: IDS.end },
    ],
  }
}

describe('value and variable schemas', () => {
  it('parses literal, variable, and template value sources', () => {
    expect(valueSourceSchema.safeParse({ kind: 'literal', value: { count: 3 } }).success).toBe(true)
    expect(valueSourceSchema.safeParse({ kind: 'variable', variableId: IDS.variable }).success).toBe(true)
    expect(valueSourceSchema.safeParse(templateValue).success).toBe(true)
  })

  it('rejects name-based variable references and non-JSON literals', () => {
    expect(valueSourceSchema.safeParse({ kind: 'variable', variableName: 'source_count' }).success).toBe(false)
    expect(valueSourceSchema.safeParse({ kind: 'literal', value: Number.NaN }).success).toBe(false)
  })

  it('accepts the canonical Agent Variable closed sets', () => {
    expect(
      agentVariableSchema.safeParse({
        id: IDS.variable,
        key: 'source_count',
        displayName: 'Source count',
        description: 'Number of accepted sources.',
        dataType: 'number',
        ownership: 'agent_managed',
        defaultValue: 0,
        readOnly: false,
      }).success,
    ).toBe(true)
  })
})

describe('Tool schemas', () => {
  it('parses all five built-in Tool Step configurations', () => {
    const steps = createToolSteps()
    expect(steps.map((step) => step.kind)).toEqual(TOOL_KINDS)
    for (const step of steps) expect(toolStepSchema.safeParse(step).success).toBe(true)
  })

  it('rejects unknown kinds, mismatched output keys, and invalid retry counts', () => {
    const [knowledgeStep] = createToolSteps()
    expect(toolStepSchema.safeParse({ ...knowledgeStep, kind: 'unknown_tool' }).success).toBe(false)
    expect(toolStepSchema.safeParse({ ...knowledgeStep, outputMapping: { sourceKey: 'result', targetVariableId: IDS.localVariable } }).success).toBe(false)
    expect(toolStepSchema.safeParse({ ...knowledgeStep, failureBehavior: { kind: 'retry', maxAttempts: 3 } }).success).toBe(false)
  })

  it('rejects duplicate script aliases and API header names', () => {
    const [, scriptStep, apiStep] = createToolSteps()
    const scriptConfiguration = { ...scriptStep.configuration, inputs: [{ alias: 'value', variableId: IDS.variable }, { alias: 'value', variableId: IDS.localVariable }] }
    expect(toolStepSchema.safeParse({ ...scriptStep, configuration: scriptConfiguration }).success).toBe(false)

    const header = { id: IDS.edgeOne, name: 'Authorization', value: templateValue }
    const apiConfiguration = { ...apiStep.configuration, headers: [header, { ...header, id: IDS.edgeTwo, name: 'authorization' }] }
    expect(toolStepSchema.safeParse({ ...apiStep, configuration: apiConfiguration }).success).toBe(false)
  })

  it('requires Set Variable toggle to omit value', () => {
    const toggle = { ...createToolSteps()[3], configuration: { targetVariableId: IDS.variable, operation: 'toggle', value: { kind: 'literal', value: true } } }
    expect(toolStepSchema.safeParse(toggle).success).toBe(false)
  })

  it('parses a canonical reusable Knowledge Retrieval snapshot without a Task query', () => {
    expect(
      agentReusableToolSchema.safeParse({
        id: IDS.reusableTool,
        name: 'Search Product Documents',
        kind: 'knowledge_retrieval',
        sourceTemplateId: null,
        configuration: { knowledgeSpaceId: IDS.knowledgeSpace, topK: 5 },
        inputBindings: [],
        outputBinding: null,
      }).success,
    ).toBe(true)
  })
})

describe('Workflow and Layout schemas', () => {
  it('parses the canonical Start → Agent Action → End graph', () => {
    expect(workflowGraphSchema.parse(createWorkflow())).toEqual(createWorkflow())
  })

  it('parses a Task with an ordered sequence of all Tool kinds', () => {
    const workflow = createWorkflow()
    const taskNode = {
      id: IDS.task,
      type: 'task',
      name: 'Publish research brief',
      config: { localVariables: [{ id: IDS.localVariable, key: 'context', dataType: 'json', defaultValue: null }], steps: createToolSteps() },
    }
    expect(
      workflowGraphSchema.safeParse({
        ...workflow,
        nodes: [...workflow.nodes.slice(0, 2), taskNode, ...workflow.nodes.slice(2)],
      }).success,
    ).toBe(true)
  })

  it('rejects Loop boundary nodes at the top level and nested Loops in a Loop body', () => {
    const workflow = createWorkflow()
    const boundaryCandidate = {
      ...workflow,
      nodes: [
        workflow.nodes[0],
        { id: IDS.action, type: 'loop_start', name: 'Loop Start', config: {} },
        workflow.nodes[2],
      ],
    }
    expect(workflowGraphSchema.safeParse(boundaryCandidate).success).toBe(false)

    const loop = {
      id: IDS.action,
      type: 'loop',
      name: 'Outer loop',
      config: {
        maxTurns: 3,
        exitCondition: { kind: 'variable_comparison', variableId: IDS.variable, operator: 'gte', value: 3 },
        body: { graph: { nodes: [{ id: IDS.task, type: 'loop', name: 'Nested', config: {} }], edges: [] }, layout: { nodePlacements: [], viewport: { x: 0, y: 0, zoom: 1 } } },
      },
    }
    expect(
      workflowGraphSchema.safeParse({
        ...workflow,
        nodes: [workflow.nodes[0], loop, workflow.nodes[2]],
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate IDs and missing edge endpoints', () => {
    const workflow = createWorkflow()
    const duplicate = {
      ...workflow,
      nodes: [workflow.nodes[0], { ...workflow.nodes[1], id: IDS.start }, workflow.nodes[2]],
    }
    expect(workflowGraphSchema.safeParse(duplicate).success).toBe(false)

    const missingEndpoint = {
      ...workflow,
      edges: [{ ...workflow.edges[0], targetNodeId: IDS.task }, workflow.edges[1]],
    }
    expect(workflowGraphSchema.safeParse(missingEndpoint).success).toBe(false)
  })

  it('uses canonical sourceHandleId and rejects Vue Flow handle fields', () => {
    const workflow = createWorkflow()
    const edge = { ...workflow.edges[0], sourceHandle: IDS.variable }
    workflow.edges[0] = edge
    expect(workflowGraphSchema.safeParse(workflow).success).toBe(false)
  })

  it('normalizes nullable HTTP source handles to the canonical omitted form', () => {
    const workflow = createWorkflow()
    const candidate = structuredClone(workflow) as unknown as { edges: Array<Record<string, unknown>> }
    candidate.edges[0]!.sourceHandleId = null
    const parsed = workflowGraphSchema.parse(candidate)
    expect(parsed.edges[0]?.sourceHandleId).toBeUndefined()
  })

  it('requires sourceHandleId to belong to its source Branch', () => {
    const caseId = '0195f076-b6e6-7ef0-98db-d721990f88b1'
    const defaultId = '0195f076-b6e6-7ef0-98db-d721990f88b5'
    const branchId = '0195f076-b6e6-7ef0-98db-d721990f88b0'
    const branchGraph = {
      schemaVersion: '1.0.0',
      nodes: [
        { id: IDS.start, type: 'start', name: 'Start', config: {} },
        {
          id: branchId,
          type: 'branch',
          name: 'Enough sources?',
          config: {
            cases: [{ id: caseId, label: 'Enough', match: 'all', conditions: [{ id: IDS.variable, left: { kind: 'literal', value: 3 }, operator: 'gte', right: { kind: 'literal', value: 2 } }] }],
            defaultCase: { id: defaultId, label: 'Default' },
          },
        },
        { id: IDS.end, type: 'end', name: 'End', config: {} },
      ],
      edges: [{ id: IDS.edgeOne, sourceNodeId: branchId, sourceHandleId: caseId, targetNodeId: IDS.end }],
    }
    expect(workflowGraphSchema.safeParse(branchGraph).success).toBe(true)
    expect(workflowGraphSchema.safeParse({ ...branchGraph, edges: [{ ...branchGraph.edges[0], sourceHandleId: IDS.task }] }).success).toBe(false)
    expect(workflowGraphSchema.safeParse({ ...branchGraph, edges: [{ ...branchGraph.edges[0], sourceNodeId: IDS.start }] }).success).toBe(false)
  })

  it('rejects non-finite placements, duplicate placements, and legacy nodePositions', () => {
    const layout = {
      schemaVersion: '1.0.0',
      nodePlacements: [{ nodeId: IDS.start, x: 80, y: 220 }],
      viewport: { x: 0, y: 0, zoom: 1 },
    }
    expect(canvasLayoutSchema.safeParse(layout).success).toBe(true)
    expect(canvasLayoutSchema.safeParse({ ...layout, nodePlacements: [{ nodeId: IDS.start, x: Number.NaN, y: 0 }] }).success).toBe(false)
    expect(canvasLayoutSchema.safeParse({ ...layout, nodePlacements: [...layout.nodePlacements, layout.nodePlacements[0]] }).success).toBe(false)
    expect(canvasLayoutSchema.safeParse({ schemaVersion: '1.0.0', nodePositions: [], viewport: layout.viewport }).success).toBe(false)
  })
})
