import type { BranchNode, UUID, WorkflowEdge } from '@odyssey/schemas'
import type { BranchDraft } from '@/domain/workflow/branchDrafts'

/** UI-only, owned by this editor view and never serialized with the document. */
export interface BranchPanelSession {
  baseline: BranchNode
  baselineEdges: WorkflowEdge[]
  draft: BranchDraft
  initial: string
  confirmed: UUID[]
}
