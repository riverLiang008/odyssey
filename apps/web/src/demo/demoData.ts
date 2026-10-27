import { journeySummarySchema, knowledgeSpaceSummarySchema } from '@odyssey/schemas'
import source from './data/snapshot.json'
import { parseDemoSnapshot } from './snapshotSchema'
export const demoSnapshot = parseDemoSnapshot(source)
export const demoJourneys = demoSnapshot.journeys
export const demoAgents = demoSnapshot.agents
export const demoSystemTools = demoSnapshot.systemTools
export const demoKnowledgeSnapshots = demoSnapshot.knowledgeSpaces
export const demoJourneySummaries = demoJourneys.map(({ journey, pattern, agents }) => journeySummarySchema.parse({
  id:journey.id,name:journey.name,description:journey.description,status:journey.status,
  revision:journey.revision,createdAt:journey.createdAt,updatedAt:journey.updatedAt,
  patternKind: pattern.kind, agentCount: agents.length,
}))
export const demoKnowledgeSummaries = demoKnowledgeSnapshots.map(({ detail }) => knowledgeSpaceSummarySchema.parse({
  id:detail.id,name:detail.name,description:detail.description,category:detail.category,
  lifecycleStatus:detail.lifecycleStatus,graphStatus:detail.graphStatus,fileCount:detail.fileCount,
  knowledgeFamilyCount:detail.knowledgeFamilyCount,openIssueCount:detail.openIssueCount,
  createdAt:detail.createdAt,updatedAt:detail.updatedAt,
}))
export const demoResourceInspections = demoKnowledgeSnapshots.flatMap(space => space.resources)
export const demoDocuments = demoResourceInspections
const firstSpace = demoKnowledgeSnapshots[0]
if (!firstSpace) throw new Error('Selected demo cases have no Knowledge Space')
export const demoKnowledgeSpace = firstSpace.detail
export const demoKnowledgeSummary = demoKnowledgeSummaries[0]
export const demoFileTree = firstSpace.tree
export const demoGraph = firstSpace.graph
