import { describe, expect, it } from 'vitest'
import { knowledgeGraphOverviewSchema } from '@odyssey/schemas'
import { filterKnowledgeGraphByFamily } from './knowledgeGraphFilter'

const graph = knowledgeGraphOverviewSchema.parse({
  knowledgeSpaceId: '00000000-0000-4000-8000-000000000001',
  status: 'healthy',
  generatedAt: '2026-10-23T00:00:00Z',
  nodes: [
    { id: '00000000-0000-4000-8000-000000000002', name: 'A', status: 'indexed', summary: null, guide: null, tags: [], issueIds: [] },
    { id: '00000000-0000-4000-8000-000000000003', name: 'B', status: 'indexed', summary: null, guide: null, tags: [], issueIds: [] },
    { id: '00000000-0000-4000-8000-000000000004', name: 'C', status: 'indexed', summary: null, guide: null, tags: [], issueIds: [] },
  ],
  edges: [
    { id: '00000000-0000-4000-8000-000000000011', sourceResourceId: '00000000-0000-4000-8000-000000000002', targetResourceId: '00000000-0000-4000-8000-000000000003', kind: 'references', status: 'active', confidence: null, description: null },
    { id: '00000000-0000-4000-8000-000000000012', sourceResourceId: '00000000-0000-4000-8000-000000000003', targetResourceId: '00000000-0000-4000-8000-000000000004', kind: 'references', status: 'active', confidence: null, description: null },
  ],
  families: [{ id: '00000000-0000-4000-8000-000000000021', name: 'Selected', colorToken: null, resourceIds: ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'] }],
  issues: [
    { id: '00000000-0000-4000-8000-000000000031', kind: 'missing_metadata', severity: 'warning', resolutionStatus: 'open', title: 'Visible', message: null, resourceIds: ['00000000-0000-4000-8000-000000000002'], relationIds: [] },
    { id: '00000000-0000-4000-8000-000000000032', kind: 'missing_metadata', severity: 'warning', resolutionStatus: 'open', title: 'Hidden', message: null, resourceIds: ['00000000-0000-4000-8000-000000000004'], relationIds: [] },
  ],
})

describe('filterKnowledgeGraphByFamily', () => {
  it('keeps only member nodes, internal edges, and relevant issues', () => {
    const result = filterKnowledgeGraphByFamily(graph, graph.families[0]?.id ?? null)
    expect(result.nodes.map(node => node.name)).toEqual(['A', 'B'])
    expect(result.edges.map(edge => edge.id)).toEqual(['00000000-0000-4000-8000-000000000011'])
    expect(result.issues.map(issue => issue.title)).toEqual(['Visible'])
  })

  it('returns the original graph for all families', () => {
    expect(filterKnowledgeGraphByFamily(graph, null)).toBe(graph)
  })
})
