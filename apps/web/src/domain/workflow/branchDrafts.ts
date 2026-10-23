import { branchNodeSchema, jsonValueSchema, uuidSchema, type AgentVariable, type BranchNode, type JsonValue, type UUID, type ValueSource, type WorkflowEdge } from '@odyssey/schemas'

export type BranchCondition = BranchNode['config']['cases'][number]['conditions'][number]
export type BranchOperator = BranchCondition['operator']
export type BranchOperandDraft =
  | { kind: 'variable'; variableId: string }
  | { kind: 'literal'; dataType: AgentVariable['dataType']; raw: string }
  | { kind: 'template'; source: Extract<ValueSource, { kind: 'template' }> }
export interface BranchConditionDraft { id: UUID; left: BranchOperandDraft; operator: BranchOperator; right: BranchOperandDraft }
export interface BranchCaseDraft { id: UUID; label: string; conditions: BranchConditionDraft[] }
export interface BranchDraft { id: UUID; name: string; cases: BranchCaseDraft[]; defaultCase: BranchNode['config']['defaultCase'] }
export type BranchDraftError = 'NAME_REQUIRED' | 'CASE_NAME_REQUIRED' | 'CASE_NAME_DUPLICATE' | 'CONDITION_REQUIRED' | 'VARIABLE_UNAVAILABLE' | 'VALUE_INVALID' | 'TYPE_MISMATCH' | 'CONFIG_INVALID'
export interface BranchDraftIssue { code: BranchDraftError; caseId?: UUID; conditionId?: UUID }
export interface BranchEditIntent { baseline: BranchNode; baselineEdges: WorkflowEdge[]; node: BranchNode; confirmedRemovedCaseIds: UUID[] }
/** Object property order is not a semantic edit; Case/condition/edge array order is. */
export function branchSnapshot(value: BranchNode | readonly WorkflowEdge[]): string {
  function canonical(input: unknown): string {
    if (Array.isArray(input)) return `[${input.map(canonical).join(',')}]`
    if (input !== null && typeof input === 'object') return `{${Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`).join(',')}}`
    return JSON.stringify(input) ?? 'null'
  }
  return canonical(value)
}
export const branchOperators: readonly { value: BranchOperator; label: string }[] = [
  { value: 'eq', label: '= Equals' }, { value: 'neq', label: '≠ Not equal' },
  { value: 'gt', label: '> Greater than' }, { value: 'gte', label: '≥ At least' },
  { value: 'lt', label: '< Less than' }, { value: 'lte', label: '≤ At most' },
  { value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does not contain' },
  { value: 'is_empty', label: 'Is empty' }, { value: 'is_not_empty', label: 'Is not empty' },
]
export function unaryBranchOperator(op: BranchOperator): boolean { return op === 'is_empty' || op === 'is_not_empty' }
export function emptyBranchCondition(id: UUID): BranchConditionDraft {
  return { id, left: { kind: 'variable', variableId: '' }, operator: 'eq', right: { kind: 'literal', dataType: 'string', raw: '' } }
}
function operandDraft(value: ValueSource): BranchOperandDraft {
  if (value.kind === 'variable') return { ...value }
  if (value.kind === 'template') return { kind: 'template', source: structuredClone(value) }
  return { kind: 'literal', dataType: typeof value.value === 'number' ? 'number' : typeof value.value === 'boolean' ? 'boolean' : typeof value.value === 'string' ? 'string' : 'json', raw: typeof value.value === 'string' ? value.value : JSON.stringify(value.value) }
}
export function branchDraftFromNode(node: BranchNode): BranchDraft {
  return { id: node.id, name: node.name, defaultCase: { ...node.config.defaultCase }, cases: node.config.cases.map(c => ({ id: c.id, label: c.label, conditions: c.conditions.map(c => ({ id: c.id, left: operandDraft(c.left), operator: c.operator, right: 'right' in c ? operandDraft(c.right) : { kind: 'literal', dataType: 'string', raw: '' } })) })) }
}
function parseOperand(draft: BranchOperandDraft, variables: readonly AgentVariable[]): { source: ValueSource; dataType: AgentVariable['dataType'] } | BranchDraftError {
  if (draft.kind === 'variable') {
    const v = variables.find(v => v.id === draft.variableId)
    return v ? { source: { kind: 'variable', variableId: v.id }, dataType: v.dataType } : 'VARIABLE_UNAVAILABLE'
  }
  if (draft.kind === 'template') {
    if (draft.source.segments.some(s => s.kind === 'variable' && !variables.some(v => v.id === s.variableId))) return 'VARIABLE_UNAVAILABLE'
    return { source: structuredClone(draft.source), dataType: 'string' }
  }
  let value: JsonValue
  if (draft.dataType === 'string') value = draft.raw
  else if (draft.dataType === 'number') {
    if (!draft.raw.trim() || !Number.isFinite(Number(draft.raw))) return 'VALUE_INVALID'
    value = Number(draft.raw)
  } else if (draft.dataType === 'boolean') {
    if (draft.raw !== 'true' && draft.raw !== 'false') return 'VALUE_INVALID'
    value = draft.raw === 'true'
  } else {
    try { const p = jsonValueSchema.safeParse(JSON.parse(draft.raw)); if (!p.success) return 'VALUE_INVALID'; value = p.data } catch { return 'VALUE_INVALID' }
  }
  return { source: { kind: 'literal', value }, dataType: draft.dataType }
}
export function parseBranchDraft(draft: BranchDraft, variables: readonly AgentVariable[]): { ok: true; node: BranchNode } | { ok: false; issues: BranchDraftIssue[] } {
  const issues: BranchDraftIssue[] = []
  if (!draft.name.trim()) issues.push({ code: 'NAME_REQUIRED' })
  const cases: BranchNode['config']['cases'] = []
  const caseNames = new Set<string>()
  for (const c of draft.cases) {
    const key = c.label.trim().normalize('NFC')
    if (caseNames.has(key)) issues.push({ code: 'CASE_NAME_DUPLICATE', caseId: c.id })
    caseNames.add(key)
    if (!c.label.trim()) issues.push({ code: 'CASE_NAME_REQUIRED', caseId: c.id })
    if (!c.conditions.length) issues.push({ code: 'CONDITION_REQUIRED', caseId: c.id })
    const conditions: BranchCondition[] = []
    for (const condition of c.conditions) {
      const left = parseOperand(condition.left, variables)
      const right = unaryBranchOperator(condition.operator) ? null : parseOperand(condition.right, variables)
      const issue = (code: BranchDraftError) => issues.push({ code, caseId: c.id, conditionId: condition.id })
      if (typeof left === 'string') { issue(left); continue }
      if (typeof right === 'string') { issue(right); continue }
      if (['gt', 'gte', 'lt', 'lte'].includes(condition.operator) && (left.dataType !== 'number' || right?.dataType !== 'number')) { issue('TYPE_MISMATCH'); continue }
      if (['eq', 'neq'].includes(condition.operator) && left.dataType !== right?.dataType) { issue('TYPE_MISMATCH'); continue }
      if (['contains', 'not_contains'].includes(condition.operator) && (left.dataType !== 'json' && (left.dataType !== 'string' || right?.dataType !== 'string'))) { issue('TYPE_MISMATCH'); continue }
      if (unaryBranchOperator(condition.operator) && !['string', 'json'].includes(left.dataType)) { issue('TYPE_MISMATCH'); continue }
      if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') conditions.push({ id: condition.id, left: left.source, operator: condition.operator })
      else if (right) conditions.push({ id: condition.id, left: left.source, operator: condition.operator, right: right.source })
    }
    cases.push({ id: c.id, label: c.label.trim(), match: 'all', conditions })
  }
  if (issues.length) return { ok: false, issues }
  const parsed = branchNodeSchema.safeParse({ id: draft.id, type: 'branch', name: draft.name.trim(), config: { cases, defaultCase: { ...draft.defaultCase, label: draft.defaultCase.label.trim() } } })
  return parsed.success ? { ok: true, node: parsed.data } : { ok: false, issues: [{ code: 'CONFIG_INVALID' }] }
}
export function branchOperandSummary(source: ValueSource, variables: readonly AgentVariable[]): string {
  if (source.kind === 'variable') return variables.find(v => v.id === source.variableId)?.displayName ?? 'Unavailable variable'
  if (source.kind === 'template') return source.segments.map(s => s.kind === 'text' ? s.text : variables.find(v => v.id === s.variableId)?.displayName ?? 'Unavailable variable').join('')
  return JSON.stringify(source.value)
}
export function branchConditionSummary(condition: BranchCondition, variables: readonly AgentVariable[]): string {
  return `${branchOperandSummary(condition.left, variables)} ${branchOperators.find(o => o.value === condition.operator)?.label ?? condition.operator}${'right' in condition ? ` ${branchOperandSummary(condition.right, variables)}` : ''}`
}
export function newBranchDraft(node: BranchNode, createId: () => string): BranchDraft {
  const d = branchDraftFromNode(node)
  if (!d.cases.length) d.cases.push({ id: uuidSchema.parse(createId()), label: 'Case 1', conditions: [emptyBranchCondition(uuidSchema.parse(createId()))] })
  return d
}
