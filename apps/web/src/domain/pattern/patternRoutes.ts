import type { PatternKind, PatternRoute, PatternRouteTarget, PatternSlot, UUID } from '@odyssey/schemas'

import type { PatternIdFactory } from './patternIdFactory'

export interface RouteEndpoint {
  readonly sourceSlotId: UUID
  readonly target: PatternRouteTarget
}

function slotWithRole(slots: readonly PatternSlot[], role: string): PatternSlot | undefined {
  return slots.find((slot) => slot.topologyRole === role)
}

export function routeEndpointKey(endpoint: RouteEndpoint): string {
  return endpoint.target.type === 'slot'
    ? `${endpoint.sourceSlotId}->slot:${endpoint.target.slotId}`
    : `${endpoint.sourceSlotId}->journey_end`
}

export function deriveRouteEndpoints(kind: PatternKind, slots: readonly PatternSlot[]): RouteEndpoint[] {
  if (kind === 'solo_component') return []

  if (kind === 'linear_sequence') {
    const ordered = [...slots].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    return ordered.map((slot, index) => ({
      sourceSlotId: slot.id,
      target: index === ordered.length - 1
        ? { type: 'journey_end' }
        : { type: 'slot', slotId: ordered[index + 1]!.id },
    }))
  }

  if (kind === 'hub_and_spoke') {
    const hub = slotWithRole(slots, 'hub')
    if (!hub) return []
    return slots
      .filter((slot) => slot.topologyRole === 'spoke')
      .map((spoke) => ({ sourceSlotId: hub.id, target: { type: 'slot', slotId: spoke.id } }))
  }

  const roleSequence = ['entry', 'upper_branch', 'exit', 'lower_branch'] as const
  const roleSlots = roleSequence.map((role) => slotWithRole(slots, role))
  if (roleSlots.some((slot) => slot === undefined)) return []
  return roleSlots.map((slot, index) => ({
    sourceSlotId: slot!.id,
    target: { type: 'slot', slotId: roleSlots[(index + 1) % roleSlots.length]!.id },
  }))
}

export function reconcilePatternRoutes(
  existing: readonly PatternRoute[],
  endpoints: readonly RouteEndpoint[],
  idFactory: Pick<PatternIdFactory, 'routeId'>,
): PatternRoute[] {
  const existingByEndpoint = new Map<string, PatternRoute[]>()
  existing.forEach((route) => {
    const key = routeEndpointKey(route)
    existingByEndpoint.set(key, [...(existingByEndpoint.get(key) ?? []), route])
  })

  return endpoints.map((endpoint) => {
    const candidates = existingByEndpoint.get(routeEndpointKey(endpoint))
    const matchedRoute = candidates?.shift()
    return {
      id: matchedRoute?.id ?? idFactory.routeId(),
      sourceSlotId: endpoint.sourceSlotId,
      target: endpoint.target,
    }
  })
}
