import { describe, expect, it } from 'vitest'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import { projectWorkflowCanvas } from '@/canvas/workflow/workflowCanvasAdapter'
import { createWorkflowPreviewViewModel } from './workflowPreviewAdapter'

describe('workflowPreviewAdapter', () => {
  it.each(['minimal', 'research', 'loop'] as const)('reuses Configure geometry and routing for %s without changing input', (kind) => {
    const document = createAgentWorkflowEditorDocumentFixture(kind)
    const before = structuredClone(document)
    const canvas = projectWorkflowCanvas(document.workflow, document.layout, 'configure')
    const preview = createWorkflowPreviewViewModel(document)
    expect(preview.nodes.map(({ id, position, parentNode, style, data }) => ({ id, position, parentNode, style, data })))
      .toEqual(canvas.nodes.map(({ id, position, parentNode, style, data }) => ({ id, position, parentNode, style, data })))
    expect(preview.edges.map(({ id, source, target, sourceHandle, type }) => ({ id, source, target, sourceHandle, type })))
      .toEqual(canvas.edges.map(({ id, source, target, sourceHandle, type }) => ({ id, source, target, sourceHandle, type })))
    expect(document).toEqual(before)
  })

  it('disables every node and edge mutation capability', () => {
    const model = createWorkflowPreviewViewModel(createAgentWorkflowEditorDocumentFixture('research'))
    expect(model.nodes.length).toBeGreaterThan(0)
    expect(model.edges.length).toBeGreaterThan(0)
    for (const node of model.nodes) {
      expect([node.draggable, node.selectable, node.connectable, node.deletable, node.focusable]).toEqual([false, false, false, false, false])
    }
    for (const edge of model.edges) {
      expect([edge.selectable, edge.deletable, edge.updatable, edge.focusable]).toEqual([false, false, false, false])
    }
  })

  it('uses Canvas fallback placement and reports it instead of dropping a node', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    document.layout.nodePlacements = []
    const model = createWorkflowPreviewViewModel(document)
    expect(model.nodes).toHaveLength(2)
    expect(model.edges).toHaveLength(1)
    expect(model.diagnostics).toHaveLength(2)
    expect(model.nodes.every(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y))).toBe(true)
  })

  it('preserves negative coordinates and safely projects an empty workflow', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    document.layout.nodePlacements = document.layout.nodePlacements.map((p) => ({ ...p, x: p.x - 1000, y: p.y - 1000 }))
    expect(createWorkflowPreviewViewModel(document).nodes[0]?.position.x).toBeLessThan(0)
    document.workflow.nodes = []
    document.workflow.edges = []
    document.layout.nodePlacements = []
    expect(createWorkflowPreviewViewModel(document).nodes).toEqual([])
  })
})
