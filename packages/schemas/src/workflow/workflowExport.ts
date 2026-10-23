import { z } from 'zod'

import { utcTimestampSchema, uuidSchema } from '../common'
import { canvasLayoutSchema } from './layout'
import { agentReusableToolSchema } from './tools'
import { agentVariableSchema } from './variables'
import { workflowGraphSchema } from './workflow'

export const agentWorkflowExportDocumentSchema = z.strictObject({
  workflow: workflowGraphSchema,
  layout: canvasLayoutSchema,
  variables: z.array(agentVariableSchema),
  reusableTools: z.array(agentReusableToolSchema),
})

export const agentWorkflowExportSchema = z.strictObject({
  kind: z.literal('odyssey.agent-workflow'),
  formatVersion: z.literal(1),
  exportedAt: utcTimestampSchema,
  source: z.strictObject({
    journeyId: uuidSchema,
    agentId: uuidSchema,
    agentName: z.string().trim().min(1),
  }),
  document: agentWorkflowExportDocumentSchema,
})

export type AgentWorkflowExportDocument = z.infer<typeof agentWorkflowExportDocumentSchema>
export type AgentWorkflowExport = z.infer<typeof agentWorkflowExportSchema>
