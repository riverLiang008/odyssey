import { z } from 'zod'

import { uuidSchema } from '../common'
import { valueSourceSchema } from './values'

export const TOOL_KINDS = [
  'knowledge_retrieval',
  'script_execution',
  'api_request',
  'set_variable',
  'llm_call',
] as const

export const toolKindSchema = z.enum(TOOL_KINDS)

export const retryToolFailureBehaviorSchema = z.strictObject({
  kind: z.literal('retry'),
  maxAttempts: z.literal(2),
})
export const failTaskToolFailureBehaviorSchema = z.strictObject({
  kind: z.literal('fail_task'),
})
export const toolFailureBehaviorSchema = z.discriminatedUnion('kind', [
  retryToolFailureBehaviorSchema,
  failTaskToolFailureBehaviorSchema,
])

function outputMappingSchema(sourceKey: string) {
  return z.strictObject({
    sourceKey: z.literal(sourceKey),
    targetVariableId: uuidSchema,
  })
}

export const toolOutputMappingSchema = z.strictObject({
  sourceKey: z.string().min(1),
  targetVariableId: uuidSchema,
})

export const knowledgeRetrievalConfigurationSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  query: valueSourceSchema,
  topK: z.number().int().positive().optional(),
})

const scriptInputSchema = z.strictObject({
  alias: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
  variableId: uuidSchema,
})

export const scriptExecutionConfigurationSchema = z
  .strictObject({
    language: z.enum(['python', 'javascript']),
    inputs: z.array(scriptInputSchema).optional(),
    script: z.string().min(1),
  })
  .superRefine((configuration, context) => {
    const aliases = new Set<string>()
    configuration.inputs?.forEach((input, index) => {
      if (aliases.has(input.alias)) {
        context.addIssue({
          code: 'custom',
          message: 'Script input aliases must be unique',
          path: ['inputs', index, 'alias'],
        })
      }
      aliases.add(input.alias)
    })
  })

const apiHeaderSchema = z.strictObject({
  id: uuidSchema,
  name: z.string().min(1),
  value: valueSourceSchema,
})

const apiFormEntrySchema = z.strictObject({
  id: uuidSchema,
  name: z.string().min(1),
  value: valueSourceSchema,
})

export const apiRequestBodySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('json'), value: valueSourceSchema }),
  z.strictObject({ kind: z.literal('form_data'), entries: z.array(apiFormEntrySchema) }),
])

export const apiRequestConfigurationSchema = z
  .strictObject({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    url: valueSourceSchema,
    headers: z.array(apiHeaderSchema),
    body: apiRequestBodySchema,
  })
  .superRefine((configuration, context) => {
    const headerNames = new Set<string>()
    configuration.headers.forEach((header, index) => {
      const normalizedName = header.name.toLocaleLowerCase('en-US')
      if (headerNames.has(normalizedName)) {
        context.addIssue({
          code: 'custom',
          message: 'API header names must be unique case-insensitively',
          path: ['headers', index, 'name'],
        })
      }
      headerNames.add(normalizedName)
    })
  })

const setVariableValueConfigurationSchema = z.strictObject({
  targetVariableId: uuidSchema,
  operation: z.enum(['assign', 'append', 'increment']),
  value: valueSourceSchema,
})
const toggleVariableConfigurationSchema = z.strictObject({
  targetVariableId: uuidSchema,
  operation: z.literal('toggle'),
})
export const setVariableConfigurationSchema = z.discriminatedUnion('operation', [
  setVariableValueConfigurationSchema,
  toggleVariableConfigurationSchema,
])

export const llmCallConfigurationSchema = z.strictObject({
  model: z.string().min(1),
  systemPrompt: valueSourceSchema.optional(),
  prompt: valueSourceSchema,
})

const toolStepBase = {
  id: uuidSchema,
  label: z.string().nullable().optional(),
  failureBehavior: toolFailureBehaviorSchema,
} as const

const knowledgeRetrievalToolStepSchema = z.strictObject({
  ...toolStepBase,
  kind: z.literal('knowledge_retrieval'),
  configuration: knowledgeRetrievalConfigurationSchema,
  outputMapping: outputMappingSchema('retrieved_documents'),
})
const scriptExecutionToolStepSchema = z.strictObject({
  ...toolStepBase,
  kind: z.literal('script_execution'),
  configuration: scriptExecutionConfigurationSchema,
  outputMapping: outputMappingSchema('result'),
})
const apiRequestToolStepSchema = z.strictObject({
  ...toolStepBase,
  kind: z.literal('api_request'),
  configuration: apiRequestConfigurationSchema,
  outputMapping: outputMappingSchema('response.data'),
})
const setVariableToolStepSchema = z.strictObject({
  ...toolStepBase,
  kind: z.literal('set_variable'),
  configuration: setVariableConfigurationSchema,
  outputMapping: z.null(),
})
const llmCallToolStepSchema = z.strictObject({
  ...toolStepBase,
  kind: z.literal('llm_call'),
  configuration: llmCallConfigurationSchema,
  outputMapping: outputMappingSchema('response.text'),
})

export const toolStepSchema = z.discriminatedUnion('kind', [
  knowledgeRetrievalToolStepSchema,
  scriptExecutionToolStepSchema,
  apiRequestToolStepSchema,
  setVariableToolStepSchema,
  llmCallToolStepSchema,
])

const reusableToolBase = {
  id: uuidSchema,
  name: z.string().min(1),
  sourceTemplateId: uuidSchema.nullable(),
  inputBindings: z.array(valueSourceSchema),
  outputBinding: toolOutputMappingSchema.nullable(),
} as const

const reusableKnowledgeConfigurationSchema = z.strictObject({
  knowledgeSpaceId: uuidSchema,
  query: valueSourceSchema.optional(),
  topK: z.number().int().positive().optional(),
})

export const agentReusableToolSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...reusableToolBase, kind: z.literal('knowledge_retrieval'), configuration: reusableKnowledgeConfigurationSchema }),
  z.strictObject({ ...reusableToolBase, kind: z.literal('script_execution'), configuration: scriptExecutionConfigurationSchema }),
  z.strictObject({ ...reusableToolBase, kind: z.literal('api_request'), configuration: apiRequestConfigurationSchema }),
  z.strictObject({ ...reusableToolBase, kind: z.literal('set_variable'), configuration: setVariableConfigurationSchema }),
  z.strictObject({ ...reusableToolBase, kind: z.literal('llm_call'), configuration: llmCallConfigurationSchema }),
])

export type ToolKind = z.infer<typeof toolKindSchema>
export type ToolFailureBehavior = z.infer<typeof toolFailureBehaviorSchema>
export type ToolOutputMapping = z.infer<typeof toolOutputMappingSchema>
export type ToolStep = z.infer<typeof toolStepSchema>
export type AgentReusableTool = z.infer<typeof agentReusableToolSchema>
