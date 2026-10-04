import { shallowMount } from '@vue/test-utils'
import type { NodeProps } from '@vue-flow/core'
import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentActionNode, type BranchNode, type LoopNode, type TaskNode, type UUID, type WorkflowNode } from '@odyssey/schemas'
import type { WorkflowCanvasNodeData } from '@/canvas/workflow'
import WorkflowNodeRenderer from './WorkflowNodeRenderer.vue'

function id(value: number): UUID {
  return uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${value.toString().padStart(12, '0')}`)
}

const node: AgentActionNode = {
  id: id(1),
  type: 'agent_action',
  name: 'Review response',
  config: {
    model: 'gpt-5',
    goal: { kind: 'literal', value: 'Check the result' },
    knowledgeSpaceIds: [id(2)],
    reusableToolIds: [id(3), id(4)],
  },
}

function rendererProps(nodeInput: WorkflowNode, configureExpanded: boolean): NodeProps<WorkflowCanvasNodeData> & { configureExpanded: boolean } {
  const data: WorkflowCanvasNodeData = {
    node: nodeInput,
    branchHandles: nodeInput.type === 'branch'
      ? [...nodeInput.config.cases.map((branchCase) => ({ id: branchCase.id, label: branchCase.label })), { id: nodeInput.config.defaultCase.id, label: nodeInput.config.defaultCase.label }]
      : [],
  }
  return {
    id: nodeInput.id,
    type: 'workflow',
    data,
    selected: false,
    connectable: true,
    position: { x: 0, y: 0 },
    dimensions: { width: 154, height: 62 },
    dragging: false,
    resizing: false,
    zIndex: 0,
    events: {},
    configureExpanded,
  } as unknown as NodeProps<WorkflowCanvasNodeData> & { configureExpanded: boolean }
}

describe('WorkflowNodeRenderer', () => {
  it('shows canonical Agent Action configuration without requiring selection', () => {
    const tools = [
      { id: id(3), name: 'Web Search', kind: 'web_search', config: {} },
      { id: id(4), name: 'Read File', kind: 'read_file', config: {} },
    ] as never
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: { ...rendererProps(node, true), tools } })
    expect(wrapper.get<HTMLInputElement>(`#goal-${node.id}`).element.value).toBe('Check the result')
    expect(wrapper.get<HTMLSelectElement>(`#model-${node.id}`).element.value).toBe('gpt-5')
    expect(wrapper.get('.node-config-preview').text()).toContain('1 linked')
    expect(wrapper.get('.node-config-preview').text()).toContain('Web Search')
    expect(wrapper.get('.node-config-preview').text()).toContain('Read File')
  })

  it('emits an inline Agent Action configuration intent', async () => {
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(node, true) })
    expect(wrapper.get('.node-name-editor button').text()).toBe('AGENT ACTION · Review response')
    await wrapper.get('.node-name-editor button').trigger('click')
    await wrapper.get(`#name-${node.id}`).setValue('Research and synthesize')
    await wrapper.get(`#name-${node.id}`).trigger('blur')
    await wrapper.get(`#model-${node.id}`).setValue('gpt-4.1')
    await wrapper.get(`#goal-${node.id}`).setValue('Create a concise brief')
    expect(wrapper.emitted('updateAgentAction')).toEqual([
      [node.id, { name: 'Research and synthesize', model: 'gpt-5', goal: 'Check the result' }],
      [node.id, { name: 'Review response', model: 'gpt-4.1', goal: 'Check the result' }],
      [node.id, { name: 'Review response', model: 'gpt-5', goal: 'Create a concise brief' }],
    ])
  })

  it('keeps the compact card in Flow mode', () => {
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(node, false) })
    expect(wrapper.find('.node-config-preview').exists()).toBe(false)
  })

  it('expands Task, Branch, and Loop configuration summaries', () => {
    const task: TaskNode = { id: id(10), type: 'task', name: 'Publish brief', config: { localVariables: [], steps: [] } }
    const branch: BranchNode = { id: id(11), type: 'branch', name: 'Quality gate', config: { cases: [], defaultCase: { id: id(12), label: 'Continue' } } }
    const loop: LoopNode = {
      id: id(13), type: 'loop', name: 'Review loop', config: {
        maxTurns: 3,
        exitCondition: { kind: 'variable_comparison', variableId: id(14), operator: 'eq', value: true },
        body: { graph: { nodes: [], edges: [] }, layout: { nodePlacements: [], viewport: { x: 0, y: 0, zoom: 1 } } },
      },
    }

    expect(shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) }).get('.node-config-task').text()).toContain('Drop Tool')
    expect(shallowMount(WorkflowNodeRenderer, { props: rendererProps(branch, true) }).get('.node-config-branch').text()).toContain('Default route')
    expect(shallowMount(WorkflowNodeRenderer, { props: rendererProps(loop, true) }).get('.node-config-loop').text()).toContain('3')
  })

  it('exposes typed drop targets for Canvas-level resource drop coordination', () => {
    const action = shallowMount(WorkflowNodeRenderer, { props: rendererProps({ ...node, config: { ...node.config, reusableToolIds: [] } }, true) })
    expect(action.get('.is-toolbox').attributes()).toMatchObject({
      'data-workflow-resource-drop-target': 'agent-action-tools',
      'data-workflow-node-id': node.id,
    })

    const task: TaskNode = { id: id(21), type: 'task', name: 'Publish', config: { localVariables: [], steps: [] } }
    const taskWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) })
    expect(taskWrapper.get('.node-config-task').attributes()).toMatchObject({
      'data-workflow-resource-drop-target': 'task-tool-sequence',
      'data-workflow-node-id': task.id,
    })
  })

  it('consumes a Tool drop at the Toolbox boundary', async () => {
    const wrapper = shallowMount(WorkflowNodeRenderer, {
      props: {
        ...rendererProps({ ...node, config: { ...node.config, reusableToolIds: [] } }, true),
        activeResourceDrag: { kind: 'reusable-tool', resourceId: id(4) },
      },
    })
    const toolbox = wrapper.get('.is-toolbox')
    await toolbox.trigger('dragenter')
    await toolbox.trigger('drop')
    expect(wrapper.emitted('resourceEnter')?.[0]?.[1]).toEqual({ kind: 'agent-action-tools', nodeId: node.id })
    expect(wrapper.emitted('resourceDrop')?.[0]).toEqual([
      { kind: 'reusable-tool', resourceId: id(4) },
      { kind: 'agent-action-tools', nodeId: node.id },
    ])
  })

  it('renders a Tool chip when canonical node props update after a successful drop', async () => {
    const tool = { id: id(4), name: 'Read File', kind: 'read_file', config: {} } as never
    const initialNode = { ...node, config: { ...node.config, reusableToolIds: [] } }
    const wrapper = shallowMount(WorkflowNodeRenderer, {
      props: { ...rendererProps(initialNode, true), tools: [tool] },
    })
    expect(wrapper.find('.tool-chip').exists()).toBe(false)
    await wrapper.setProps({
      data: { node: { ...initialNode, config: { ...initialNode.config, reusableToolIds: [id(4)] } }, branchHandles: [] },
    })
    expect(wrapper.get('.tool-chip').text()).toContain('Read File')
  })
})
