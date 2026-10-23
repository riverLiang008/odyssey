import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentVariable, type LoopNode, type UUID } from '@odyssey/schemas'
import WorkflowSidePanelHost from './WorkflowSidePanelHost.vue'

function id(value: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${value.toString().padStart(12, '0')}`)
}

const variable: AgentVariable = {
  id: id(1), key: 'review_score', displayName: 'Review score', description: null,
  dataType: 'number', ownership: 'agent_managed', defaultValue: 0, readOnly: false,
}
const loop: LoopNode = {
  id: id(2), type: 'loop', name: 'Evidence Review Loop',
  config: {
    maxTurns: 3,
    exitCondition: { kind: 'variable_comparison', variableId: variable.id, operator: 'gte', value: 3 },
    body: {
      graph: {
        nodes: [
          { id: id(3), type: 'loop_start', name: 'Loop Start', config: {} },
          { id: id(4), type: 'loop_end', name: 'Loop End', config: {} },
        ],
        edges: [{ id: id(5), sourceNodeId: id(3), targetNodeId: id(4) }],
      },
      layout: {
        nodePlacements: [{ nodeId: id(3), x: 0, y: 0 }, { nodeId: id(4), x: 220, y: 0 }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    },
  },
}

describe('WorkflowSidePanelHost Loop configuration', () => {
  it('submits typed Loop details without including the body', async () => {
    const wrapper = mount(WorkflowSidePanelHost, { props: { node: loop, edge: null, variables: [variable], loopExpanded: true } })
    expect(wrapper.text()).not.toContain('Node type')
    expect(wrapper.text()).not.toContain('Identity')
    expect(wrapper.text()).not.toContain(loop.id)
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('[aria-label^="Exit condition Variable:"]').trigger('click')
    expect(wrapper.get('[role="listbox"]').attributes('aria-label')).toBe('Exit condition Variable')
    await wrapper.get('[role="listbox"]').trigger('keydown', { key: 'Escape' })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('Reviewed evidence')
    await inputs[1]!.setValue('5')
    await inputs[2]!.setValue('4')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('updateLoop')?.[0]?.[0]).toEqual({
      name: 'Reviewed evidence', maxTurns: 5,
      exitCondition: { kind: 'variable_comparison', variableId: variable.id, operator: 'gte', value: 4 },
    })
    expect(wrapper.text()).toContain('2 nodes · 1 edges')
    expect(wrapper.text()).toContain('editable directly on the workflow canvas')
    expect(wrapper.text()).not.toContain('Open Loop Body')
    expect(wrapper.text()).not.toContain('Remove Loop')
    expect(wrapper.text()).not.toContain('Delete node')
  })

  it('keeps an invalid draft local', async () => {
    const wrapper = mount(WorkflowSidePanelHost, { props: { node: loop, edge: null, variables: [variable] } })
    await wrapper.findAll('input')[1]!.setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('updateLoop')).toBeUndefined()
    expect(wrapper.text()).toContain('positive integer')
  })
})
