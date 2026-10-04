import {
  agentActionNodeSchema,
  jsonValueSchema,
  loopNodeSchema,
  type AgentActionNode,
  type AgentVariable,
  type JsonValue,
  type LoopNode,
} from '@odyssey/schemas'

import { createMinimalLoopBody } from './workflowFactories'
import type { WorkflowIdFactory } from './workflowIdFactory'

export interface AgentActionDraftValues {
  readonly name: string
  readonly model: string
  readonly goal: string
}

export interface LoopDraftValues {
  readonly name: string
  readonly maxTurns: number
  readonly variableId: string
  readonly operator: LoopNode['config']['exitCondition']['operator']
  readonly comparisonValue: string
}

export type WorkflowDraftErrorCode =
  | 'NAME_REQUIRED'
  | 'MODEL_REQUIRED'
  | 'GOAL_REQUIRED'
  | 'MAX_TURNS_INVALID'
  | 'VARIABLE_REQUIRED'
  | 'COMPARISON_VALUE_INVALID'
  | 'DRAFT_SCHEMA_INVALID'

export type WorkflowDraftResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: WorkflowDraftErrorCode } }

function failure<T>(code: WorkflowDraftErrorCode): WorkflowDraftResult<T> { return { ok: false, error: { code } } }

export function createAgentActionFromDraft(
  values: AgentActionDraftValues,
  idFactory: Pick<WorkflowIdFactory, 'nodeId'>,
): WorkflowDraftResult<AgentActionNode> {
  const name = values.name.trim()
  const model = values.model.trim()
  const goal = values.goal.trim()
  if (!name) return failure('NAME_REQUIRED')
  if (!model) return failure('MODEL_REQUIRED')
  if (!goal) return failure('GOAL_REQUIRED')
  const parsed = agentActionNodeSchema.safeParse({
    id: idFactory.nodeId(),
    type: 'agent_action',
    name,
    config: { model, goal: { kind: 'literal', value: goal }, knowledgeSpaceIds: [], reusableToolIds: [] },
  })
  return parsed.success ? { ok: true, value: parsed.data } : failure('DRAFT_SCHEMA_INVALID')
}

function comparisonValue(variable: AgentVariable, raw: string): WorkflowDraftResult<JsonValue> {
  const value = raw.trim()
  if (variable.dataType === 'string') return { ok: true, value: raw }
  if (variable.dataType === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? { ok: true, value: number } : failure('COMPARISON_VALUE_INVALID')
  }
  if (variable.dataType === 'boolean') {
    if (value === 'true') return { ok: true, value: true }
    if (value === 'false') return { ok: true, value: false }
    return failure('COMPARISON_VALUE_INVALID')
  }
  try {
    const parsed = jsonValueSchema.safeParse(JSON.parse(value))
    return parsed.success ? { ok: true, value: parsed.data } : failure('COMPARISON_VALUE_INVALID')
  } catch { return failure('COMPARISON_VALUE_INVALID') }
}

export function createLoopFromDraft(
  values: LoopDraftValues,
  variables: readonly AgentVariable[],
  idFactory: Pick<WorkflowIdFactory, 'nodeId' | 'edgeId'>,
): WorkflowDraftResult<LoopNode> {
  const name = values.name.trim()
  if (!name) return failure('NAME_REQUIRED')
  if (!Number.isInteger(values.maxTurns) || values.maxTurns <= 0) return failure('MAX_TURNS_INVALID')
  const variable = variables.find((candidate) => candidate.id === values.variableId)
  if (!variable) return failure('VARIABLE_REQUIRED')
  const parsedValue = comparisonValue(variable, values.comparisonValue)
  if (!parsedValue.ok) return parsedValue
  const loopId = idFactory.nodeId()
  const bodyGraph = createMinimalLoopBody(idFactory)
  const [start, end] = bodyGraph.nodes
  if (!start || !end) return failure('DRAFT_SCHEMA_INVALID')
  const parsed = loopNodeSchema.safeParse({
    id: loopId,
    type: 'loop',
    name,
    config: {
      maxTurns: values.maxTurns,
      exitCondition: { kind: 'variable_comparison', variableId: variable.id, operator: values.operator, value: parsedValue.value },
      body: {
        graph: bodyGraph,
        layout: {
          nodePlacements: [{ nodeId: start.id, x: 120, y: 180 }, { nodeId: end.id, x: 360, y: 180 }],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    },
  })
  return parsed.success ? { ok: true, value: parsed.data } : failure('DRAFT_SCHEMA_INVALID')
}
