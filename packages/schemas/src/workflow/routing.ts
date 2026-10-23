import { z } from 'zod'

import { uuidSchema, type UUID } from '../common'
import { patternRouteTargetSchema, type PatternConfig } from '../pattern/pattern'

export const endBindingSchema = z.strictObject({
  sourceSlotId: uuidSchema,
  target: patternRouteTargetSchema,
})

export type EndBinding = z.infer<typeof endBindingSchema>

/** Slot bindings remain valid even while the target Slot has no Agent. */
export function deriveEndBindings(pattern: PatternConfig, slotId: UUID): EndBinding[] {
  if (!pattern.slots.some((slot) => slot.id === slotId)) return []
  const routes = pattern.routes.filter((route) => route.sourceSlotId === slotId)
  return routes.length
    ? routes.map((route) => ({ sourceSlotId: slotId, target: { ...route.target } }))
    : [{ sourceSlotId: slotId, target: { type: 'journey_end' } }]
}

export function endBindingKey(binding: EndBinding): string {
  return `${binding.sourceSlotId}:${binding.target.type === 'slot' ? binding.target.slotId : 'journey_end'}`
}
