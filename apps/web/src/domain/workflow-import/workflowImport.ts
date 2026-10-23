import {
  agentWorkflowExportSchema,
  createAgentWorkflowEditorDocumentSchema,
  type AgentWorkflowEditorDocument,
  type AgentWorkflowExport,
  type AgentWorkflowExportDocument,
  type LoopBodyNode,
  type UUID,
  type WorkflowNode,
} from '@odyssey/schemas'

import { validateWorkflowGraph } from '@/domain/workflow'

export type WorkflowImportErrorCode =
  | 'JSON_INVALID'
  | 'EXPORT_SCHEMA_INVALID'
  | 'WORKFLOW_INVALID'
  | 'REFERENCE_MISSING'

export interface WorkflowImportIssue {
  readonly path: readonly (string | number)[]
  readonly code: string
}

export interface WorkflowImportSummary {
  readonly sourceAgentName: string
  readonly exportedAt: string
  readonly rootNodeCount: number
  readonly rootEdgeCount: number
  readonly loopCount: number
  readonly variableCount: number
  readonly reusableToolCount: number
  readonly knowledgeSpaceCount: number
}

export type WorkflowImportResult =
  | { readonly ok: true; readonly value: AgentWorkflowExport; readonly summary: WorkflowImportSummary }
  | { readonly ok: false; readonly error: { readonly code: WorkflowImportErrorCode; readonly issues: readonly WorkflowImportIssue[] } }

export interface WorkflowImportValidationContext {
  readonly availableKnowledgeSpaceIds: ReadonlySet<string>
  readonly systemVariableIds?: readonly UUID[]
}

type ImportNode = WorkflowNode | LoopBodyNode

function collectKnowledgeSpaceIds(document: AgentWorkflowExportDocument): Set<string> {
  const ids = new Set<string>()
  const visitNodes = (nodes: readonly ImportNode[]) => {
    nodes.forEach((node) => {
      if (node.type === 'agent_action') node.config.knowledgeSpaceIds.forEach((id) => ids.add(id))
      if (node.type === 'task') node.config.steps.forEach((step) => {
        if (step.kind === 'knowledge_retrieval') ids.add(step.configuration.knowledgeSpaceId)
      })
      if (node.type === 'loop') visitNodes(node.config.body.graph.nodes)
    })
  }
  visitNodes(document.workflow.nodes)
  document.reusableTools.forEach((tool) => {
    if (tool.kind === 'knowledge_retrieval') ids.add(tool.configuration.knowledgeSpaceId)
  })
  return ids
}

function countLoops(nodes: readonly ImportNode[]): number {
  return nodes.reduce((count, node) => node.type === 'loop'
    ? count + 1 + countLoops(node.config.body.graph.nodes)
    : count, 0)
}

export function summarizeWorkflowImport(value: AgentWorkflowExport): WorkflowImportSummary {
  return {
    sourceAgentName: value.source.agentName,
    exportedAt: value.exportedAt,
    rootNodeCount: value.document.workflow.nodes.length,
    rootEdgeCount: value.document.workflow.edges.length,
    loopCount: countLoops(value.document.workflow.nodes),
    variableCount: value.document.variables.length,
    reusableToolCount: value.document.reusableTools.length,
    knowledgeSpaceCount: collectKnowledgeSpaceIds(value.document).size,
  }
}

function schemaIssues(issues: readonly { path: readonly PropertyKey[]; code: string }[]): WorkflowImportIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map((segment) => typeof segment === 'number' ? segment : String(segment)),
    code: issue.code,
  }))
}

export function createWorkflowExport(
  document: AgentWorkflowEditorDocument,
  exportedAt: string,
): AgentWorkflowExport {
  const portableWorkflow = structuredClone(document.workflow)
  portableWorkflow.nodes.forEach((node) => { if (node.type === 'end') node.config = {} })
  return agentWorkflowExportSchema.parse({
    kind: 'odyssey.agent-workflow',
    formatVersion: 1,
    exportedAt,
    source: {
      journeyId: document.agent.journeyId,
      agentId: document.agent.id,
      agentName: document.agent.name,
    },
    document: {
      workflow: portableWorkflow,
      layout: structuredClone(document.layout),
      variables: structuredClone(document.variables),
      reusableTools: structuredClone(document.reusableTools),
    },
  })
}

export function serializeWorkflowExport(value: AgentWorkflowExport): string {
  return `${JSON.stringify(agentWorkflowExportSchema.parse(value), null, 2)}\n`
}

export function workflowExportFileName(agentName: string, date: string): string {
  const safeName = agentName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'agent'
  return `odyssey-workflow-${safeName}-${date}.json`
}

export function parseWorkflowImportJson(
  source: string,
  context: WorkflowImportValidationContext,
): WorkflowImportResult {
  let candidate: unknown
  try {
    candidate = JSON.parse(source)
  } catch {
    return { ok: false, error: { code: 'JSON_INVALID', issues: [{ path: [], code: 'invalid_json' }] } }
  }

  const envelope = agentWorkflowExportSchema.safeParse(candidate)
  if (!envelope.success) {
    return { ok: false, error: { code: 'EXPORT_SCHEMA_INVALID', issues: schemaIssues(envelope.error.issues) } }
  }

  const sentinelDocument = createAgentWorkflowEditorDocumentSchema({ systemVariableIds: context.systemVariableIds }).safeParse({
    agent: {
      id: envelope.data.source.agentId,
      journeyId: envelope.data.source.journeyId,
      name: envelope.data.source.agentName,
      description: null,
      revision: 1,
      createdAt: envelope.data.exportedAt,
      updatedAt: envelope.data.exportedAt,
    },
    ...envelope.data.document,
  })
  const validation = validateWorkflowGraph(envelope.data.document.workflow)
  if (!sentinelDocument.success || !validation.isStructurallyValid) {
    const issues = sentinelDocument.success
      ? validation.structuralErrors.map((issue) => ({ path: ['document', 'workflow'], code: issue.code }))
      : schemaIssues(sentinelDocument.error.issues).map((issue) => ({ ...issue, path: ['document', ...issue.path.filter((segment) => segment !== 'agent')] }))
    return { ok: false, error: { code: 'WORKFLOW_INVALID', issues } }
  }

  const missingKnowledgeSpaceIds = [...collectKnowledgeSpaceIds(envelope.data.document)]
    .filter((id) => !context.availableKnowledgeSpaceIds.has(id))
    .sort()
  if (missingKnowledgeSpaceIds.length > 0) {
    return {
      ok: false,
      error: {
        code: 'REFERENCE_MISSING',
        issues: missingKnowledgeSpaceIds.map((id) => ({ path: ['document'], code: `missing_knowledge_space:${id}` })),
      },
    }
  }

  return { ok: true, value: envelope.data, summary: summarizeWorkflowImport(envelope.data) }
}
