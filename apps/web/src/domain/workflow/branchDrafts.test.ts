import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentVariable, type BranchNode, type WorkflowGraph } from '@odyssey/schemas'
import { applyBranchEdit } from './branchCommands'
import { branchDraftFromNode, newBranchDraft, parseBranchDraft, type BranchEditIntent } from './branchDrafts'

const id = (n: number) => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${String(n).padStart(12, '0')}`)
const variable: AgentVariable = { id: id(10), key: 'count', displayName: 'Count', dataType: 'number', ownership: 'shared', readOnly: false, description: null, defaultValue: 0 }
const branch = (): BranchNode => ({ id: id(2), type: 'branch', name: 'Enough evidence?', config: { cases: [{ id: id(3), label: 'Enough', match: 'all', conditions: [{ id: id(4), left: { kind: 'variable', variableId: variable.id }, operator: 'gte', right: { kind: 'literal', value: 3 } }] }], defaultCase: { id: id(5), label: 'Default' } } })
function graph(): WorkflowGraph { return { schemaVersion: '1.0.0', nodes: [{ id: id(1), type: 'start', name: 'Start', config: {} }, branch(), { id: id(6), type: 'end', name: 'End', config: {} }], edges: [{ id: id(7), sourceNodeId: id(1), targetNodeId: id(2) }, { id: id(8), sourceNodeId: id(2), sourceHandleId: id(3), targetNodeId: id(6) }, { id: id(9), sourceNodeId: id(2), sourceHandleId: id(5), targetNodeId: id(6) }] } }
const intent = (g: WorkflowGraph): BranchEditIntent => ({ baseline: branch(), baselineEdges: g.edges.filter(e => e.sourceNodeId === id(2)), node: branch(), confirmedRemovedCaseIds: [] })
describe('Branch draft boundary', () => {
  it('round-trips typed operands without modifying the node and rejects empty numeric values', () => {
    const n = branch(), before = structuredClone(n), d = branchDraftFromNode(n)
    expect(parseBranchDraft(d, [variable])).toEqual({ ok: true, node: n })
    const c = d.cases[0]?.conditions[0]
    if (!c || c.right.kind !== 'literal') throw new Error('Expected condition')
    c.right.raw = ' '
    expect(parseBranchDraft(d, [variable])).toMatchObject({ ok: false, issues: [{ code: 'VALUE_INVALID', conditionId: c.id }] })
    expect(n).toEqual(before)
  })
  it('rejects normalized duplicate case names without changing the input', () => {
    const d = branchDraftFromNode(branch())
    const first = d.cases[0]
    if (!first) throw new Error('Case required')
    first.label = ' e\u0301 '
    d.cases.push({ ...structuredClone(first), id: id(40), label: 'é', conditions: first.conditions.map(c => ({ ...c, id: id(41) })) })
    const before = structuredClone(d)
    expect(parseBranchDraft(d, [variable])).toMatchObject({ ok: false, issues: [{ code: 'CASE_NAME_DUPLICATE', caseId: id(40) }] })
    expect(d).toEqual(before)
    const second = d.cases[1]
    if (!second) throw new Error('Second case required')
    second.label = 'É'
    expect(parseBranchDraft(d, [variable]).ok).toBe(true)
  })
  it('keeps an unconfigured Case 1 outside the persisted Branch', () => {
    const n = branch(); n.config.cases = []
    let seq = 20
    const d = newBranchDraft(n, () => id(seq++))
    expect(d.cases[0]?.label).toBe('Case 1')
    expect(parseBranchDraft(d, [])).toMatchObject({ ok: false })
    expect(n.config.cases).toEqual([])
  })
  it('omits the right operand for unary operators and diagnoses unavailable variables', () => {
    const d = branchDraftFromNode(branch()), c = d.cases[0]?.conditions[0]
    if (!c) throw new Error('Expected condition')
    c.left = { kind: 'literal', dataType: 'string', raw: '' }; c.operator = 'is_empty'
    const p = parseBranchDraft(d, [])
    expect(p.ok && p.node.config.cases[0]?.conditions[0]).not.toHaveProperty('right')
    expect(parseBranchDraft(branchDraftFromNode(branch()), [])).toMatchObject({ ok: false, issues: [{ code: 'VARIABLE_UNAVAILABLE' }] })
  })
  it('validates booleans, JSON and type compatibility', () => {
    const d = branchDraftFromNode(branch()), c = d.cases[0]?.conditions[0]
    if (!c) throw new Error('Expected condition')
    c.right = { kind: 'literal', dataType: 'string', raw: '3' }
    expect(parseBranchDraft(d, [variable])).toMatchObject({ ok: false, issues: [{ code: 'TYPE_MISMATCH' }] })
    c.operator = 'eq'; c.left = { kind: 'literal', dataType: 'boolean', raw: 'false' }; c.right = { kind: 'literal', dataType: 'boolean', raw: 'false' }
    expect(parseBranchDraft(d, []).ok).toBe(true)
    c.right.raw = '0'; expect(parseBranchDraft(d, []).ok).toBe(false)
    c.left = { kind: 'literal', dataType: 'json', raw: '{"a":1}' }; c.right = { kind: 'literal', dataType: 'json', raw: 'null' }
    expect(parseBranchDraft(d, []).ok).toBe(true)
    c.right.raw = '{'; expect(parseBranchDraft(d, []).ok).toBe(false)
  })
})
describe('Atomic Branch edit', () => {
  it('preserves IDs and edges when renaming or reordering cases', () => {
    const g = graph(), i = intent(g), before = structuredClone(g)
    i.node.name = 'Evidence'; const first = i.node.config.cases[0]; if (!first) throw new Error('Expected case')
    first.label = 'Renamed'
    i.node.config.cases.unshift({ ...structuredClone(first), id: id(30), label: 'Priority', conditions: first.conditions.map(c => ({ ...c, id: id(31) })) })
    const result = applyBranchEdit(g, { kind: 'agent-workflow' }, i, [variable])
    expect(result.ok && result.value.edges).toEqual(g.edges)
    expect(result.ok && result.value.nodes[1]).toMatchObject({ name: 'Evidence', config: { cases: [{ id: id(30) }, { id: id(3) }] } })
    expect(g).toEqual(before)
  })
  it('requires confirmation and removes only a deleted case and its owned edges', () => {
    const g = graph(), i = intent(g); i.node.config.cases = []
    expect(applyBranchEdit(g, { kind: 'agent-workflow' }, i, [variable]).ok).toBe(false)
    i.confirmedRemovedCaseIds = [id(3)]
    const r = applyBranchEdit(g, { kind: 'agent-workflow' }, i, [variable])
    expect(r.ok && r.value.edges.map(e => e.id)).toEqual([id(7), id(9)])
    expect(r.ok && r.value.nodes.some(n => n.id === id(6))).toBe(true)
    expect(g.edges).toHaveLength(3)
  })
  it('rejects stale fields, stale connections, replaced Default and invalid variable references', () => {
    const g = graph(), i = intent(g)
    i.baseline.name = 'old'; expect(applyBranchEdit(g, { kind: 'agent-workflow' }, i, [variable]).ok).toBe(false)
    i.baseline = branch(); i.baselineEdges = []; expect(applyBranchEdit(g, { kind: 'agent-workflow' }, i, [variable]).ok).toBe(false)
    const next = intent(g); next.node.config.defaultCase.id = id(99)
    expect(applyBranchEdit(g, { kind: 'agent-workflow' }, next, [variable]).ok).toBe(false)
    expect(applyBranchEdit(g, { kind: 'agent-workflow' }, intent(g), []).ok).toBe(false)
  })
})
