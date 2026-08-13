import { createJourneyEditorDocumentFixture } from '@/fixtures'
import type { UUID } from '@odyssey/schemas'

export interface JourneySummary {
  id: UUID
  scope: 'my-journeys' | 'community-journeys'
  name: string
  description: string
  status: 'active' | 'draft' | 'paused'
  agentCount: number
  executionCount: number
  updatedLabel: string
}

export function createJourneySummaries(): JourneySummary[] {
  const fixture = createJourneyEditorDocumentFixture()
  return [{
    id: fixture.journey.id,
    scope: 'my-journeys',
    name: fixture.journey.name,
    description: fixture.journey.description ?? 'Configure agents and execution flow.',
    status: fixture.journey.status === 'draft' ? 'draft' : 'active',
    agentCount: fixture.agents.length,
    executionCount: 0,
    updatedLabel: 'M2 fixture',
  }]
}
