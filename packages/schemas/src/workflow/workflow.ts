import { z } from 'zod'

import { jsonValueSchema, schemaVersionSchema, uuidSchema } from '../common'
import { embeddedCanvasLayoutSchema } from './layout'
import { toolStepSchema } from './tools'
import { taskLocalVariableSchema } from './variables'
import { valueSourceSchema } from './values'

const emptyConfigSchema = z.strictObject({})
const nodeBase = {
  id: uuidSchema,
  name: z.string().min(1),
} as const

export const startNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('start'),
  config: emptyConfigSchema,
})
export const endNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('end'),
  config: emptyConfigSchema,
})

const uniqueUuidArraySchema = z.array(uuidSchema).superRefine((ids, context) => {
  const seenIds = new Set<string>()
  ids.forEach((id, index) => {
    if (seenIds.has(id)) {
      context.addIssue({ code: 'custom', message: 'References must be unique', path: [index] })
    }
    seenIds.add(id)
  })
})

export const agentActionNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('agent_action'),
  config: z.strictObject({
    model: z.string().min(1),
    goal: valueSourceSchema,
    knowledgeSpaceIds: uniqueUuidArraySchema,
    reusableToolIds: uniqueUuidArraySchema,
  }),
})

export const taskNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('task'),
  config: z
    .strictObject({
      localVariables: z.array(taskLocalVariableSchema),
      steps: z.array(toolStepSchema),
    })
    .superRefine((configuration, context) => {
      for (const [field, entries] of [
        ['localVariables', configuration.localVariables],
        ['steps', configuration.steps],
      ] as const) {
        const ids = new Set<string>()
        entries.forEach((entry, index) => {
          if (ids.has(entry.id)) {
            context.addIssue({
              code: 'custom',
              message: `${field} IDs must be unique`,
              path: [field, index, 'id'],
            })
          }
          ids.add(entry.id)
        })
      }
    }),
})

const binaryConditionSchema = z.strictObject({
  id: uuidSchema,
  left: valueSourceSchema,
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains']),
  right: valueSourceSchema,
})
const unaryConditionSchema = z.strictObject({
  id: uuidSchema,
  left: valueSourceSchema,
  operator: z.enum(['is_empty', 'is_not_empty']),
})
export const branchConditionSchema = z.union([binaryConditionSchema, unaryConditionSchema])

const branchCaseSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().min(1),
  match: z.literal('all'),
  conditions: z.array(branchConditionSchema).min(1),
})
const branchDefaultCaseSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().min(1),
})

export const branchNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('branch'),
  config: z
    .strictObject({
      cases: z.array(branchCaseSchema),
      defaultCase: branchDefaultCaseSchema,
    })
    .superRefine((configuration, context) => {
      const ids = new Set<string>([configuration.defaultCase.id])
      configuration.cases.forEach((branchCase, caseIndex) => {
        if (ids.has(branchCase.id)) {
          context.addIssue({ code: 'custom', message: 'Branch handle IDs must be unique', path: ['cases', caseIndex, 'id'] })
        }
        ids.add(branchCase.id)
        branchCase.conditions.forEach((condition, conditionIndex) => {
          if (ids.has(condition.id)) {
            context.addIssue({ code: 'custom', message: 'Branch condition IDs must be unique', path: ['cases', caseIndex, 'conditions', conditionIndex, 'id'] })
          }
          ids.add(condition.id)
        })
      })
    }),
})

export const loopStartNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('loop_start'),
  config: emptyConfigSchema,
})
export const loopEndNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('loop_end'),
  config: emptyConfigSchema,
})

export const loopBodyNodeSchema = z.discriminatedUnion('type', [
  loopStartNodeSchema,
  loopEndNodeSchema,
  agentActionNodeSchema,
  taskNodeSchema,
  branchNodeSchema,
])

export const workflowEdgeSchema = z.strictObject({
  id: uuidSchema,
  sourceNodeId: uuidSchema,
  sourceHandleId: uuidSchema.optional(),
  targetNodeId: uuidSchema,
})

