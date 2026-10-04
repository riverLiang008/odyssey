import { taskNodeSchema, toolStepSchema, type AgentReusableTool, type LoopBodyNode, type TaskNode, type UUID, type WorkflowNode } from '@odyssey/schemas'

import type { WorkflowDomainError } from './workflowErrors'

type TaskResourceResult =
  | { readonly ok: true; readonly value: TaskNode['config'] }
  | { readonly ok: false; readonly error: WorkflowDomainError }

export interface AppendReusableToolToTaskIntent {
  readonly nodeId: UUID
  readonly reusableToolId: UUID
  readonly stepId: UUID
  readonly outputVariableId: UUID
}

const outputSourceByKind = {
  knowledge_retrieval: 'retrieved_documents',
  script_execution: 'result',
  api_request: 'response.data',
  set_variable: null,
  llm_call: 'response.text',
} as const

export function appendReusableToolToTask(
  nodes: readonly (WorkflowNode | LoopBodyNode)[],
  reusableTools: readonly AgentReusableTool[],
  intent: AppendReusableToolToTaskIntent,
): TaskResourceResult {
  const node = nodes.find((candidate) => candidate.id === intent.nodeId)
  if (!node || node.type !== 'task') return { ok: false, error: { code: 'RESOURCE_TARGET_INVALID', nodeId: intent.nodeId } }
  const parsedTask = taskNodeSchema.safeParse(node)
  if (!parsedTask.success) return { ok: false, error: { code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId } }
  const task = parsedTask.data
  const tool = reusableTools.find((candidate) => candidate.id === intent.reusableToolId)
  if (!tool) return { ok: false, error: { code: 'RESOURCE_NOT_AVAILABLE', resourceId: intent.reusableToolId } }
  if (task.config.steps.some((step) => step.id === intent.stepId)) return { ok: false, error: { code: 'NODE_ID_CONFLICT', nodeId: intent.stepId } }

  const expectedSource = outputSourceByKind[tool.kind]
  const needsLocalOutput = expectedSource !== null && tool.outputBinding === null
  const outputMapping = expectedSource === null
    ? null
    : {
        sourceKey: expectedSource,
        targetVariableId: tool.outputBinding?.targetVariableId ?? intent.outputVariableId,
      }
  const parsedStep = toolStepSchema.safeParse({
    id: intent.stepId,
    kind: tool.kind,
    label: tool.name,
    configuration: structuredClone(tool.configuration),
    outputMapping,
    failureBehavior: { kind: 'fail_task' as const },
  })
  if (!parsedStep.success) return { ok: false, error: { code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId } }
  const candidate: TaskNode = {
    ...task,
    config: {
      localVariables: needsLocalOutput
        ? [...task.config.localVariables, { id: intent.outputVariableId, key: `step_${task.config.steps.length + 1}_output`, dataType: 'json', defaultValue: null }]
        : [...task.config.localVariables],
      steps: [...task.config.steps, parsedStep.data],
    },
  }
  const parsed = taskNodeSchema.safeParse(candidate)
  return parsed.success
    ? { ok: true, value: parsed.data.config }
    : { ok: false, error: { code: 'INVALID_NODE_CONFIG', nodeId: intent.nodeId } }
}
