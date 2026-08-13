import type { PatternConfig, PatternSlot, UUID } from '@odyssey/schemas'

import { PATTERN_DEFINITIONS, type PatternOperation } from './patternDefinitions'
import type { PatternCommandResult, PatternDomainError } from './patternErrors'
import type { PatternIdFactory } from './patternIdFactory'
import { deriveRouteEndpoints, reconcilePatternRoutes } from './patternRoutes'
import { validatePatternConfig } from './patternValidation'

function failure(error: PatternDomainError): PatternCommandResult {
  return { ok: false, error }
}

function validated(pattern: PatternConfig): PatternCommandResult | null {
  const validation = validatePatternConfig(pattern)
  return validation.ok ? null : failure({ code: 'INVALID_TOPOLOGY', issues: validation.errors })
}

function finalize(candidate: PatternConfig): PatternCommandResult {
  return validated(candidate) ?? { ok: true, value: candidate }
}

function slotIndex(pattern: PatternConfig, slotId: UUID): number {
  return pattern.slots.findIndex((slot) => slot.id === slotId)
}

function unsupported(pattern: PatternConfig, operation: PatternOperation): PatternCommandResult | null {
  const supportedOperations: readonly PatternOperation[] = PATTERN_DEFINITIONS[pattern.kind].supportedOperations
  return supportedOperations.includes(operation)
    ? null
    : failure({ code: 'OPERATION_NOT_SUPPORTED', operation, kind: pattern.kind })
}

function reconcileCandidate(candidate: PatternConfig, idFactory: Pick<PatternIdFactory, 'routeId'>): PatternCommandResult {
  candidate.routes = reconcilePatternRoutes(candidate.routes, deriveRouteEndpoints(candidate.kind, candidate.slots), idFactory)
  return finalize(candidate)
}

export function assignAgent(pattern: PatternConfig, slotId: UUID, agentId: UUID): PatternCommandResult {
  const invalid = validated(pattern)
  if (invalid) return invalid
  const index = slotIndex(pattern, slotId)
  if (index < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  const assignedSlot = pattern.slots.find((slot) => slot.agentId === agentId)
  if (assignedSlot) return failure({ code: 'AGENT_ALREADY_ASSIGNED', agentId, slotId: assignedSlot.id })
  if (pattern.slots[index]?.agentId !== null) return failure({ code: 'TARGET_SLOT_OCCUPIED', slotId })

  const candidate = structuredClone(pattern)
  candidate.slots[index]!.agentId = agentId
  return finalize(candidate)
}

export function moveAgent(pattern: PatternConfig, sourceSlotId: UUID, targetSlotId: UUID): PatternCommandResult {
  const invalid = validated(pattern)
  if (invalid) return invalid
  if (sourceSlotId === targetSlotId) return failure({ code: 'SAME_SLOT', slotId: sourceSlotId })
  const sourceIndex = slotIndex(pattern, sourceSlotId)
  const targetIndex = slotIndex(pattern, targetSlotId)
  if (sourceIndex < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId: sourceSlotId })
  if (targetIndex < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId: targetSlotId })
  const agentId = pattern.slots[sourceIndex]?.agentId
  if (!agentId) return failure({ code: 'SOURCE_SLOT_EMPTY', slotId: sourceSlotId })
  if (pattern.slots[targetIndex]?.agentId !== null) return failure({ code: 'TARGET_SLOT_OCCUPIED', slotId: targetSlotId })

  const candidate = structuredClone(pattern)
  candidate.slots[sourceIndex]!.agentId = null
  candidate.slots[targetIndex]!.agentId = agentId
  return finalize(candidate)
}

export function exchangeAgents(pattern: PatternConfig, firstSlotId: UUID, secondSlotId: UUID): PatternCommandResult {
  const invalid = validated(pattern)
  if (invalid) return invalid
  if (firstSlotId === secondSlotId) return failure({ code: 'SAME_SLOT', slotId: firstSlotId })
  const firstIndex = slotIndex(pattern, firstSlotId)
  const secondIndex = slotIndex(pattern, secondSlotId)
  if (firstIndex < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId: firstSlotId })
  if (secondIndex < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId: secondSlotId })

  const candidate = structuredClone(pattern)
  const firstAgentId = candidate.slots[firstIndex]!.agentId
  candidate.slots[firstIndex]!.agentId = candidate.slots[secondIndex]!.agentId
  candidate.slots[secondIndex]!.agentId = firstAgentId
  return finalize(candidate)
}