function addGraphReferenceIssues(
  graph: {
    nodes: Array<{ id: string; type: string; config: object }>
    edges: Array<z.infer<typeof workflowEdgeSchema>>
  },
  context: z.RefinementCtx,
) {
  const nodeIds = new Set<string>()
  graph.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      context.addIssue({ code: 'custom', message: 'Workflow node IDs must be unique', path: ['nodes', index, 'id'] })
    }
    nodeIds.add(node.id)
  })

  const edgeIds = new Set<string>()
  graph.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) {
      context.addIssue({ code: 'custom', message: 'Workflow edge IDs must be unique', path: ['edges', index, 'id'] })
    }
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.sourceNodeId)) {
      context.addIssue({ code: 'custom', message: 'Edge source must reference an existing node', path: ['edges', index, 'sourceNodeId'] })
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      context.addIssue({ code: 'custom', message: 'Edge target must reference an existing node', path: ['edges', index, 'targetNodeId'] })
    }

    const sourceNode = graph.nodes.find((node) => node.id === edge.sourceNodeId)
    if (edge.sourceHandleId !== undefined) {
      if (sourceNode?.type !== 'branch') {
        context.addIssue({ code: 'custom', message: 'Only a Branch edge may reference a source handle', path: ['edges', index, 'sourceHandleId'] })
      } else {
        const parsedBranch = branchNodeSchema.safeParse(sourceNode)
        if (!parsedBranch.success) return
        const handleIds = new Set([
          parsedBranch.data.config.defaultCase.id,
          ...parsedBranch.data.config.cases.map((branchCase) => branchCase.id),
        ])
        if (!handleIds.has(edge.sourceHandleId)) {
          context.addIssue({ code: 'custom', message: 'Branch edge source handle must belong to its source Branch', path: ['edges', index, 'sourceHandleId'] })
        }
      }
    }
  })
}

export const loopBodyGraphSchema = z
  .strictObject({ nodes: z.array(loopBodyNodeSchema), edges: z.array(workflowEdgeSchema) })
  .superRefine(addGraphReferenceIssues)

const loopExitConditionSchema = z.strictObject({
  kind: z.literal('variable_comparison'),
  variableId: uuidSchema,
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
  value: jsonValueSchema,
})

export const loopNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal('loop'),
  config: z.strictObject({
    maxTurns: z.number().int().positive(),
    exitCondition: loopExitConditionSchema,
    body: z
      .strictObject({ graph: loopBodyGraphSchema, layout: embeddedCanvasLayoutSchema })
      .superRefine((body, context) => {
        const nodeIds = new Set(body.graph.nodes.map((node) => node.id))
        body.layout.nodePlacements.forEach((placement, index) => {
          if (!nodeIds.has(placement.nodeId)) {
            context.addIssue({ code: 'custom', message: 'Loop placement must reference a body node', path: ['layout', 'nodePlacements', index, 'nodeId'] })
          }
        })
      }),
  }),
})

export const workflowNodeSchema = z.discriminatedUnion('type', [
  startNodeSchema,
  endNodeSchema,
  agentActionNodeSchema,
  taskNodeSchema,
  branchNodeSchema,
  loopNodeSchema,
])

export const workflowGraphSchema = z
  .strictObject({
    schemaVersion: schemaVersionSchema,
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
  })
  .superRefine(addGraphReferenceIssues)

export type StartNode = z.infer<typeof startNodeSchema>
export type EndNode = z.infer<typeof endNodeSchema>
export type AgentActionNode = z.infer<typeof agentActionNodeSchema>
export type TaskNode = z.infer<typeof taskNodeSchema>
export type BranchNode = z.infer<typeof branchNodeSchema>
export type LoopStartNode = z.infer<typeof loopStartNodeSchema>
export type LoopEndNode = z.infer<typeof loopEndNodeSchema>
export type LoopNode = z.infer<typeof loopNodeSchema>
export type WorkflowNode = z.infer<typeof workflowNodeSchema>
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>
export type WorkflowGraph = z.infer<typeof workflowGraphSchema>
