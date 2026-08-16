import { patternConfigSchema, type PatternConfig, type PatternKind } from '@odyssey/schemas'

import { deriveRouteEndpoints, routeEndpointKey } from './patternRoutes'

export type PatternTopologyErrorCode =
  | 'SCHEMA_INVALID'
  | 'PATTERN_KIND_MISMATCH'
  | 'SLOT_CARDINALITY_INVALID'
  | 'TOPOLOGY_ROLE_INVALID'
  | 'SLOT_ORDER_INVALID'
  | 'OWNED_ID_COLLISION'
  | 'AGENT_ASSIGNED_MORE_THAN_ONCE'
  | 'ROUTE_TOPOLOGY_INVALID'

export interface PatternTopologyIssue {
  readonly code: PatternTopologyErrorCode
  readonly path?: readonly (string | number)[]
}

export type PatternValidationResult =
  | { readonly ok: true; readonly value: PatternConfig }
  | { readonly ok: false; readonly errors: readonly PatternTopologyIssue[] }

function cardinalityAndRoleIssues(pattern: PatternConfig): PatternTopologyIssue[] {
  const issues: PatternTopologyIssue[] = []
  const roles = pattern.slots.map((slot) => slot.topologyRole)
  const roleCount = (role: string): number => roles.filter((candidate) => candidate === role).length
  const allOrdersNull = pattern.slots.every((slot) => slot.order === null)

  if (pattern.kind === 'solo_component') {
    if (pattern.slots.length !== 1) issues.push({ code: 'SLOT_CARDINALITY_INVALID' })
    if (roleCount('solo') !== 1 || roles.some((role) => role !== 'solo')) issues.push({ code: 'TOPOLOGY_ROLE_INVALID' })
    if (!allOrdersNull) issues.push({ code: 'SLOT_ORDER_INVALID' })
  } else if (pattern.kind === 'linear_sequence') {
    if (pattern.slots.length < 1) issues.push({ code: 'SLOT_CARDINALITY_INVALID' })
    if (roles.some((role) => role !== null)) issues.push({ code: 'TOPOLOGY_ROLE_INVALID' })
    const orders = pattern.slots.map((slot) => slot.order).sort((left, right) => (left ?? -1) - (right ?? -1))
    if (orders.some((order, index) => order !== index)) issues.push({ code: 'SLOT_ORDER_INVALID' })
  } else if (pattern.kind === 'hub_and_spoke') {
    if (pattern.slots.length < 2) issues.push({ code: 'SLOT_CARDINALITY_INVALID' })
    if (roleCount('hub') !== 1 || roleCount('spoke') !== pattern.slots.length - 1) {
      issues.push({ code: 'TOPOLOGY_ROLE_INVALID' })
    }
    if (!allOrdersNull) issues.push({ code: 'SLOT_ORDER_INVALID' })
  } else {
    if (pattern.slots.length < 2) issues.push({ code: 'SLOT_CARDINALITY_INVALID' })
    if (roleCount('entry') !== 1 || roleCount('loop') !== pattern.slots.length - 1) {
      issues.push({ code: 'TOPOLOGY_ROLE_INVALID' })
    }
    const orders = pattern.slots.map((slot) => slot.order).sort((left, right) => (left ?? -1) - (right ?? -1))
    if (orders.some((order, index) => order !== index)) issues.push({ code: 'SLOT_ORDER_INVALID' })
  }
  return issues
}

function routeTopologyIsValid(pattern: PatternConfig): boolean {
  const expected = deriveRouteEndpoints(pattern.kind, pattern.slots).map(routeEndpointKey).sort()
  const actual = pattern.routes.map(routeEndpointKey).sort()
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
}

export function validatePatternConfig(input: unknown): PatternValidationResult {
  const parsed = patternConfigSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        code: 'SCHEMA_INVALID',
        path: issue.path.filter((segment): segment is string | number => typeof segment !== 'symbol'),
      })),
    }
  }

  const pattern = parsed.data
  const errors: PatternTopologyIssue[] = []
  if (pattern.templateKey !== pattern.kind) errors.push({ code: 'PATTERN_KIND_MISMATCH' })
  errors.push(...cardinalityAndRoleIssues(pattern))

  const ownedIds = [pattern.id, ...pattern.slots.map((slot) => slot.id), ...pattern.routes.map((route) => route.id)]
  if (new Set(ownedIds).size !== ownedIds.length) errors.push({ code: 'OWNED_ID_COLLISION' })

  const assignedAgentIds = pattern.slots.flatMap((slot) => slot.agentId ? [slot.agentId] : [])
  if (new Set(assignedAgentIds).size !== assignedAgentIds.length) {
    errors.push({ code: 'AGENT_ASSIGNED_MORE_THAN_ONCE' })
  }
  if (!routeTopologyIsValid(pattern)) errors.push({ code: 'ROUTE_TOPOLOGY_INVALID' })

  return errors.length === 0 ? { ok: true, value: pattern } : { ok: false, errors }
}

export function isPatternKind(value: string): value is PatternKind {
  return value === 'hub_and_spoke' || value === 'diamond_loop' || value === 'linear_sequence' || value === 'solo_component'
}
