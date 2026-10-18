import { agentVariableSchema, type AgentVariable, type AgentWorkflowEditorDocument, type UUID } from '@odyssey/schemas'

export type AgentVariableCommandError = 'READ_ONLY' | 'INVALID_VARIABLE' | 'DUPLICATE_VARIABLE' | 'VARIABLE_NOT_FOUND' | 'VARIABLE_REFERENCED'
export type AgentVariableCommandResult =
  | { ok: true; value: AgentVariable[] }
  | { ok: false; error: AgentVariableCommandError; referenceCount?: number }

export type AgentVariableIntent =
  | { type: 'create'; variable: AgentVariable }
  | { type: 'update'; variable: AgentVariable }
  | { type: 'delete'; variableId: UUID }

function countReferences(value: unknown, variableId: UUID): number {
  if (value === variableId) return 1
  if (Array.isArray(value)) return value.reduce((count, entry) => count + countReferences(entry, variableId), 0)
  if (value && typeof value === 'object') return Object.values(value).reduce((count, entry) => count + countReferences(entry, variableId), 0)
  return 0
}

export function agentVariableReferenceCount(document: Pick<AgentWorkflowEditorDocument, 'workflow' | 'reusableTools'>, variableId: UUID) {
  return countReferences(document.workflow, variableId) + countReferences(document.reusableTools, variableId)
}

export function changeAgentVariable(
  document: Pick<AgentWorkflowEditorDocument, 'variables' | 'workflow' | 'reusableTools'>,
  intent: AgentVariableIntent,
  mode: 'flow' | 'configure',
): AgentVariableCommandResult {
  if (mode !== 'configure') return { ok: false, error: 'READ_ONLY' }
  if (intent.type === 'delete') {
    if (!document.variables.some((variable) => variable.id === intent.variableId)) return { ok: false, error: 'VARIABLE_NOT_FOUND' }
    const referenceCount = agentVariableReferenceCount(document, intent.variableId)
    if (referenceCount) return { ok: false, error: 'VARIABLE_REFERENCED', referenceCount }
    return { ok: true, value: document.variables.filter((variable) => variable.id !== intent.variableId) }
  }
  const parsed = agentVariableSchema.safeParse(intent.variable)
  if (!parsed.success || parsed.data.key.startsWith('sys.') || parsed.data.readOnly !== (parsed.data.ownership === 'agent_managed')) {
    return { ok: false, error: 'INVALID_VARIABLE' }
  }
  const variable = parsed.data
  const duplicate = document.variables.some((candidate) => candidate.id !== variable.id && candidate.key.toLowerCase() === variable.key.toLowerCase())
  if (duplicate) return { ok: false, error: 'DUPLICATE_VARIABLE' }
  const index = document.variables.findIndex((candidate) => candidate.id === variable.id)
  if (intent.type === 'create') {
    if (index >= 0) return { ok: false, error: 'DUPLICATE_VARIABLE' }
    return { ok: true, value: [...document.variables, variable] }
  }
  if (index < 0) return { ok: false, error: 'VARIABLE_NOT_FOUND' }
  if (document.variables[index]?.dataType !== variable.dataType) {
    const referenceCount = agentVariableReferenceCount(document, variable.id)
    if (referenceCount) return { ok: false, error: 'VARIABLE_REFERENCED', referenceCount }
  }
  const variables = [...document.variables]
  variables[index] = variable
  return { ok: true, value: variables }
}
