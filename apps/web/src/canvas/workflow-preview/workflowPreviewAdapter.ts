import type { AgentWorkflowEditorDocument, JourneyEditorDocument } from '@odyssey/schemas'
import { projectWorkflowCanvas } from '@/canvas/workflow/workflowCanvasAdapter'

/** Adapter-only projection: never save Vue Flow nodes back to the document. */
export function createWorkflowPreviewViewModel(
  document: Readonly<AgentWorkflowEditorDocument>,
  journey?: JourneyEditorDocument,
) {
  const projection = projectWorkflowCanvas(document.workflow, document.layout, 'configure', journey)
  return {
    agentId: document.agent.id,
    agentName: document.agent.name,
    branchVariables: structuredClone(document.variables),
    nodes: projection.nodes.map((node) => ({
      ...node,
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      focusable: false,
    })),
    edges: projection.edges.map((edge) => ({
      ...edge,
      selectable: false,
      deletable: false,
      updatable: false,
      focusable: false,
    })),
    diagnostics: projection.diagnostics,
  }
}
export type WorkflowPreviewViewModel = ReturnType<typeof createWorkflowPreviewViewModel>
