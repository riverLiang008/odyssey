import { describe, expect, it } from 'vitest'
import { toolStepSchema, uuidSchema, type TaskNode } from '@odyssey/schemas'
import fixtures from '../../../../../packages/schemas/fixtures/system-tools.json'
import { changeTaskTool } from './systemToolCommands'
import { evaluateWorkflowResourceDrop, parseWorkflowResourceDragPayload } from '@/canvas/workflow'
const id = (n: number) => uuidSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const task: TaskNode = { id: id(1), name: 'Task', type: 'task', config: { steps: [], localVariables: [{ id: id(2), key: 'output', dataType: 'json', defaultValue: null }] } }
const context = { mode: 'configure' as const, variables: [], knowledgeSpaceIds: new Set([id(10)]) }

describe('System Tool Task commands', () => {
  it.each(fixtures.valid)('atomically adds valid $kind without mutating input', (input) => {
    const before = structuredClone(task)
    const result = changeTaskTool(task, { type: 'add', step: toolStepSchema.parse(input) }, context)
    expect(result.ok).toBe(true)
    expect(task).toEqual(before)
    if (result.ok) expect(result.value.steps).toHaveLength(1)
  })
  it.each(fixtures.valid)('rejects read-only mode and unavailable output for $kind', (input) => {
    const step = toolStepSchema.parse(input)
    expect(changeTaskTool(task, { type: 'add', step }, { ...context, mode: 'flow' })).toEqual({ ok: false, error: 'READ_ONLY' })
    expect(changeTaskTool({ ...task, config: { steps: [], localVariables: [] } }, { type: 'add', step }, context).ok).toBe(false)
  })
  it('edits, reorders and deletes by stable step identity', () => {
    const steps = fixtures.valid.map((s) => toolStepSchema.parse(s))
    const first = steps[0]
    const second = steps[1]
    if (!first || !second) throw new Error('Missing fixtures')
    const full = { ...task, config: { ...task.config, steps } }
    const edited = changeTaskTool(full, { type: 'edit', step: { ...first, label: 'Changed' } }, context)
    expect(edited.ok && edited.value.steps[0]?.label).toBe('Changed')
    const moved = changeTaskTool(full, { type: 'move', stepId: first.id, direction: 1 }, context)
    expect(moved.ok && moved.value.steps[0]?.id).toBe(second.id)
    expect(changeTaskTool(full, { type: 'move', stepId: first.id, direction: -1 }, context).ok).toBe(false)
    const deleted = changeTaskTool(full, { type: 'delete', stepId: first.id }, context)
    expect(deleted.ok && deleted.value.steps).toHaveLength(4)
  })
  it('rejects missing, duplicate, foreign and readonly references before mutation', () => {
    const input = fixtures.valid[0]
    if (!input) throw new Error('Missing fixture')
    const step = toolStepSchema.parse(input)
    expect(changeTaskTool(task, { type: 'edit', step }, context)).toEqual({ ok: false, error: 'STEP_NOT_FOUND' })
    expect(changeTaskTool(task, { type: 'delete', stepId: step.id }, context)).toEqual({ ok: false, error: 'STEP_NOT_FOUND' })
    expect(changeTaskTool({ ...task, config: { ...task.config, steps: [step] } }, { type: 'add', step }, context)).toEqual({ ok: false, error: 'DUPLICATE_STEP' })
    expect(changeTaskTool(task, { type: 'add', step }, { ...context, knowledgeSpaceIds: new Set() })).toEqual({ ok: false, error: 'INVALID_REFERENCE' })
    const noLocal = { ...task, config: { steps: [], localVariables: [] } }
    expect(changeTaskTool(noLocal, { type: 'add', step }, { ...context, variables: [{ id: id(2), key: 'readonly', displayName: 'Readonly', description: null, dataType: 'json', ownership: 'shared', defaultValue: null, readOnly: true }] })).toEqual({ ok: false, error: 'INVALID_REFERENCE' })
  })
  it('preflights Task-only targets, definition identity, Flow and drag serialization', () => {
    const definition = { id: id(50), kind: 'script_execution' as const, source: 'built_in' as const, name: 'Script', category: 'Computation', description: null, configurationSchema: {}, inputSchema: {}, outputSchema: {} }
    const payload = { kind: 'system-tool-definition' as const, toolDefinitionId: definition.id, toolKind: definition.kind }
    const ctx = { node: task, systemTools: [definition], availableReusableToolIds: new Set<ReturnType<typeof id>>() }
    expect(parseWorkflowResourceDragPayload(JSON.stringify(payload))).toEqual(payload)
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'task-tool-sequence', nodeId: task.id }, ctx).status).toBe('valid')
    for (const target of [{ kind: 'canvas-pane' as const }, { kind: 'agent-action-tools' as const, nodeId: task.id }]) expect(evaluateWorkflowResourceDrop(payload, target, ctx).status).toBe('invalid')
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'task-tool-sequence', nodeId: task.id }, { ...ctx, mode: 'flow' }).status).toBe('invalid')
    expect(evaluateWorkflowResourceDrop(payload, { kind: 'task-tool-sequence', nodeId: task.id }, { ...ctx, systemTools: [] }).status).toBe('unavailable')
  })
})
