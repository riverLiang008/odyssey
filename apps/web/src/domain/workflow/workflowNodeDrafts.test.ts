import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentVariable } from '@odyssey/schemas'

import { createAgentActionFromDraft, createDefaultLoop, createLoopFromDraft } from './workflowNodeDrafts'

const ids = Array.from({ length: 8 }, (_, index) => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-d721990f${(9100 + index).toString()}`))
function factory() {
  let nodeIndex = 0
  let edgeIndex = 5
  return { nodeId: () => ids[nodeIndex++]!, edgeId: () => ids[edgeIndex++]! }
}
const variable: AgentVariable = {
  id: ids[4]!, key: 'attempts', displayName: 'Attempts', description: null,
  dataType: 'number', ownership: 'agent_managed', defaultValue: 0, readOnly: false,
}

describe('workflow node draft factories', () => {
  it('normalizes and validates an Agent Action before assigning an id', () => {
    const result = createAgentActionFromDraft({ name: ' Research ', model: ' gpt-4.1 ', goal: ' Summarize ' }, factory())
    expect(result.ok && result.value).toMatchObject({ type: 'agent_action', name: 'Research', config: { model: 'gpt-4.1', goal: { kind: 'literal', value: 'Summarize' } } })
  })

  it('rejects incomplete Agent Actions without producing a node', () => {
    expect(createAgentActionFromDraft({ name: 'Action', model: '', goal: 'Work' }, factory())).toEqual({ ok: false, error: { code: 'MODEL_REQUIRED' } })
  })

  it('creates a minimal typed Loop body and parses its comparison value', () => {
    const result = createLoopFromDraft({ name: 'Retry', maxTurns: 4, variableId: variable.id, operator: 'gte', comparisonValue: '3' }, [variable], factory())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.config.exitCondition.value).toBe(3)
    expect(result.value.config.body.graph.nodes.map((node) => node.type)).toEqual(['loop_start', 'loop_end'])
    expect(result.value.config.body.graph.edges).toHaveLength(1)
    expect(result.value.config.body.layout.nodePlacements).toHaveLength(2)
  })

  it('rejects invalid Loop prerequisites and typed values', () => {
    expect(createLoopFromDraft({ name: 'Retry', maxTurns: 0, variableId: variable.id, operator: 'eq', comparisonValue: '1' }, [variable], factory())).toEqual({ ok: false, error: { code: 'MAX_TURNS_INVALID' } })
    expect(createLoopFromDraft({ name: 'Retry', maxTurns: 2, variableId: variable.id, operator: 'eq', comparisonValue: 'abc' }, [variable], factory())).toEqual({ ok: false, error: { code: 'COMPARISON_VALUE_INVALID' } })
  })

  it('creates a dropped Loop immediately with valid defaults', () => {
    const result = createDefaultLoop([variable], factory())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      type: 'loop',
      name: 'New Loop',
      config: {
        maxTurns: 10,
        exitCondition: { variableId: variable.id, operator: 'eq', value: 0 },
      },
    })
    expect(createDefaultLoop([], factory())).toEqual({ ok: false, error: { code: 'VARIABLE_REQUIRED' } })
  })
})
