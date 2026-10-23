import { branchNodeSchema, type AgentVariable, type LoopBodyGraph, type WorkflowGraph } from '@odyssey/schemas'
import type { BranchEditIntent } from './branchDrafts'
import { branchDraftFromNode, branchSnapshot, parseBranchDraft } from './branchDrafts'
import type { WorkflowGraphContext, WorkflowCommandResult } from './workflowErrors'
import { validateWorkflowGraph } from './workflowValidation'

/** Commit Branch fields and removal of owned outgoing edges atomically. */
export function applyBranchEdit<T extends WorkflowGraph | LoopBodyGraph>(graph: T, context: WorkflowGraphContext, intent: BranchEditIntent, variables: readonly AgentVariable[]): WorkflowCommandResult<T> {
  const invalid = (): WorkflowCommandResult<T> => ({ ok: false, error: { code: 'INVALID_NODE_CONFIG', nodeId: intent.node.id } })
  const current = graph.nodes.find(n => n.id === intent.node.id)
  if (!current || current.type !== 'branch') return { ok: false, error: { code: 'NODE_NOT_FOUND', nodeId: intent.node.id } }
  const originalValidation = validateWorkflowGraph(graph, context)
  if (!originalValidation.isStructurallyValid) return { ok: false, error: { code: 'INVALID_SOURCE_GRAPH', issues: originalValidation.structuralErrors } }
  if (branchSnapshot(current) !== branchSnapshot(intent.baseline) || branchSnapshot(graph.edges.filter(e => e.sourceNodeId === current.id)) !== branchSnapshot(intent.baselineEdges)) return invalid()
  const parsed = branchNodeSchema.safeParse(intent.node)
  if (!parsed.success || parsed.data.config.defaultCase.id !== current.config.defaultCase.id || !parseBranchDraft(branchDraftFromNode(parsed.data), variables).ok) return invalid()
  const removed = current.config.cases.filter(c => !parsed.data.config.cases.some(next => next.id === c.id))
  if (removed.some(c => !intent.confirmedRemovedCaseIds.includes(c.id))) return invalid()
  const candidate = structuredClone(graph)
  candidate.nodes.splice(candidate.nodes.findIndex(n => n.id === current.id), 1, parsed.data)
  const removedIds = new Set(removed.map(c => c.id))
  candidate.edges = candidate.edges.filter(e => !(e.sourceNodeId === current.id && e.sourceHandleId && removedIds.has(e.sourceHandleId)))
  const validation = validateWorkflowGraph(candidate, context)
  return validation.isStructurallyValid ? { ok: true, value: candidate, validation } : invalid()
}
