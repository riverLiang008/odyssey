import { patternConfigSchema, type PatternConfig, type PatternKind, type PatternSlot, type PatternTemplateKey } from '@odyssey/schemas'

import { PATTERN_DEFINITIONS, type PatternDefinition } from './patternDefinitions'
import type { PatternIdFactory } from './patternIdFactory'
import { derivePatternPresentation, type PatternPresentation } from './patternLayout'
import { deriveRouteEndpoints, reconcilePatternRoutes } from './patternRoutes'
import { validatePatternConfig, type PatternValidationResult } from './patternValidation'

export interface PatternStrategy {
  readonly definition: PatternDefinition
  instantiate(idFactory: PatternIdFactory): PatternConfig
  validate(input: unknown): PatternValidationResult
  derivePresentation(config: PatternConfig): PatternPresentation
}

function slot(idFactory: PatternIdFactory, label: string, topologyRole: string | null, order: number | null): PatternSlot {
  return { id: idFactory.slotId(), topologyRole, label, order, agentId: null, configuration: {} }
}

function initialSlots(kind: PatternKind, idFactory: PatternIdFactory): PatternSlot[] {
  switch (kind) {
    case 'solo_component': return [slot(idFactory, 'Solo', 'solo', null)]
    case 'linear_sequence': return Array.from({ length: 4 }, (_, index) => slot(idFactory, `Stage ${index + 1}`, null, index))
    case 'hub_and_spoke': return [
      slot(idFactory, 'Hub', 'hub', null),
      ...Array.from({ length: 4 }, (_, index) => slot(idFactory, `Spoke ${index + 1}`, 'spoke', null)),
    ]
    case 'diamond_loop': return [
      slot(idFactory, 'Entry', 'entry', null),
      slot(idFactory, 'Upper branch', 'upper_branch', null),
      slot(idFactory, 'Exit', 'exit', null),
      slot(idFactory, 'Lower branch', 'lower_branch', null),
    ]
  }
}

function instantiate(kind: PatternKind, idFactory: PatternIdFactory): PatternConfig {
  const definition = PATTERN_DEFINITIONS[kind]
  const slots = initialSlots(kind, idFactory)
  return patternConfigSchema.parse({
    schemaVersion: '1.0.0',
    id: idFactory.patternId(),
    templateKey: definition.templateKey,
    kind,
    name: definition.name,
    slots,
    routes: reconcilePatternRoutes([], deriveRouteEndpoints(kind, slots), idFactory),
    configuration: {},
  })
}

function strategy(kind: PatternKind): PatternStrategy {
  return {
    definition: PATTERN_DEFINITIONS[kind],
    instantiate: (idFactory) => instantiate(kind, idFactory),
    validate: validatePatternConfig,
    derivePresentation: derivePatternPresentation,
  }
}

export const PATTERN_STRATEGIES = {
  hub_and_spoke: strategy('hub_and_spoke'),
  diamond_loop: strategy('diamond_loop'),
  linear_sequence: strategy('linear_sequence'),
  solo_component: strategy('solo_component'),
} satisfies Record<PatternKind, PatternStrategy>

export function instantiatePattern(templateKey: PatternTemplateKey, idFactory: PatternIdFactory): PatternConfig {
  return PATTERN_STRATEGIES[templateKey].instantiate(idFactory)
}

