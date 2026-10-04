import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentReusableTool, type TaskNode, type UUID } from '@odyssey/schemas'

import { appendReusableToolToTask } from './taskResourceCommands'

function id(value: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${value.toString().padStart(12, '0')}`)
}

const task: TaskNode = { id: id(1), type: 'task', name: 'Publish', config: { localVariables: [], steps: [] } }
const tool: AgentReusableTool = {
  id: id(2), name: 'Prepare result', sourceTemplateId: null, kind: 'script_execution',
  configuration: { language: 'javascript', script: 'return 1' }, inputBindings: [], outputBinding: null,
}

describe('appendReusableToolToTask', () => {
  it('creates a Task-owned configured step and a local output when needed', () => {
    const result = appendReusableToolToTask([task], [tool], { nodeId: task.id, reusableToolId: tool.id, stepId: id(3), outputVariableId: id(4) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.steps[0]).toMatchObject({ id: id(3), kind: 'script_execution', label: tool.name, outputMapping: { sourceKey: 'result', targetVariableId: id(4) } })
    expect(result.value.localVariables).toEqual([{ id: id(4), key: 'step_1_output', dataType: 'json', defaultValue: null }])
    expect(task.config.steps).toEqual([])
  })

  it('allows repeated use as distinct ordered Task steps', () => {
    const first = appendReusableToolToTask([task], [tool], { nodeId: task.id, reusableToolId: tool.id, stepId: id(3), outputVariableId: id(4) })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = appendReusableToolToTask([{ ...task, config: first.value }], [tool], { nodeId: task.id, reusableToolId: tool.id, stepId: id(5), outputVariableId: id(6) })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.value.steps.map((step) => step.id)).toEqual([id(3), id(5)])
  })

  it('rejects unavailable resources and non-Task targets', () => {
    expect(appendReusableToolToTask([task], [], { nodeId: task.id, reusableToolId: tool.id, stepId: id(3), outputVariableId: id(4) })).toEqual({ ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: tool.id } })
    const nonTask = { id: id(9), type: 'agent_action' as const, name: 'Agent', config: { model: 'gpt-5', goal: { kind: 'literal' as const, value: 'Goal' }, knowledgeSpaceIds: [], reusableToolIds: [] } }
    expect(appendReusableToolToTask([nonTask], [tool], { nodeId: id(9), reusableToolId: tool.id, stepId: id(3), outputVariableId: id(4) })).toEqual({ ok: false, error: { code: 'RESOURCE_TARGET_INVALID', nodeId: id(9) } })
  })
})