export function unassignAgent(pattern: PatternConfig, slotId: UUID): PatternCommandResult {
  const invalid = validated(pattern)
  if (invalid) return invalid
  const index = slotIndex(pattern, slotId)
  if (index < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  if (pattern.slots[index]?.agentId === null) return failure({ code: 'SOURCE_SLOT_EMPTY', slotId })

  const candidate = structuredClone(pattern)
  candidate.slots[index]!.agentId = null
  return finalize(candidate)
}

export function addSlot(
  pattern: PatternConfig,
  label: string,
  idFactory: Pick<PatternIdFactory, 'slotId' | 'routeId'>,
): PatternCommandResult {
  const invalid = validated(pattern) ?? unsupported(pattern, 'add_slot')
  if (invalid) return invalid
  if (label.trim().length === 0) return failure({ code: 'INVALID_SLOT_LABEL' })

  const candidate = structuredClone(pattern)
  const newSlot: PatternSlot = {
    id: idFactory.slotId(),
    topologyRole: candidate.kind === 'hub_and_spoke' ? 'spoke' : null,
    label: label.trim(),
    order: candidate.kind === 'linear_sequence' ? candidate.slots.length : null,
    agentId: null,
    configuration: {},
  }
  candidate.slots.push(newSlot)
  return reconcileCandidate(candidate, idFactory)
}

export function removeSlot(
  pattern: PatternConfig,
  slotId: UUID,
  idFactory: Pick<PatternIdFactory, 'routeId'>,
): PatternCommandResult {
  const invalid = validated(pattern) ?? unsupported(pattern, 'remove_slot')
  if (invalid) return invalid
  const index = slotIndex(pattern, slotId)
  if (index < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  const slot = pattern.slots[index]
  if (!slot) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  if (pattern.kind === 'hub_and_spoke' && slot.topologyRole === 'hub') {
    return failure({ code: 'IMMUTABLE_TOPOLOGY_ROLE', slotId })
  }
  if (slot.agentId !== null) return failure({ code: 'SLOT_OCCUPIED', slotId })
  if ((pattern.slots.length <= 2 && pattern.kind === 'hub_and_spoke') || pattern.slots.length <= 1) {
    return failure({ code: 'CARDINALITY_VIOLATION', kind: pattern.kind })
  }

  const candidate = structuredClone(pattern)
  candidate.slots.splice(index, 1)
  if (candidate.kind === 'linear_sequence') {
    candidate.slots
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .forEach((candidateSlot, order) => { candidateSlot.order = order })
  }
  return reconcileCandidate(candidate, idFactory)
}

export function reorderSlot(
  pattern: PatternConfig,
  slotId: UUID,
  targetOrder: number,
  idFactory: Pick<PatternIdFactory, 'routeId'>,
): PatternCommandResult {
  const invalid = validated(pattern) ?? unsupported(pattern, 'reorder_slot')
  if (invalid) return invalid
  const index = slotIndex(pattern, slotId)
  if (index < 0) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  if (!Number.isInteger(targetOrder) || targetOrder < 0 || targetOrder >= pattern.slots.length) {
    return failure({ code: 'INVALID_REORDER_POSITION', targetOrder })
  }

  const candidate = structuredClone(pattern)
  const ordered = candidate.slots.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
  const sourceIndex = ordered.findIndex((slot) => slot.id === slotId)
  const moved = ordered.splice(sourceIndex, 1)[0]
  if (!moved) return failure({ code: 'SLOT_NOT_FOUND', slotId })
  ordered.splice(targetOrder, 0, moved)
  ordered.forEach((slot, order) => { slot.order = order })
  return reconcileCandidate(candidate, idFactory)
}
