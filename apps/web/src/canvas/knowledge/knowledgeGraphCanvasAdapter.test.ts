import { describe, expect, it } from 'vitest'
import { uuidSchema, type KnowledgeGraphOverview } from '@odyssey/schemas'
import { projectKnowledgeGraphCanvas } from './knowledgeGraphCanvasAdapter'

const uuid = (value: string) => uuidSchema.parse(value)
const graph: KnowledgeGraphOverview = {
  knowledgeSpaceId: uuid('00000000-0000-4000-8000-000000000001'),
  status: 'needs_review',
  generatedAt: '2026-10-23T00:00:00Z',
  nodes: [
    { id: uuid('00000000-0000-4000-8000-000000000002'), name: 'Start here', status: 'indexed', summary: 'Summary', guide: null, tags: [], issueIds: [uuid('00000000-0000-4000-8000-000000000021')] },
    { id: uuid('00000000-0000-4000-8000-000000000003'), name: 'Next', status: 'indexed', summary: null, guide: null, tags: [], issueIds: [] },
  ],
  edges: [{ id: uuid('00000000-0000-4000-8000-000000000011'), sourceResourceId: uuid('00000000-0000-4000-8000-000000000002'), targetResourceId: uuid('00000000-0000-4000-8000-000000000003'), kind: 'builds_on', status: 'needs_review', confidence: 0.7, description: null }],
  families: [{ id: uuid('00000000-0000-4000-8000-000000000031'), name: 'Basics', colorToken: null, resourceIds: [uuid('00000000-0000-4000-8000-000000000002')] }],
  issues: [{ id: uuid('00000000-0000-4000-8000-000000000021'), kind: 'missing_metadata', severity: 'warning', resolutionStatus: 'open', title: 'Missing guide', message: null, resourceIds: [uuid('00000000-0000-4000-8000-000000000002')], relationIds: [] }],
}

describe('projectKnowledgeGraphCanvas', () => {
  it('creates immutable read-only view nodes and edges with graph metadata', () => {
    const result = projectKnowledgeGraphCanvas(graph)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.nodes.at(0)).toMatchObject({ draggable: false, connectable: false, deletable: false })
    expect(result.nodes.find(node => node.id.endsWith('2'))?.data?.families[0]?.name).toBe('Basics')
    expect(result.nodes.find(node => node.id.endsWith('2'))?.data?.issues[0]?.title).toBe('Missing guide')
    expect(result.edges[0]?.selectable).toBe(false)
    expect(result.edges[0]?.updatable).toBe(false)
    expect(result.edges[0]?.deletable).toBe(false)
    expect(result.edges[0]?.label).toBe('builds on')
  })

  it('uses curved edges inside a cyclic component and stepped edges between ranks', () => {
    const cyclicGraph: KnowledgeGraphOverview = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: uuid('00000000-0000-4000-8000-000000000012'),
          sourceResourceId: uuid('00000000-0000-4000-8000-000000000003'),
          targetResourceId: uuid('00000000-0000-4000-8000-000000000002'),
          kind: 'references',
          status: 'active',
          confidence: null,
          description: null,
        },
      ],
    }
    expect(projectKnowledgeGraphCanvas(cyclicGraph).edges.map(edge => edge.type)).toEqual(['default', 'default'])
    expect(projectKnowledgeGraphCanvas(graph).edges[0]?.type).toBe('smoothstep')
  })
})
