import type { KnowledgeSpaceSummary } from '@odyssey/schemas'

export function isKnowledgeSpaceReferenceable(space: KnowledgeSpaceSummary): boolean {
  return (space.lifecycleStatus === 'ready' || space.lifecycleStatus === 'syncing')
    && (space.graphStatus === 'healthy' || space.graphStatus === 'needs_review')
}
