import type { PatternKind, PatternTemplateKey } from '@odyssey/schemas'

export type PatternOperation =
  | 'assign_agent'
  | 'move_agent'
  | 'exchange_agents'
  | 'unassign_agent'
  | 'add_slot'
  | 'remove_slot'
  | 'reorder_slot'

export interface PatternDefinition {
  readonly kind: PatternKind
  readonly templateKey: PatternTemplateKey
  readonly name: string
  readonly initialSlotCount: number
  readonly supportedOperations: readonly PatternOperation[]
}

const ASSIGNMENT_OPERATIONS = [
  'assign_agent',
  'move_agent',
  'exchange_agents',
  'unassign_agent',
] as const

export const PATTERN_DEFINITIONS = {
  hub_and_spoke: {
    kind: 'hub_and_spoke',
    templateKey: 'hub_and_spoke',
    name: 'Hub and spoke',
    initialSlotCount: 5,
    supportedOperations: [...ASSIGNMENT_OPERATIONS, 'add_slot', 'remove_slot'],
  },
  diamond_loop: {
    kind: 'diamond_loop',
    templateKey: 'diamond_loop',
    name: 'Diamond loop',
    initialSlotCount: 4,
    supportedOperations: ASSIGNMENT_OPERATIONS,
  },
  linear_sequence: {
    kind: 'linear_sequence',
    templateKey: 'linear_sequence',
    name: 'Linear sequence',
    initialSlotCount: 4,
    supportedOperations: [...ASSIGNMENT_OPERATIONS, 'add_slot', 'remove_slot', 'reorder_slot'],
  },
  solo_component: {
    kind: 'solo_component',
    templateKey: 'solo_component',
    name: 'Solo component',
    initialSlotCount: 1,
    supportedOperations: ASSIGNMENT_OPERATIONS,
  },
} as const satisfies Record<PatternKind, PatternDefinition>

