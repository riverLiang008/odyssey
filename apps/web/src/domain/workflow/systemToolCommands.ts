import { toolStepSchema, type AgentVariable, type TaskNode, type ToolStep, type UUID, type ValueSource } from '@odyssey/schemas'

export type ToolEditIntent =
  | { type: 'add'; step: ToolStep }
  | { type: 'edit'; step: ToolStep }
  | { type: 'delete'; stepId: UUID }
  | { type: 'move'; stepId: UUID; direction: -1 | 1 }
export type ToolCommandError = 'READ_ONLY' | 'INVALID_CONFIGURATION' | 'INVALID_REFERENCE' | 'STEP_NOT_FOUND' | 'INVALID_ORDER' | 'DUPLICATE_STEP'
export type ToolCommandResult = { ok: true; value: TaskNode['config'] } | { ok: false; error: ToolCommandError }
export interface ToolVariableOption { id: UUID; name: string; dataType: AgentVariable['dataType']; writable: boolean }

export function toolVariables(task: TaskNode, variables: readonly AgentVariable[]): ToolVariableOption[] {
  return [
    ...variables.map((v) => ({ id: v.id, name: `agent.${v.key}`, dataType: v.dataType, writable: !v.readOnly })),
    ...task.config.localVariables.map((v) => ({ id: v.id, name: `task.${v.key}`, dataType: v.dataType, writable: true })),
  ]
}
function references(value: ValueSource): UUID[] {
  switch (value.kind) {
    case 'literal': return []
    case 'variable': return [value.variableId]
    case 'template': return value.segments.flatMap((s) => s.kind === 'variable' ? [s.variableId] : [])
  }
}
function inputs(step: ToolStep): UUID[] {
  const c = step.configuration
  switch (step.kind) {
    case 'knowledge_retrieval': return references(step.configuration.query)
    case 'script_execution': return step.configuration.inputs?.map((i) => i.variableId) ?? []
    case 'api_request': {
      const config = step.configuration
      return [...references(config.url), ...config.headers.flatMap((h) => references(h.value)), ...(config.body.kind === 'json' ? references(config.body.value) : config.body.kind === 'form_data' ? config.body.entries.flatMap((e) => references(e.value)) : [])]
    }
    case 'set_variable': return 'value' in c ? references(c.value) : []
    case 'llm_call': return [...references(step.configuration.prompt), ...(step.configuration.systemPrompt ? references(step.configuration.systemPrompt) : [])]
  }
}
export function changeTaskTool(task: TaskNode, intent: ToolEditIntent, context: { mode: 'flow' | 'configure'; variables: readonly AgentVariable[]; knowledgeSpaceIds: ReadonlySet<UUID> }): ToolCommandResult {
  if (context.mode !== 'configure') return { ok: false, error: 'READ_ONLY' }
  const steps = [...task.config.steps]
  if (intent.type === 'delete' || intent.type === 'move') {
    const index = steps.findIndex((s) => s.id === intent.stepId)
    if (index < 0) return { ok: false, error: 'STEP_NOT_FOUND' }
    if (intent.type === 'delete') steps.splice(index, 1)
    else {
      const next = index + intent.direction
      if (next < 0 || next >= steps.length) return { ok: false, error: 'INVALID_ORDER' }
      const [step] = steps.splice(index, 1)
      if (!step) return { ok: false, error: 'STEP_NOT_FOUND' }
      steps.splice(next, 0, step)
    }
  } else {
    const parsed = toolStepSchema.safeParse(intent.step)
    if (!parsed.success) return { ok: false, error: 'INVALID_CONFIGURATION' }
    const step = parsed.data
    const variables = toolVariables(task, context.variables)
    const targetId = step.kind === 'set_variable' ? step.configuration.targetVariableId : step.outputMapping.targetVariableId
    const target = variables.find((v) => v.id === targetId && v.writable)
    if (!target || inputs(step).some((id) => !variables.some((v) => v.id === id))) return { ok: false, error: 'INVALID_REFERENCE' }
    if (step.kind === 'knowledge_retrieval' && !context.knowledgeSpaceIds.has(step.configuration.knowledgeSpaceId)) return { ok: false, error: 'INVALID_REFERENCE' }
    if (step.kind === 'set_variable') {
      const config = step.configuration
      if ((config.operation === 'increment' && target.dataType !== 'number') || (config.operation === 'toggle' && target.dataType !== 'boolean') || (config.operation === 'append' && !['string', 'json'].includes(target.dataType))) return { ok: false, error: 'INVALID_CONFIGURATION' }
    }
    const index = steps.findIndex((s) => s.id === step.id)
    if (intent.type === 'add') {
      if (index >= 0) return { ok: false, error: 'DUPLICATE_STEP' }
      steps.push(step)
    } else {
      if (index < 0) return { ok: false, error: 'STEP_NOT_FOUND' }
      steps[index] = step
    }
  }
  return { ok: true, value: { ...task.config, steps } }
}
