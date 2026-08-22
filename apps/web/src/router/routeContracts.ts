import { uuidSchema, type UUID } from '@odyssey/schemas'
import type { LocationQueryValue } from 'vue-router'

export const journeyTabs = ['execution', 'behavior', 'agent'] as const
export type JourneyTab = (typeof journeyTabs)[number]

export interface JourneyRouteIdentity {
  journeyId: UUID
  tab: JourneyTab
}

export interface AgentWorkflowRouteIdentity {
  journeyId: UUID
  agentId: UUID
}

function firstQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export function parseJourneyTab(value: LocationQueryValue | LocationQueryValue[] | undefined): JourneyTab {
  const candidate = firstQueryValue(value)
  return journeyTabs.find((tab) => tab === candidate) ?? 'execution'
}

export function parseJourneyRoute(
  journeyId: string | string[] | undefined,
  tab?: LocationQueryValue | LocationQueryValue[],
): JourneyRouteIdentity | null {
  if (typeof journeyId !== 'string') return null
  const parsed = uuidSchema.safeParse(journeyId)
  return parsed.success ? { journeyId: parsed.data, tab: parseJourneyTab(tab) } : null
}

export function parseAgentWorkflowRoute(
  journeyId: string | string[] | undefined,
  agentId: string | string[] | undefined,
): AgentWorkflowRouteIdentity | null {
  if (typeof journeyId !== 'string' || typeof agentId !== 'string') return null
  const parsedJourneyId = uuidSchema.safeParse(journeyId)
  const parsedAgentId = uuidSchema.safeParse(agentId)
  return parsedJourneyId.success && parsedAgentId.success
    ? { journeyId: parsedJourneyId.data, agentId: parsedAgentId.data }
    : null
}

export const routeLocations = {
  journeys: () => ({ name: 'journeys' as const }),
  newJourney: () => ({ name: 'journey-create' as const }),
  journey: (journeyId: UUID, tab: JourneyTab = 'execution') => ({
    name: 'journey-editor' as const,
    params: { journeyId },
    query: { tab },
  }),
  agentWorkflow: (journeyId: UUID, agentId: UUID) => ({
    name: 'agent-workflow' as const,
    params: { journeyId, agentId },
  }),
}
