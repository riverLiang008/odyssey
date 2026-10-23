import { describe, expect, it } from 'vitest'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import { applyBranchEdit } from '@/domain/workflow/branchCommands'
import { projectWorkflowCanvas } from './workflowCanvasAdapter'
describe('Branch canvas adapter round trip', () => {
  it('keeps Case UUID handles and connections while renaming without changing persisted layout', () => {
    const d = createAgentWorkflowEditorDocumentFixture('research'), before = structuredClone(d)
    const n = d.workflow.nodes.find(n => n.type === 'branch')
    if (!n || n.type !== 'branch') throw new Error('Expected Branch')
    const projected = projectWorkflowCanvas(d.workflow, d.layout, 'configure').nodes.find(c => c.id === n.id)
    expect(projected?.data?.branchConnectedHandles).toEqual(d.workflow.edges.filter(e => e.sourceNodeId === n.id).map(e => e.sourceHandleId))
    const next = applyBranchEdit(d.workflow, { kind: 'agent-workflow' }, { baseline: n, node: { ...n, name: 'Renamed' }, baselineEdges: d.workflow.edges.filter(e => e.sourceNodeId === n.id), confirmedRemovedCaseIds: [] }, d.variables)
    if (!next.ok) throw new Error('Expected valid edit')
    const after = projectWorkflowCanvas(next.value, d.layout, 'configure')
    expect(after.nodes.find(c => c.id === n.id)?.data?.branchHandles).toEqual(projected?.data?.branchHandles)
    expect(after.edges).toEqual(projectWorkflowCanvas(d.workflow, d.layout, 'configure').edges)
    expect(d).toEqual(before)
    expect(next.value.nodes.find(node => node.id === n.id)).not.toHaveProperty('branchConnectedHandles')
  })
})
