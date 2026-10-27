import type { RepositoryResult } from '@odyssey/schemas'
import type { OdysseyEditorRepository } from '@/repositories/editorRepository'
import { demoAgents, demoJourneys, demoJourneySummaries, demoKnowledgeSnapshots, demoKnowledgeSummaries, demoSystemTools } from './demoData'

const result = <T>(value: T | undefined): RepositoryResult<T> => value === undefined
  ? { ok: false, error: { code: 'NOT_FOUND' } }
  : { ok: true, value: structuredClone(value) }
const denied = async () => ({ ok: false as const, error: { code: 'VALIDATION_FAILED' as const, issues: [{ path: [], code: 'DEMO_READ_ONLY' }] } })

/** Explicit read-only port. No HTTP, localStorage, or simulated successful writes. */
export function createDemoRepository(): OdysseyEditorRepository {
  return {
    readOnly: true,
    async listJourneys() { return result(demoJourneySummaries) },
    async loadJourney(journeyId) { return result(demoJourneys.find(document => document.journey.id === journeyId)) },
    async loadAgentWorkflow(journeyId, agentId) { return result(demoAgents.find(document => document.agent.id === agentId && document.agent.journeyId === journeyId)) },
    async listAgentTemplates() { return result([]) },
    async loadAgentTemplate() { return { ok: false, error: { code: 'NOT_FOUND' } } },
    async listSystemToolDefinitions() { return result(demoSystemTools) },
    async listKnowledgeSpaceCategories() { return result([...new Map(demoKnowledgeSnapshots.map(space => [space.detail.category.id, space.detail.category])).values()]) },
    async loadKnowledgeSpace(spaceId) { return result(demoKnowledgeSnapshots.find(space => space.detail.id === spaceId)?.detail) },
    async listKnowledgeSpaces(input = {}) {
      const items = demoKnowledgeSummaries.filter(space => space.name.toLowerCase().includes(input.query?.toLowerCase() ?? ''))
      const page = input.page ?? 1, pageSize = input.pageSize ?? 20
      return result({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length })
    },
    async loadKnowledgeFileTree(spaceId) { return result(demoKnowledgeSnapshots.find(space => space.detail.id === spaceId)?.tree) },
    async loadKnowledgeGraph(spaceId) { return result(demoKnowledgeSnapshots.find(space => space.detail.id === spaceId)?.graph) },
    async loadKnowledgeResource(spaceId, resourceId) { return result(demoKnowledgeSnapshots.find(space => space.detail.id === spaceId)?.resources.find(item => item.detail.id === resourceId)) },
    createJourney: denied, deleteJourney: denied, saveJourney: denied, saveAgentWorkflow: denied,
    createJourneyAgent: denied, saveAgentAsTemplate: denied, instantiateAgentTemplate: denied, removeOccupiedSlot: denied,
    addGuardrail: denied, removeGuardrail: denied, createKnowledgeSpaceCategory: denied, createKnowledgeSpace: denied,
    updateKnowledgeSpace: denied, archiveKnowledgeSpace: denied, unarchiveKnowledgeSpace: denied, deleteKnowledgeSpace: denied,
    validateKnowledgeGraphManifest: denied, applyKnowledgeGraphManifest: denied, createKnowledgeFolder: denied,
    moveKnowledgeResource: denied, deleteKnowledgeResource: denied, updateKnowledgeResourceContent: denied, uploadKnowledgeFile: denied,
  }
}
