import { describe, expect, it } from 'vitest'
import { uuidSchema, type KnowledgeGraphOverview, type UUID } from '@odyssey/schemas'
import { layoutKnowledgeGraph } from './knowledgeGraphLayout'

const uuid = (value: string): UUID => uuidSchema.parse(value)
const ids = {
  space: uuid('00000000-0000-4000-8000-000000000001'),
  alpha: uuid('00000000-0000-4000-8000-000000000002'),
  beta: uuid('00000000-0000-4000-8000-000000000003'),
  gamma: uuid('00000000-0000-4000-8000-000000000004'),
  delta: uuid('00000000-0000-4000-8000-000000000005'),
  edgeOne: uuid('00000000-0000-4000-8000-000000000011'),
  edgeTwo: uuid('00000000-0000-4000-8000-000000000012'),
  edgeThree: uuid('00000000-0000-4000-8000-000000000013'),
}

function graph(nodeIds: readonly UUID[], edges: readonly [UUID, UUID, UUID][]): KnowledgeGraphOverview {
  return {
    knowledgeSpaceId: ids.space,
    status: 'healthy',
    generatedAt: '2026-10-23T00:00:00Z',
    nodes: nodeIds.map((id, index) => ({ id, name: `Document ${String.fromCharCode(65 + index)}`, status: 'indexed', summary: null, guide: null, tags: [], issueIds: [] })),
    edges: edges.map(([id, sourceResourceId, targetResourceId]) => ({ id, sourceResourceId, targetResourceId, kind: 'references', status: 'active', confidence: null, description: null })),
    families: [],
    issues: [],
  }
}

describe('layoutKnowledgeGraph', () => {
  it('places a directed chain in increasing ranks', () => {
    const result = layoutKnowledgeGraph(graph(
      [ids.alpha, ids.beta, ids.gamma],
      [[ids.edgeOne, ids.alpha, ids.beta], [ids.edgeTwo, ids.beta, ids.gamma]],
    ))
    const byId = new Map(result.placements.map(placement => [placement.nodeId, placement]))
    expect(byId.get(ids.alpha)?.rank).toBe(0)
    expect(byId.get(ids.beta)?.rank).toBe(1)
    expect(byId.get(ids.gamma)?.rank).toBe(2)
    expect(result.diagnostics).toEqual([])
  })

  it('collapses cycles into one layout component', () => {
    const result = layoutKnowledgeGraph(graph(
      [ids.alpha, ids.beta, ids.gamma],
      [[ids.edgeOne, ids.alpha, ids.beta], [ids.edgeTwo, ids.beta, ids.alpha], [ids.edgeThree, ids.beta, ids.gamma]],
    ))
    const alpha = result.placements.find(placement => placement.nodeId === ids.alpha)
    const beta = result.placements.find(placement => placement.nodeId === ids.beta)
    const gamma = result.placements.find(placement => placement.nodeId === ids.gamma)
    expect(alpha?.componentId).toBe(beta?.componentId)
    expect(alpha?.rank).toBe(0)
    expect(gamma?.rank).toBe(1)
  })

  it('gives every member of a cyclic component a non-overlapping card slot', () => {
    const result = layoutKnowledgeGraph(graph(
      [ids.alpha, ids.beta, ids.gamma, ids.delta],
      [
        [ids.edgeOne, ids.alpha, ids.beta],
        [ids.edgeTwo, ids.beta, ids.gamma],
        [ids.edgeThree, ids.gamma, ids.alpha],
      ],
    ))
    const cyclic = result.placements.filter(placement => placement.nodeId !== ids.delta)
    const rectangles = cyclic.map(placement => ({
      left: placement.x,
      right: placement.x + 224,
      top: placement.y,
      bottom: placement.y + 140,
    }))

    rectangles.forEach((rectangle, index) => {
      rectangles.slice(index + 1).forEach((other) => {
        const overlaps = rectangle.left < other.right
          && rectangle.right > other.left
          && rectangle.top < other.bottom
          && rectangle.bottom > other.top
        expect(overlaps).toBe(false)
      })
    })
  })

  it('advances the next rank past the full width of an expanded cyclic component', () => {
    const result = layoutKnowledgeGraph(graph(
      [ids.alpha, ids.beta, ids.gamma, ids.delta],
      [
        [ids.edgeOne, ids.alpha, ids.beta],
        [ids.edgeTwo, ids.beta, ids.alpha],
        [ids.edgeThree, ids.beta, ids.gamma],
      ],
    ))
    const cycleRight = Math.max(
      ...result.placements
        .filter(placement => placement.nodeId === ids.alpha || placement.nodeId === ids.beta)
        .map(placement => placement.x + 224),
    )
    const nextRank = result.placements.find(placement => placement.nodeId === ids.gamma)
    expect(nextRank?.x).toBeGreaterThan(cycleRight)
  })

  it('is deterministic when API array order changes', () => {
    const source = graph(
      [ids.alpha, ids.beta, ids.gamma],
      [[ids.edgeOne, ids.alpha, ids.beta], [ids.edgeTwo, ids.alpha, ids.gamma]],
    )
    const shuffled = { ...source, nodes: [...source.nodes].reverse(), edges: [...source.edges].reverse() }
    expect(layoutKnowledgeGraph(shuffled).placements).toEqual(layoutKnowledgeGraph(source).placements)
  })

  it('places isolated documents after connected ranks', () => {
    const result = layoutKnowledgeGraph(graph(
      [ids.alpha, ids.beta, ids.delta],
      [[ids.edgeOne, ids.alpha, ids.beta]],
    ))
    const connectedMax = Math.max(...result.placements.filter(placement => placement.nodeId !== ids.delta).map(placement => placement.rank))
    const isolated = result.placements.find(placement => placement.nodeId === ids.delta)
    expect(isolated?.rank).toBeGreaterThan(connectedMax)
  })

  it('reports relations whose endpoints are not present', () => {
    const result = layoutKnowledgeGraph(graph(
      [ids.alpha],
      [[ids.edgeOne, ids.alpha, ids.beta]],
    ))
    expect(result.diagnostics).toEqual([{ code: 'MISSING_EDGE_ENDPOINT', edgeId: ids.edgeOne }])
  })
})
