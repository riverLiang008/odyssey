import type { PatternTemplateKey, UUID } from '@odyssey/schemas'

import type { PatternDragPayload } from './odysseyDragPayload'
import type { DropFeedback, PatternDropTarget } from './evaluatePatternDrop'

export interface MenuAnchor { readonly x: number; readonly y: number }

export type PatternInteractionState =
  | { type: 'idle' }
  | { type: 'dragging'; payload: PatternDragPayload; over: PatternDropTarget | null; feedback: DropFeedback | null }
  | { type: 'menu-open'; slotId: UUID; anchor: MenuAnchor }
  | { type: 'choosing-agent'; slotId: UUID; mode: 'assign' | 'replace' }
  | { type: 'confirming-pattern-replacement'; templateKey: PatternTemplateKey; affectedAgentIds: readonly UUID[] }
  | { type: 'naming-duplicate'; sourceSlotId: UUID; draftName: string }

export type PatternInteractionEvent =
  | { type: 'begin-drag'; payload: PatternDragPayload }
  | { type: 'evaluate-drag'; target: PatternDropTarget; feedback: DropFeedback }
  | { type: 'leave-drop-target' }
  | { type: 'open-menu'; slotId: UUID; anchor: MenuAnchor }
  | { type: 'choose-agent'; slotId: UUID; mode: 'assign' | 'replace' }
  | { type: 'confirm-pattern-replacement'; templateKey: PatternTemplateKey; affectedAgentIds: readonly UUID[] }
  | { type: 'name-duplicate'; sourceSlotId: UUID; draftName: string }
  | { type: 'update-duplicate-name'; draftName: string }
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
    case 'choose-agent': return { type: 'choosing-agent', slotId: event.slotId, mode: event.mode }
    case 'confirm-pattern-replacement': return { type: 'confirming-pattern-replacement', templateKey: event.templateKey, affectedAgentIds: [...event.affectedAgentIds] }
    case 'name-duplicate': return { type: 'naming-duplicate', sourceSlotId: event.sourceSlotId, draftName: event.draftName }
    case 'update-duplicate-name': return state.type === 'naming-duplicate' ? { ...state, draftName: event.draftName } : state
    case 'cancel': return { type: 'idle' }
  }
}
