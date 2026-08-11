import { z } from 'zod'

import { jsonValueSchema, uuidSchema } from '../common'

export const variableDataTypeSchema = z.enum(['string', 'number', 'boolean', 'json'])
export const variableOwnershipSchema = z.enum(['user_managed', 'shared', 'agent_managed'])

export const agentVariableSchema = z.strictObject({
  id: uuidSchema,
  key: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().nullable(),
  dataType: variableDataTypeSchema,
  ownership: variableOwnershipSchema,
  defaultValue: jsonValueSchema,
  readOnly: z.boolean(),
})

export const taskLocalVariableSchema = z.strictObject({
  id: uuidSchema,
  key: z.string().min(1),
  dataType: variableDataTypeSchema,
  defaultValue: jsonValueSchema,
})

export type VariableDataType = z.infer<typeof variableDataTypeSchema>
export type VariableOwnership = z.infer<typeof variableOwnershipSchema>
export type AgentVariable = z.infer<typeof agentVariableSchema>
export type TaskLocalVariable = z.infer<typeof taskLocalVariableSchema>
