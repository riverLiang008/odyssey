import { z } from 'zod'

import { revisionSchema, utcTimestampSchema, uuidSchema } from '../common'
import { patternConfigSchema } from '../pattern'
import {
  agentReusableToolSchema,
  agentVariableSchema,
  canvasLayoutSchema,
  workflowGraphSchema,
  type ToolStep,
  type AgentReusableTool,
  type AgentVariable,
  type CanvasLayout,
  type ValueSource,
  type LoopEndNode,
  type LoopStartNode,
  type WorkflowNode,
  type WorkflowGraph,
} from '../workflow'

export const journeyStatusSchema = z.enum(['draft', 'archived'])

export const journeyEditorMetadataSchema = z.strictObject({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  status: journeyStatusSchema,
  tags: z.array(z.string()),
  revision: revisionSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
})

export const agentSummarySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  revision: revisionSchema,
  updatedAt: utcTimestampSchema,
})

export const guardrailSideSchema = z.enum(['input', 'output'])
export const guardrailProjectionSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('inactive') }),
  z.strictObject({
    state: z.literal('active'),
    structure: z.literal('single'),
    agentId: uuidSchema,
  }),
])

export const journeyEditorDocumentSchema = z
  .strictObject({
    journey: journeyEditorMetadataSchema,
    pattern: patternConfigSchema,
    agents: z.array(agentSummarySchema),
    inputGuardrail: guardrailProjectionSchema,
    outputGuardrail: guardrailProjectionSchema,
  })
  .superRefine((document, context) => {
    const agentIds = new Set<string>()
    document.agents.forEach((agent, index) => {
      if (agentIds.has(agent.id)) {
        context.addIssue({ code: 'custom', message: 'Agent summary IDs must be unique', path: ['agents', index, 'id'] })
      }
      agentIds.add(agent.id)
    })

    const occupiedAgentIds = new Set<string>()
    document.pattern.slots.forEach((slot, index) => {
      if (slot.agentId === null) return
      if (occupiedAgentIds.has(slot.agentId)) {
        context.addIssue({ code: 'custom', message: 'An Agent may occupy only one Pattern slot', path: ['pattern', 'slots', index, 'agentId'] })
      }
      occupiedAgentIds.add(slot.agentId)
      if (!agentIds.has(slot.agentId)) {
        context.addIssue({ code: 'custom', message: 'Occupied Pattern slots must reference an Agent summary', path: ['pattern', 'slots', index, 'agentId'] })
      }
    })

    const activeGuardrails = [
      ['inputGuardrail', document.inputGuardrail],
      ['outputGuardrail', document.outputGuardrail],
    ] as const
    const guardrailAgentIds = activeGuardrails.flatMap(([, guardrail]) =>
      guardrail.state === 'active' ? [guardrail.agentId] : [],
    )
    activeGuardrails.forEach(([field, guardrail]) => {
      if (guardrail.state !== 'active') return
      const agentId = guardrail.agentId
      if (!agentIds.has(agentId)) {
        context.addIssue({ code: 'custom', message: 'Active Guardrails must reference an Agent summary', path: [field, 'agentId'] })
      }
      if (occupiedAgentIds.has(agentId)) {
        context.addIssue({ code: 'custom', message: 'A Guardrail Agent cannot occupy a Pattern Slot', path: [field, 'agentId'] })
      }
    })
    if (guardrailAgentIds.length !== new Set(guardrailAgentIds).size) {
      context.addIssue({ code: 'custom', message: 'Input and Output Guardrails require distinct Agents', path: ['outputGuardrail', 'agentId'] })
    }
  })

export const agentEditorMetadataSchema = z.strictObject({
  id: uuidSchema,
  journeyId: uuidSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  revision: revisionSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
})

export interface AgentWorkflowEditorSchemaOptions {
  systemVariableIds?: readonly string[]
}

