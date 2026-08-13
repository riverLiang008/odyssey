import type { PatternConfig, PatternTemplateKey, UUID } from '@odyssey/schemas'

import type { OdysseyDragPayloadV1 } from './odysseyDragPayload'

export type PatternDropTarget =
  | { kind: 'system-canvas' }
  | { kind: 'agent-slot'; slotId: UUID }
  | { kind: 'linear-order'; targetOrder: number }

export type PatternDropAction =
  | { type: 'stage-pattern-replacement'; templateKey: PatternTemplateKey; affectedAgentIds: readonly UUID[] }
  | { type: 'instantiate-agent-template'; templateId: UUID; targetSlotId: UUID }
  | { type: 'move-agent'; agentId: UUID; sourceSlotId: UUID; targetSlotId: UUID }
  | { type: 'exchange-agents'; agentId: UUID; sourceSlotId: UUID; targetSlotId: UUID }
  | { type: 'reorder-slot'; slotId: UUID; targetOrder: number }

export type PatternDropReason =
  | 'TARGET_KIND_UNSUPPORTED' | 'SLOT_NOT_FOUND' | 'TARGET_OCCUPIED' | 'SOURCE_SLOT_EMPTY'
  | 'SOURCE_AGENT_MISMATCH' | 'SAME_SLOT' | 'REORDER_UNSUPPORTED' | 'REORDER_POSITION_INVALID'

export interface DropFeedback {
  readonly tone: 'valid' | 'invalid' | 'occupied' | 'duplicate' | 'confirmation'
  readonly message: string
}

export type PatternDropEvaluation =
  | { status: 'valid'; action: PatternDropAction; feedback: DropFeedback }
  | { status: 'invalid' | 'occupied' | 'duplicate'; reason: PatternDropReason; feedback: DropFeedback }

const REASON_MESSAGES: Record<PatternDropReason, string> = {
  TARGET_KIND_UNSUPPORTED: 'This drop target does not support that item.',
  SLOT_NOT_FOUND: 'The target Agent Slot no longer exists.',
  TARGET_OCCUPIED: 'The target Agent Slot is occupied.',
  SOURCE_SLOT_EMPTY: 'The source Agent Slot is empty.',
  SOURCE_AGENT_MISMATCH: 'The source Agent assignment has changed. Start the drag again.',
  SAME_SLOT: 'Choose a different Agent Slot.',
  REORDER_UNSUPPORTED: 'This Pattern does not support Slot reordering.',
  REORDER_POSITION_INVALID: 'The requested Slot position is invalid.',
}

const PATTERN_REPLACEMENT_CONFIRMATION_MESSAGE = 'Replacing the Pattern requires confirmation.'

function rejected(status: 'invalid' | 'occupied' | 'duplicate', reason: PatternDropReason): PatternDropEvaluation {
  return { status, reason, feedback: { tone: status, message: REASON_MESSAGES[reason] } }
}

function accepted(action: PatternDropAction, message: string, tone: DropFeedback['tone'] = 'valid'): PatternDropEvaluation {
  return { status: 'valid', action, feedback: { tone, message } }
}

export function evaluatePatternDrop(
  payload: OdysseyDragPayloadV1,
  target: PatternDropTarget,
  pattern: Readonly<PatternConfig>,
): PatternDropEvaluation {
  if (payload.kind === 'workflow-node-template' || payload.kind === 'resource') {
    return rejected('invalid', 'TARGET_KIND_UNSUPPORTED')
  }
  if (payload.kind === 'pattern-template') {
    if (target.kind !== 'system-canvas') return rejected('invalid', 'TARGET_KIND_UNSUPPORTED')
    const affectedAgentIds = [...new Set(pattern.slots.flatMap((slot) => slot.agentId ? [slot.agentId] : []))]
    return accepted(
      { type: 'stage-pattern-replacement', templateKey: payload.templateKey, affectedAgentIds },
      PATTERN_REPLACEMENT_CONFIRMATION_MESSAGE,
      'confirmation',
    )
  }
  if (payload.kind === 'agent-template') {
    if (target.kind !== 'agent-slot') return rejected('invalid', 'TARGET_KIND_UNSUPPORTED')
    const slot = pattern.slots.find((candidate) => candidate.id === target.slotId)
    if (!slot) return rejected('invalid', 'SLOT_NOT_FOUND')
    if (slot.agentId) return rejected('occupied', 'TARGET_OCCUPIED')
    return accepted({ type: 'instantiate-agent-template', templateId: payload.templateId, targetSlotId: slot.id }, 'Assign this Agent Template to the Slot.')
  }
  if (payload.kind === 'assigned-agent') {
    if (target.kind !== 'agent-slot') return rejected('invalid', 'TARGET_KIND_UNSUPPORTED')
    const source = pattern.slots.find((slot) => slot.id === payload.sourceSlotId)
    const destination = pattern.slots.find((slot) => slot.id === target.slotId)
    if (!source || !destination) return rejected('invalid', 'SLOT_NOT_FOUND')
    if (source.agentId === null) return rejected('invalid', 'SOURCE_SLOT_EMPTY')
    if (source.agentId !== payload.agentId) return rejected('invalid', 'SOURCE_AGENT_MISMATCH')
    if (source.id === destination.id) return rejected('duplicate', 'SAME_SLOT')
    return destination.agentId
      ? accepted({ type: 'exchange-agents', agentId: payload.agentId, sourceSlotId: source.id, targetSlotId: destination.id }, 'Exchange the assigned Agents.')
      : accepted({ type: 'move-agent', agentId: payload.agentId, sourceSlotId: source.id, targetSlotId: destination.id }, 'Move the Agent to this Slot.')
  }
  if (target.kind !== 'linear-order') return rejected('invalid', 'TARGET_KIND_UNSUPPORTED')
  if (pattern.kind !== 'linear_sequence') return rejected('invalid', 'REORDER_UNSUPPORTED')
  if (!pattern.slots.some((slot) => slot.id === payload.slotId)) return rejected('invalid', 'SLOT_NOT_FOUND')
  if (!Number.isInteger(target.targetOrder) || target.targetOrder < 0 || target.targetOrder >= pattern.slots.length) {
    return rejected('invalid', 'REORDER_POSITION_INVALID')
  }
  return accepted({ type: 'reorder-slot', slotId: payload.slotId, targetOrder: target.targetOrder }, 'Move the Slot to this position.')
}
