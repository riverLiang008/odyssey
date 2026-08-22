import { describe, expect, it } from 'vitest'

import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import { createWorkflowPreviewViewModel } from './workflowPreviewAdapter'

describe('workflowPreviewAdapter', () => {
  it('fits a minimum Workflow into bounds and anchors its edge to node borders', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const before = structuredClone(document)
    const model = createWorkflowPreviewViewModel(document, { width: 320, height: 160, padding: 20 })

    expect(model.nodes).toHaveLength(2)
    expect(model.edges).toHaveLength(1)
    expect(model.nodes.every((node) => node.position.x >= 20 && node.position.x <= 300)).toBe(true)
    expect(model.edges[0]?.source.x).toBeGreaterThan(model.nodes[0]!.position.x)
    expect(model.edges[0]?.target.x).toBeLessThan(model.nodes[1]!.position.x)
    expect(document).toEqual(before)
  })

  it('preserves topology identity while scaling uniformly for another bounds', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const small = createWorkflowPreviewViewModel(document, { width: 300, height: 150, padding: 20 })
    const wide = createWorkflowPreviewViewModel(document, { width: 600, height: 300, padding: 20 })

    expect(wide.nodes.map((node) => node.id)).toEqual(small.nodes.map((node) => node.id))
    expect(wide.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId]))
      .toEqual(small.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId]))
    expect(wide.nodes.at(-1)!.position.x - wide.nodes[0]!.position.x)
      .toBeGreaterThan(small.nodes.at(-1)!.position.x - small.nodes[0]!.position.x)
  })

  it('centers zero-extent layouts without division by zero', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    document.layout.nodePlacements = document.layout.nodePlacements.map((placement) => ({ ...placement, x: 0, y: 0 }))
    const model = createWorkflowPreviewViewModel(document)

    expect(model.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
  })

  it('reports missing placements and skips edges whose visible endpoint is absent', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const missingNodeId = document.workflow.nodes[1]!.id
    document.layout.nodePlacements = document.layout.nodePlacements.filter((placement) => placement.nodeId !== missingNodeId)
    const model = createWorkflowPreviewViewModel(document)

    expect(model.nodes).toHaveLength(1)
    expect(model.edges).toHaveLength(0)
    expect(model.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'NODE_PLACEMENT_MISSING', 'EDGE_ENDPOINT_MISSING',
    ])
  })
})