function variableIdsInValue(value: ValueSource): string[] {
  if (value.kind === 'variable') return [value.variableId]
  if (value.kind === 'template') {
    return value.segments.flatMap((segment) =>
      segment.kind === 'variable' ? [segment.variableId] : [],
    )
  }
  return []
}

function toolVariableReferences(step: ToolStep): Array<{ id: string; target: boolean }> {
  const output = step.outputMapping
    ? [{ id: step.outputMapping.targetVariableId, target: true }]
    : []
  switch (step.kind) {
    case 'knowledge_retrieval':
      return [...variableIdsInValue(step.configuration.query).map((id) => ({ id, target: false })), ...output]
    case 'script_execution':
      return [...(step.configuration.inputs ?? []).map((input) => ({ id: input.variableId, target: false })), ...output]
    case 'api_request': {
      const values = [step.configuration.url, ...step.configuration.headers.map((header) => header.value)]
      if (step.configuration.body.kind === 'json') values.push(step.configuration.body.value)
      if (step.configuration.body.kind === 'form_data') values.push(...step.configuration.body.entries.map((entry) => entry.value))
      return [...values.flatMap(variableIdsInValue).map((id) => ({ id, target: false })), ...output]
    }
    case 'set_variable':
      return [
        { id: step.configuration.targetVariableId, target: true },
        ...(step.configuration.operation === 'toggle'
          ? []
          : variableIdsInValue(step.configuration.value).map((id) => ({ id, target: false }))),
      ]
    case 'llm_call':
      return [
        ...variableIdsInValue(step.configuration.prompt).map((id) => ({ id, target: false })),
        ...(step.configuration.systemPrompt
          ? variableIdsInValue(step.configuration.systemPrompt).map((id) => ({ id, target: false }))
          : []),
        ...output,
      ]
  }
}

function reusableToolVariableReferences(tool: AgentReusableTool): Array<{ id: string; target: boolean }> {
  const references = [
    ...tool.inputBindings.flatMap(variableIdsInValue).map((id) => ({ id, target: false })),
    ...(tool.outputBinding ? [{ id: tool.outputBinding.targetVariableId, target: true }] : []),
  ]
  switch (tool.kind) {
    case 'knowledge_retrieval':
      return [...references, ...(tool.configuration.query ? variableIdsInValue(tool.configuration.query).map((id) => ({ id, target: false })) : [])]
    case 'script_execution':
      return [...references, ...(tool.configuration.inputs ?? []).map((input) => ({ id: input.variableId, target: false }))]
    case 'api_request': {
      const values = [tool.configuration.url, ...tool.configuration.headers.map((header) => header.value)]
      if (tool.configuration.body.kind === 'json') values.push(tool.configuration.body.value)
      if (tool.configuration.body.kind === 'form_data') values.push(...tool.configuration.body.entries.map((entry) => entry.value))
      return [...references, ...values.flatMap(variableIdsInValue).map((id) => ({ id, target: false }))]
    }
    case 'set_variable':
      return [...references, { id: tool.configuration.targetVariableId, target: true }, ...(tool.configuration.operation === 'toggle' ? [] : variableIdsInValue(tool.configuration.value).map((id) => ({ id, target: false })))]
    case 'llm_call':
      return [...references, ...variableIdsInValue(tool.configuration.prompt).map((id) => ({ id, target: false })), ...(tool.configuration.systemPrompt ? variableIdsInValue(tool.configuration.systemPrompt).map((id) => ({ id, target: false })) : [])]
  }
}

