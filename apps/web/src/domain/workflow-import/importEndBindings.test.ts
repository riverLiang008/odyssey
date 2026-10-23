import { describe, expect, it } from 'vitest'
import { uuidSchema, type EndNode } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures/editorFixtures'
import { bindImportedEnds } from './importEndBindings'
import { createWorkflowExport } from './workflowImport'

describe('portable End mapping', () => {
  it('reuses the destination-owned sole boundary and maps its incoming paths', () => {
    const source = createAgentWorkflowEditorDocumentFixture('minimal')
    const current = createAgentWorkflowEditorDocumentFixture('minimal')
    const end = current.workflow.nodes.find((node) => node.type === 'end')!
    const originalId = end.id
    end.id = uuidSchema.parse('10000000-0000-4000-8000-000000000333')
    current.workflow.edges.forEach((edge) => { if (edge.targetNodeId === originalId) edge.targetNodeId = end.id })
    current.layout.nodePlacements.forEach((item) => { if (item.nodeId === originalId) item.nodeId = end.id })
    const exported = createWorkflowExport(source, '2026-10-22T00:00:00Z').document
    const result = bindImportedEnds(exported, current)
    expect(result?.workflow.nodes.find((node) => node.type === 'end')?.id).toBe(end.id)
    expect(result?.workflow.edges[0]?.targetNodeId).toBe(end.id)
    expect(exported.workflow.nodes.find((node) => node.type === 'end')?.id).toBe(originalId)
  })

  it('requires explicit choice among multiple destinations and keeps other exits unconnected', () => {
    const source = createAgentWorkflowEditorDocumentFixture('minimal')
    const current = createAgentWorkflowEditorDocumentFixture('minimal')
    const end = current.workflow.nodes.find((node): node is EndNode => node.type === 'end')!
    const extra = { ...structuredClone(end), id: uuidSchema.parse('10000000-0000-4000-8000-000000000334') }
    current.workflow.nodes.push(extra)
    const exported = createWorkflowExport(source, '2026-10-22T00:00:00Z').document
    expect(bindImportedEnds(exported, current)).toBeNull()
    const result = bindImportedEnds(exported, current, [{ sourceEndId: end.id, targetEndId: extra.id }])
    expect(result?.workflow.edges[0]?.targetNodeId).toBe(extra.id)
    expect(result?.workflow.nodes.filter((node) => node.type === 'end')).toHaveLength(2)
  })

  it('does not export Journey-bound routing configuration', () => {
    const source = createAgentWorkflowEditorDocumentFixture('minimal')
    const end = source.workflow.nodes.find((node) => node.type === 'end')!
    source.workflow.schemaVersion = '1.1.0'
    end.config.binding = { sourceSlotId: source.agent.id, target: { type: 'journey_end' } }
    const exported = createWorkflowExport(source, '2026-10-22T00:00:00Z')
    expect(exported.document.workflow.nodes.find((node) => node.type === 'end')?.config).toEqual({})
    expect(end.config.binding).toBeDefined()
  })
})
