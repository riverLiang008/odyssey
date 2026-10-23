import { z } from 'zod'

import { jsonObjectSchema, uuidSchema } from '../common'

export const PATTERN_KINDS = [
  'hub_and_spoke',
  'diamond_loop',
  'linear_sequence',
  'solo_component',
] as const

export const hubSpokeDirectionSchema = z.enum(['hub_to_spoke', 'spoke_to_hub', 'bidirectional'])
export type HubSpokeDirection = z.infer<typeof hubSpokeDirectionSchema>
export function getHubSpokeDirection(slot: { configuration: { [key: string]: unknown } }): HubSpokeDirection {
  return hubSpokeDirectionSchema.parse(slot.configuration.direction ?? 'hub_to_spoke')
}

export const patternKindSchema = z.enum(PATTERN_KINDS)
export const patternTemplateKeySchema = z.enum(PATTERN_KINDS)

export const patternSlotSchema = z.strictObject({
  id: uuidSchema,
  topologyRole: z.string().min(1).nullable(),
  label: z.string().min(1),
  order: z.number().int().min(0).nullable(),
  agentId: uuidSchema.nullable(),
  configuration: jsonObjectSchema,
})

const slotRouteTargetSchema = z.strictObject({
  type: z.literal('slot'),
  slotId: uuidSchema,
})

const journeyEndRouteTargetSchema = z.strictObject({
  type: z.literal('journey_end'),
})

export const patternRouteTargetSchema = z.discriminatedUnion('type', [
  slotRouteTargetSchema,
  journeyEndRouteTargetSchema,
])

export const patternRouteSchema = z.strictObject({
  id: uuidSchema,
  sourceSlotId: uuidSchema,
  target: patternRouteTargetSchema,
})

export const patternConfigSchema = z
  .strictObject({
    schemaVersion: z.enum(['1.0.0', '1.1.0']),
    id: uuidSchema,
    templateKey: patternTemplateKeySchema,
    kind: patternKindSchema,
    name: z.string().min(1),
    slots: z.array(patternSlotSchema),
    routes: z.array(patternRouteSchema),
    configuration: jsonObjectSchema,
  })
  .superRefine((pattern, context) => {
    const slotIds = new Set<string>()
    pattern.slots.forEach((slot, index) => {
      if (slotIds.has(slot.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Pattern slot IDs must be unique',
          path: ['slots', index, 'id'],
        })
      }
      slotIds.add(slot.id)
      if (slot.configuration.direction !== undefined && (pattern.schemaVersion !== '1.1.0' || pattern.kind !== 'hub_and_spoke' || slot.topologyRole !== 'spoke' || !hubSpokeDirectionSchema.safeParse(slot.configuration.direction).success)) {
        context.addIssue({ code: 'custom', message: 'Direction belongs to a Hub spoke and must be a supported direction', path: ['slots', index, 'configuration', 'direction'] })
      }
    })

    const routeIds = new Set<string>()
    pattern.routes.forEach((route, index) => {
      if (routeIds.has(route.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Pattern route IDs must be unique',
          path: ['routes', index, 'id'],
        })
      }
      routeIds.add(route.id)

      if (!slotIds.has(route.sourceSlotId)) {
        context.addIssue({
          code: 'custom',
          message: 'Pattern route source must reference an existing slot',
          path: ['routes', index, 'sourceSlotId'],
        })
      }

      if (route.target.type === 'slot' && !slotIds.has(route.target.slotId)) {
        context.addIssue({
          code: 'custom',
          message: 'Pattern route target must reference an existing slot',
          path: ['routes', index, 'target', 'slotId'],
        })
      }
    })
  })

const patternTemplateSummaryFields = {
  id: uuidSchema,
  kind: patternKindSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
} as const

const builtInPatternTemplateSummarySchema = z.strictObject({
  ...patternTemplateSummaryFields,
  source: z.literal('built_in'),
  templateKey: patternTemplateKeySchema,
})

const userPatternTemplateSummarySchema = z.strictObject({
  ...patternTemplateSummaryFields,
  source: z.literal('user'),
  templateKey: z.null(),
})

export const patternTemplateSummarySchema = z.discriminatedUnion('source', [
  builtInPatternTemplateSummarySchema,
  userPatternTemplateSummarySchema,
])

export type PatternKind = z.infer<typeof patternKindSchema>
export type PatternTemplateKey = z.infer<typeof patternTemplateKeySchema>
export type PatternSlot = z.infer<typeof patternSlotSchema>
export type PatternRouteTarget = z.infer<typeof patternRouteTargetSchema>
export type PatternRoute = z.infer<typeof patternRouteSchema>
export type PatternConfig = z.infer<typeof patternConfigSchema>
export type PatternTemplateSummary = z.infer<typeof patternTemplateSummarySchema>