export function createAgentWorkflowEditorDocumentSchema(
  options: AgentWorkflowEditorSchemaOptions = {},
) {
  const systemVariableIds = new Set(options.systemVariableIds ?? [])
  return z
  .strictObject({
    agent: agentEditorMetadataSchema,
    workflow: workflowGraphSchema,
    layout: canvasLayoutSchema,
    variables: z.array(agentVariableSchema),
    reusableTools: z.array(agentReusableToolSchema),
  })
  .superRefine((document, context) => {
    const nodeIds = new Set(document.workflow.nodes.map((node) => node.id))
    document.layout.nodePlacements.forEach((placement, index) => {
      if (!nodeIds.has(placement.nodeId)) {
        context.addIssue({ code: 'custom', message: 'Node placement must reference a Workflow node', path: ['layout', 'nodePlacements', index, 'nodeId'] })
      }
    })

    for (const [field, entries] of [
      ['variables', document.variables],
      ['reusableTools', document.reusableTools],
    ] as const) {
      const ids = new Set<string>()
      entries.forEach((entry, index) => {
        if (ids.has(entry.id)) {
          context.addIssue({ code: 'custom', message: `${field} IDs must be unique`, path: [field, index, 'id'] })
        }
        ids.add(entry.id)
      })
    }

    const reusableToolIds = new Set(document.reusableTools.map((tool) => tool.id))
    const agentVariableIds = new Set<string>(document.variables.map((variable) => variable.id))
    const writableAgentVariableIds = new Set<string>(
      document.variables.filter((variable) => !variable.readOnly).map((variable) => variable.id),
    )
    const ownedVariableIds = new Set<string>(agentVariableIds)

    function validateNodes(
      nodes: Array<WorkflowNode | LoopStartNode | LoopEndNode>,
      path: Array<string | number>,
    ) {
      nodes.forEach((node, nodeIndex) => {
        const nodePath = [...path, nodeIndex]
        if (node.type === 'agent_action') {
          node.config.reusableToolIds.forEach((toolId, toolIndex) => {
            if (!reusableToolIds.has(toolId)) {
              context.addIssue({ code: 'custom', message: 'Agent Action must reference a reusable Tool owned by the Agent', path: [...nodePath, 'config', 'reusableToolIds', toolIndex] })
            }
          })
          for (const variableId of variableIdsInValue(node.config.goal)) {
            if (!agentVariableIds.has(variableId) && !systemVariableIds.has(variableId)) {
              context.addIssue({ code: 'custom', message: 'Agent Action goal contains an unresolved Variable reference', path: [...nodePath, 'config', 'goal'] })
            }
          }
        } else if (node.type === 'task') {
          const localVariableIds = new Set<string>(node.config.localVariables.map((variable) => variable.id))
          node.config.localVariables.forEach((variable, variableIndex) => {
            if (ownedVariableIds.has(variable.id)) {
              context.addIssue({ code: 'custom', message: 'Variable IDs must be unique across the Agent aggregate', path: [...nodePath, 'config', 'localVariables', variableIndex, 'id'] })
            }
            ownedVariableIds.add(variable.id)
          })
          const readableIds = new Set([...agentVariableIds, ...systemVariableIds, ...localVariableIds])
          const writableIds = new Set([...writableAgentVariableIds, ...localVariableIds])
          node.config.steps.forEach((step, stepIndex) => {
            toolVariableReferences(step).forEach((reference) => {
              const allowed = reference.target ? writableIds : readableIds
              if (!allowed.has(reference.id)) {
                context.addIssue({ code: 'custom', message: reference.target ? 'Tool target must reference a writable Variable in scope' : 'Tool input contains an unresolved or out-of-scope Variable reference', path: [...nodePath, 'config', 'steps', stepIndex] })
              }
            })
          })
        } else if (node.type === 'branch') {
          node.config.cases.forEach((branchCase, caseIndex) => {
            branchCase.conditions.forEach((condition, conditionIndex) => {
              const values = 'right' in condition ? [condition.left, condition.right] : [condition.left]
              for (const variableId of values.flatMap(variableIdsInValue)) {
                if (!agentVariableIds.has(variableId) && !systemVariableIds.has(variableId)) {
                  context.addIssue({ code: 'custom', message: 'Branch condition contains an unresolved Variable reference', path: [...nodePath, 'config', 'cases', caseIndex, 'conditions', conditionIndex] })
                }
              }
            })
          })
        } else if (node.type === 'loop') {
          if (!agentVariableIds.has(node.config.exitCondition.variableId) && !systemVariableIds.has(node.config.exitCondition.variableId)) {
            context.addIssue({ code: 'custom', message: 'Loop exit condition contains an unresolved Variable reference', path: [...nodePath, 'config', 'exitCondition', 'variableId'] })
          }
          validateNodes(node.config.body.graph.nodes, [...nodePath, 'config', 'body', 'graph', 'nodes'])
        }
      })
    }

    validateNodes(document.workflow.nodes, ['workflow', 'nodes'])

    const reusableReadableIds = new Set([...agentVariableIds, ...systemVariableIds])
    document.reusableTools.forEach((tool, toolIndex) => {
      reusableToolVariableReferences(tool).forEach((reference) => {
        const allowed = reference.target ? writableAgentVariableIds : reusableReadableIds
        if (!allowed.has(reference.id)) {
          context.addIssue({ code: 'custom', message: reference.target ? 'Reusable Tool target must reference a writable Agent Variable' : 'Reusable Tool contains an unresolved Variable reference', path: ['reusableTools', toolIndex] })
        }
      })
    })
  })
}

