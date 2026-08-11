import { z } from 'zod'

import { revisionSchema, utcTimestampSchema, uuidSchema } from '../common'
import { patternConfigSchema } from '../pattern'
import {
  agentReusableToolSchema,
  agentVariableSchema,
  canvasLayoutSchema,
  workflowGraphSchema,
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

export const journeyEditorDocumentSchema = z
  .strictObject({
    journey: journeyEditorMetadataSchema,
    pattern: patternConfigSchema,
    agents: z.array(agentSummarySchema),
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

export const agentWorkflowEditorDocumentSchema = z
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
    document.workflow.nodes.forEach((node, nodeIndex) => {
      if (node.type !== 'agent_action') return
      node.config.reusableToolIds.forEach((toolId, toolIndex) => {
        if (!reusableToolIds.has(toolId)) {
          context.addIssue({
            code: 'custom',
            message: 'Agent Action must reference a reusable Tool owned by the Agent',
            path: ['workflow', 'nodes', nodeIndex, 'config', 'reusableToolIds', toolIndex],
          })
        }
      })
    })
  })

export type JourneyStatus = z.infer<typeof journeyStatusSchema>
export type JourneyEditorMetadata = z.infer<typeof journeyEditorMetadataSchema>
export type AgentSummary = z.infer<typeof agentSummarySchema>
export type JourneyEditorDocument = z.infer<typeof journeyEditorDocumentSchema>
export type AgentEditorMetadata = z.infer<typeof agentEditorMetadataSchema>
export type AgentWorkflowEditorDocument = z.infer<typeof agentWorkflowEditorDocumentSchema>
