import type { UUID } from '@odyssey/schemas'

import type { PatternDragPayload } from './odysseyDragPayload'
import type { DropFeedback, PatternDropTarget } from './evaluatePatternDrop'

export interface MenuAnchor { readonly x: number; readonly y: number }

export type PatternInteractionState =
  | { type: 'idle' }
  | { type: 'dragging'; payload: PatternDragPayload; over: PatternDropTarget | null; feedback: DropFeedback | null }
  | { type: 'menu-open'; slotId: UUID; anchor: MenuAnchor }
  | { type: 'naming-template'; slotId: UUID }
  | { type: 'confirming-slot-removal'; slotId: UUID; agentId: UUID }
  | { type: 'slot-removal-requested'; slotId: UUID; agentId: UUID }
  | { type: 'choosing-agent'; slotId: UUID; mode: 'assign' | 'replace' }
  | { type: 'confirming-agent-replacement'; slotId: UUID; templateId: UUID }
  | { type: 'agent-replacement-requested'; slotId: UUID; templateId: UUID }
  | { type: 'naming-duplicate'; sourceSlotId: UUID; targetSlotId: UUID | null; draftName: string }
  | { type: 'duplicate-requested'; sourceSlotId: UUID; targetSlotId: UUID; name: string }

export type PatternInteractionEvent =
  | { type: 'begin-drag'; payload: PatternDragPayload }
  | { type: 'evaluate-drag'; target: PatternDropTarget; feedback: DropFeedback }
  | { type: 'leave-drop-target' }
  | { type: 'open-menu'; slotId: UUID; anchor: MenuAnchor }
  | { type: 'name-template'; slotId: UUID }
  | { type: 'confirm-slot-removal'; slotId: UUID; agentId: UUID }
  | { type: 'request-slot-removal' }
  | { type: 'choose-agent'; slotId: UUID; mode: 'assign' | 'replace' }
  | { type: 'confirm-agent-replacement'; slotId: UUID; templateId: UUID }
  | { type: 'request-agent-replacement' }
  | { type: 'name-duplicate'; sourceSlotId: UUID; targetSlotId: UUID | null; draftName: string }
  | { type: 'update-duplicate-name'; draftName: string }
  | { type: 'update-duplicate-target'; targetSlotId: UUID }
  | { type: 'request-duplicate' }
  | { type: 'cancel' }

export function transitionPatternInteraction(
  state: PatternInteractionState,
  event: PatternInteractionEvent,
): PatternInteractionState {
  switch (event.type) {
    case 'begin-drag': return { type: 'dragging', payload: event.payload, over: null, feedback: null }
    case 'evaluate-drag':
      return state.type === 'dragging' ? { ...state, over: event.target, feedback: event.feedback } : state
    case 'leave-drop-target':
      return state.type === 'dragging' ? { ...state, over: null, feedback: null } : state
    case 'open-menu': return { type: 'menu-open', slotId: event.slotId, anchor: event.anchor }
    case 'name-template': return { type: 'naming-template', slotId: event.slotId }
    case 'confirm-slot-removal': return { type: 'confirming-slot-removal', slotId: event.slotId, agentId: event.agentId }
    case 'request-slot-removal':
      return state.type === 'confirming-slot-removal'
        ? { type: 'slot-removal-requested', slotId: state.slotId, agentId: state.agentId }
        : state
    case 'choose-agent': return { type: 'choosing-agent', slotId: event.slotId, mode: event.mode }
    case 'confirm-agent-replacement': return { type: 'confirming-agent-replacement', slotId: event.slotId, templateId: event.templateId }
    case 'request-agent-replacement':
      return state.type === 'confirming-agent-replacement'
        ? { type: 'agent-replacement-requested', slotId: state.slotId, templateId: state.templateId }
        : state
    case 'name-duplicate': return { type: 'naming-duplicate', sourceSlotId: event.sourceSlotId, targetSlotId: event.targetSlotId, draftName: event.draftName }
    case 'update-duplicate-name': return state.type === 'naming-duplicate' ? { ...state, draftName: event.draftName } : state
    case 'update-duplicate-target': return state.type === 'naming-duplicate' ? { ...state, targetSlotId: event.targetSlotId } : state
    case 'request-duplicate':
      return state.type === 'naming-duplicate' && state.targetSlotId && state.draftName.trim()
        ? { type: 'duplicate-requested', sourceSlotId: state.sourceSlotId, targetSlotId: state.targetSlotId, name: state.draftName.trim() }
        : state
    case 'cancel': return { type: 'idle' }
  }
}
