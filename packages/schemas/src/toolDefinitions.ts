import { z } from 'zod'
import { jsonValueSchema, uuidSchema } from './common'
import { toolKindSchema } from './workflow/tools'

// Inventory schemas are descriptive metadata. ToolStep is the canonical validator.
export const systemToolDefinitionSchema = z.strictObject({
  id: uuidSchema,
  kind: toolKindSchema,
  source: z.literal('built_in'),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().nullable(),
  configurationSchema: z.record(z.string(), jsonValueSchema),
  inputSchema: z.record(z.string(), jsonValueSchema),
  outputSchema: z.record(z.string(), jsonValueSchema),
})
export const systemToolDefinitionListSchema = z.array(systemToolDefinitionSchema)
export type SystemToolDefinition = z.infer<typeof systemToolDefinitionSchema>
