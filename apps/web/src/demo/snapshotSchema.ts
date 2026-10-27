import {
  agentWorkflowEditorDocumentSchema, journeyEditorDocumentSchema, knowledgeSpaceDetailSchema,
  knowledgeFileTreeSchema, knowledgeGraphOverviewSchema, knowledgeResourceDetailSchema,
  systemToolDefinitionListSchema, utcTimestampSchema,
  type AgentWorkflowEditorDocument, type JourneyEditorDocument, type KnowledgeSpaceDetail,
  type KnowledgeFileTree, type KnowledgeGraphOverview, type SystemToolDefinition,
} from '@odyssey/schemas'
import type { KnowledgeResourceInspection } from '@/repositories/editorRepository'

export interface DemoKnowledgeSnapshot {
  detail: KnowledgeSpaceDetail
  tree: KnowledgeFileTree
  graph: KnowledgeGraphOverview
  resources: KnowledgeResourceInspection[]
}
export interface DemoSnapshot {
  formatVersion: 1
  capturedAt: string
  journeys: JourneyEditorDocument[]
  agents: AgentWorkflowEditorDocument[]
  knowledgeSpaces: DemoKnowledgeSnapshot[]
  systemTools: SystemToolDefinition[]
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid demo snapshot object')
  return value as Record<string, unknown> // Runtime object boundary; every field is validated below.
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid demo snapshot collection')
  return value
}
export function parseDemoSnapshot(input: unknown): DemoSnapshot {
  const source = record(input)
  if (source.formatVersion !== 1) throw new Error('Unsupported demo snapshot version')
  const snapshot: DemoSnapshot = {
    formatVersion: 1, capturedAt: utcTimestampSchema.parse(source.capturedAt),
    journeys: array(source.journeys).map(value=>journeyEditorDocumentSchema.parse(value)),
    agents: array(source.agents).map(value=>agentWorkflowEditorDocumentSchema.parse(value)),
    systemTools: systemToolDefinitionListSchema.parse(source.systemTools),
    knowledgeSpaces: array(source.knowledgeSpaces).map(value=>{
      const row=record(value)
      return {
        detail:knowledgeSpaceDetailSchema.parse(row.detail), tree:knowledgeFileTreeSchema.parse(row.tree),
        graph:knowledgeGraphOverviewSchema.parse(row.graph),
        resources:array(row.resources).map(value=>{
          const resource=record(value),preview=record(resource.preview)
          if (preview.type !== 'external' && (preview.type !== 'text' || typeof preview.content !== 'string' || typeof preview.truncated !== 'boolean')) throw new Error('Invalid static resource preview')
          return {detail:knowledgeResourceDetailSchema.parse(resource.detail),preview:preview.type==='external'?{type:'external' as const}:{type:'text' as const,content:String(preview.content),truncated:preview.truncated===true}}
        }),
      }
    }),
  }
  for(const journey of snapshot.journeys) for(const summary of journey.agents) {
    if(!snapshot.agents.some(agent=>agent.agent.id===summary.id&&agent.agent.journeyId===journey.journey.id)) throw new Error('Demo Agent reference is missing')
  }
  for(const space of snapshot.knowledgeSpaces) {
    if(space.tree.knowledgeSpaceId!==space.detail.id||space.graph.knowledgeSpaceId!==space.detail.id) throw new Error('Demo Knowledge Space ownership mismatch')
    for(const resource of space.tree.resources) if(!space.resources.some(item=>item.detail.id===resource.id&&item.detail.knowledgeSpaceId===space.detail.id)) throw new Error('Demo resource is missing')
  }
  return snapshot
}