export const agentWorkflowEditorDocumentSchema = createAgentWorkflowEditorDocumentSchema()

export const agentTemplateSourceSchema = z.enum(['built_in', 'user'])
export const agentTemplateVisibilitySchema = z.enum(['private', 'public'])
export const agentTemplatePublicationStatusSchema = z.enum(['draft', 'published'])

export interface AgentTemplateDependency {
  id: z.infer<typeof uuidSchema>
  kind: 'knowledge_space'
  key: string
  label: string
  required: boolean
}

export interface AgentTemplate {
  schemaVersion: '1.0.0'
  id: z.infer<typeof uuidSchema>
  name: string
  description: string | null
  source: 'built_in' | 'user'
  ownerWorkspaceId: z.infer<typeof uuidSchema> | null
  sourceTemplateId: z.infer<typeof uuidSchema> | null
  visibility: 'private' | 'public'
  publicationStatus: 'draft' | 'published'
  dependencies: AgentTemplateDependency[]
  snapshot: {
    workflow: WorkflowGraph
    layout: CanvasLayout
    variables: AgentVariable[]
    reusableTools: AgentReusableTool[]
  }
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export function createAgentTemplateSchema(options: AgentWorkflowEditorSchemaOptions = {}): z.ZodType<AgentTemplate> {
  const documentSchema = createAgentWorkflowEditorDocumentSchema(options)
  return z.strictObject({
    schemaVersion: z.literal('1.0.0'),
    id: uuidSchema,
    name: z.string().min(1),
    description: z.string().nullable(),
    source: agentTemplateSourceSchema,
    ownerWorkspaceId: uuidSchema.nullable(),
    sourceTemplateId: uuidSchema.nullable(),
    visibility: agentTemplateVisibilitySchema,
    publicationStatus: agentTemplatePublicationStatusSchema,
    dependencies: z.array(z.strictObject({
      id: uuidSchema,
      kind: z.literal('knowledge_space'),
      key: z.string().regex(/^[a-z][a-z0-9_]*$/),
      label: z.string().min(1),
      required: z.boolean(),
    })),
    snapshot: z.strictObject({
      workflow: workflowGraphSchema,
      layout: canvasLayoutSchema,
      variables: z.array(agentVariableSchema),
      reusableTools: z.array(agentReusableToolSchema),
    }),
    publishedAt: utcTimestampSchema.nullable(),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  }).superRefine((template, context) => {
    if (template.source === 'built_in' && template.ownerWorkspaceId !== null) {
      context.addIssue({ code: 'custom', message: 'Built-in Agent Templates cannot have an owner Workspace', path: ['ownerWorkspaceId'] })
    }
    if (template.source === 'built_in' && (template.visibility !== 'public' || template.publicationStatus !== 'published' || template.publishedAt === null)) {
      context.addIssue({ code: 'custom', message: 'Built-in Agent Templates must be public and published', path: ['source'] })
    }
    if (template.source === 'user' && template.ownerWorkspaceId === null) {
      context.addIssue({ code: 'custom', message: 'User Agent Templates require an owner Workspace', path: ['ownerWorkspaceId'] })
    }
    if (template.publicationStatus === 'published' && template.publishedAt === null) {
      context.addIssue({ code: 'custom', message: 'Published Agent Templates require publishedAt', path: ['publishedAt'] })
    }
    if (template.publicationStatus === 'draft' && template.publishedAt !== null) {
      context.addIssue({ code: 'custom', message: 'Draft Agent Templates cannot have publishedAt', path: ['publishedAt'] })
    }
    if (template.visibility === 'public' && template.publicationStatus !== 'published') {
      context.addIssue({ code: 'custom', message: 'Public Agent Templates must be published', path: ['publicationStatus'] })
    }
    const dependencyIds = new Set<string>()
    const dependencyKeys = new Set<string>()
    template.dependencies.forEach((dependency, index) => {
      if (dependencyIds.has(dependency.id)) context.addIssue({ code: 'custom', message: 'Dependency IDs must be unique', path: ['dependencies', index, 'id'] })
      if (dependencyKeys.has(dependency.key)) context.addIssue({ code: 'custom', message: 'Dependency keys must be unique', path: ['dependencies', index, 'key'] })
      dependencyIds.add(dependency.id)
      dependencyKeys.add(dependency.key)
    })
    if (template.visibility === 'public') {
      const referencedKnowledgeSpaces = new Set<string>()
      template.snapshot.reusableTools.forEach((tool) => {
        if (tool.kind === 'knowledge_retrieval') referencedKnowledgeSpaces.add(tool.configuration.knowledgeSpaceId)
      })
      const collectKnowledgeSpaces = (nodes: Array<WorkflowNode | LoopStartNode | LoopEndNode>): void => {
        nodes.forEach((node) => {
          if (node.type === 'agent_action') node.config.knowledgeSpaceIds.forEach((id) => referencedKnowledgeSpaces.add(id))
          if (node.type === 'task') node.config.steps.forEach((step) => {
            if (step.kind === 'knowledge_retrieval') referencedKnowledgeSpaces.add(step.configuration.knowledgeSpaceId)
          })
          if (node.type === 'loop') collectKnowledgeSpaces(node.config.body.graph.nodes)
        })
      }
      collectKnowledgeSpaces(template.snapshot.workflow.nodes)
      referencedKnowledgeSpaces.forEach((id) => {
        if (!dependencyIds.has(id)) context.addIssue({ code: 'custom', message: 'Public Agent Templates must reference Knowledge Spaces through dependency slots', path: ['snapshot'] })
      })
    }
    const sentinelAgentId = '00000000-0000-4000-8000-000000000001'
    const sentinelJourneyId = '00000000-0000-4000-8000-000000000002'
    const snapshotDocument = documentSchema.safeParse({
      agent: {
        id: sentinelAgentId,
        journeyId: sentinelJourneyId,
        name: template.name,
        description: template.description,
        revision: 1,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
      ...template.snapshot,
    })
    if (!snapshotDocument.success) {
      context.addIssue({ code: 'custom', message: 'Agent Template snapshot must be a valid Agent aggregate', path: ['snapshot'] })
    }
  })
}

export const agentTemplateSchema = createAgentTemplateSchema()

export type JourneyStatus = z.infer<typeof journeyStatusSchema>
export type JourneyEditorMetadata = z.infer<typeof journeyEditorMetadataSchema>
export type AgentSummary = z.infer<typeof agentSummarySchema>
export type GuardrailSide = z.infer<typeof guardrailSideSchema>
export type GuardrailProjection = z.infer<typeof guardrailProjectionSchema>
export type JourneyEditorDocument = z.infer<typeof journeyEditorDocumentSchema>
export type AgentEditorMetadata = z.infer<typeof agentEditorMetadataSchema>
export type AgentWorkflowEditorDocument = z.infer<typeof agentWorkflowEditorDocumentSchema>
