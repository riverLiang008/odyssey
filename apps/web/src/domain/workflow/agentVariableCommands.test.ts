import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentVariable } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import { agentVariableReferenceCount, changeAgentVariable } from './agentVariableCommands'

const id = (n: number) => uuidSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const variable = (overrides: Partial<AgentVariable> = {}): AgentVariable => ({ id: id(80), key: 'research_status', displayName: 'Research status', description: null, dataType: 'json', ownership: 'shared', defaultValue: null, readOnly: false, ...overrides })

describe('Agent Variable commands', () => {
  it('creates and updates immutable variable collections', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const before = structuredClone(document)
    const created = changeAgentVariable(document, { type: 'create', variable: variable() }, 'configure')
    expect(created.ok).toBe(true)
    expect(document).toEqual(before)
    if (!created.ok) return
    const updatedDocument = { ...document, variables: created.value }
    const updated = changeAgentVariable(updatedDocument, { type: 'update', variable: variable({ ownership: 'agent_managed', readOnly: true }) }, 'configure')
    expect(updated.ok && updated.value[updated.value.length - 1]?.ownership).toBe('agent_managed')
  })
  it('rejects duplicate, reserved, inconsistent and read-only mutations', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const existing = document.variables[0]
    if (!existing) throw new Error('Missing fixture variable')
    expect(changeAgentVariable(document, { type: 'create', variable: variable({ key: existing.key }) }, 'configure').ok).toBe(false)
    expect(changeAgentVariable(document, { type: 'create', variable: variable({ key: 'sys.bad' }) }, 'configure').ok).toBe(false)
    expect(changeAgentVariable(document, { type: 'create', variable: variable({ ownership: 'agent_managed', readOnly: false }) }, 'configure').ok).toBe(false)
    expect(changeAgentVariable(document, { type: 'create', variable: variable() }, 'flow')).toEqual({ ok: false, error: 'READ_ONLY' })
  })
  it('blocks referenced deletion and permits unreferenced deletion', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const referenced = document.variables[0]
    if (!referenced) throw new Error('Missing fixture variable')
    expect(agentVariableReferenceCount(document, referenced.id)).toBeGreaterThan(0)
    expect(changeAgentVariable(document, { type: 'delete', variableId: referenced.id }, 'configure')).toMatchObject({ ok: false, error: 'VARIABLE_REFERENCED' })
    const extra = variable()
    const withExtra = { ...document, variables: [...document.variables, extra] }
    expect(changeAgentVariable(withExtra, { type: 'delete', variableId: extra.id }, 'configure')).toMatchObject({ ok: true })
  })
})
