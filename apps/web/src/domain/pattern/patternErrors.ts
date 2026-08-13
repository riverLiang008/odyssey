import type { PatternConfig, PatternKind, UUID } from '@odyssey/schemas'

import type { PatternOperation } from './patternDefinitions'
import type { PatternTopologyIssue } from './patternValidation'

export type PatternDomainError =
  | { readonly code: 'INVALID_TOPOLOGY'; readonly issues: readonly PatternTopologyIssue[] }
  | { readonly code: 'SLOT_NOT_FOUND'; readonly slotId: UUID }
  | { readonly code: 'AGENT_ALREADY_ASSIGNED'; readonly agentId: UUID; readonly slotId: UUID }
  | { readonly code: 'TARGET_SLOT_OCCUPIED'; readonly slotId: UUID }
  | { readonly code: 'SOURCE_SLOT_EMPTY'; readonly slotId: UUID }
  | { readonly code: 'SAME_SLOT'; readonly slotId: UUID }
  | { readonly code: 'OPERATION_NOT_SUPPORTED'; readonly operation: PatternOperation; readonly kind: PatternKind }
  | { readonly code: 'CARDINALITY_VIOLATION'; readonly kind: PatternKind }
  | { readonly code: 'IMMUTABLE_TOPOLOGY_ROLE'; readonly slotId: UUID }
  | { readonly code: 'SLOT_OCCUPIED'; readonly slotId: UUID }
  | { readonly code: 'INVALID_REORDER_POSITION'; readonly targetOrder: number }
  | { readonly code: 'INVALID_SLOT_LABEL' }

export type PatternCommandResult =
  | { readonly ok: true; readonly value: PatternConfig }
  | { readonly ok: false; readonly error: PatternDomainError }

