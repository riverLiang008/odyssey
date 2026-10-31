import { shallowMount } from '@vue/test-utils'
import type { NodeProps } from '@vue-flow/core'
import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentActionNode, type BranchNode, type KnowledgeSpaceSummary, type LoopBodyNode, type LoopNode, type TaskNode, type UUID, type WorkflowNode } from '@odyssey/schemas'
import type { WorkflowCanvasNodeData } from '@/canvas/workflow'
import BranchNodeContent from './BranchNodeContent.vue'
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
const knowledgeSpace: KnowledgeSpaceSummary = {
  id: id(2),
  name: 'Product knowledge',
  description: null,
  category: { id: id(20), name: 'Research', colorToken: null, sortOrder: 0, isDefault: true },
  lifecycleStatus: 'ready',
  graphStatus: 'healthy',
  fileCount: 2,
  knowledgeFamilyCount: 1,
  openIssueCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

function rendererProps(nodeInput: WorkflowNode | LoopBodyNode, configureExpanded: boolean): NodeProps<WorkflowCanvasNodeData> & { configureExpanded: boolean } {
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
  it('keeps Toolbox inspection clickable while disabling inline mutations in read-only mode', async () => {
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: { ...rendererProps(node, true), readOnly: true } })
    await wrapper.get('.is-toolbox .tool-chip button[title]').trigger('click')
    expect(wrapper.emitted('editReusableTool')).toEqual([[node.id, id(3)]])
    expect(wrapper.get('.is-toolbox button[aria-label^="Remove"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.node-model-select-trigger').attributes('disabled')).toBeDefined()
    expect(wrapper.get(`#goal-${node.id}`).attributes('readonly')).toBeDefined()
    await wrapper.get(`#goal-${node.id}`).trigger('change')
    expect(wrapper.emitted('updateAgentAction')).toBeUndefined()
    wrapper.unmount()
  })
  it('shows canonical Agent Action configuration without requiring selection', () => {
    const tools = [
      { id: id(3), name: 'Web Search', kind: 'web_search', config: {} },
      { id: id(4), name: 'Read File', kind: 'read_file', config: {} },
    ] as never
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: { ...rendererProps(node, true), tools, knowledgeSpaces: [knowledgeSpace] } })
    expect(wrapper.get<HTMLInputElement>(`#goal-${node.id}`).element.value).toBe('Check the result')
    expect(wrapper.get(`#model-${node.id}`).text()).toContain('gpt-5')
    expect(wrapper.get('.node-config-preview').text()).toContain('Product knowledge')
    expect(wrapper.get('.node-config-preview').text()).toContain('Web Search')
    expect(wrapper.get('.node-config-preview').text()).toContain('Read File')
  })

  it('emits an inline Agent Action configuration intent', async () => {
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(node, true) })
    expect(wrapper.get('.node-name-editor button').text()).toBe('AGENT ACTION · Review response')
    await wrapper.get('.node-name-editor button').trigger('click')
    await wrapper.get(`#name-${node.id}`).setValue('Research and synthesize')
    await wrapper.get(`#name-${node.id}`).trigger('blur')
    await wrapper.get(`#model-${node.id}`).trigger('click')
    const modelOptions = wrapper.findAll('[role="option"]')
    await modelOptions.find((option) => option.text().includes('gpt-4.1'))?.trigger('click')
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

  it('renders protected boundaries as semantic terminal pills', () => {
    const start: WorkflowNode = { id: id(6), type: 'start', name: 'Start', config: {} }
    const end: WorkflowNode = { id: id(7), type: 'end', name: 'End', config: {} }
    const loopStart: LoopBodyNode = { id: id(8), type: 'loop_start', name: 'Loop Start', config: {} }

    const startWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(start, false) })
    const endWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(end, false) })
    const loopStartWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(loopStart, false) })

    expect(startWrapper.get('.boundary-copy').text()).toBe('Start')
    expect(endWrapper.get('.boundary-copy').text()).toBe('End')
    expect(loopStartWrapper.get('.boundary-copy').text()).toBe('Start')
    expect(startWrapper.find('.boundary-symbol').exists()).toBe(true)
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
    expect(shallowMount(WorkflowNodeRenderer, { props: rendererProps(branch, true) }).getComponent(BranchNodeContent).props('node')).toEqual(branch)
    expect(shallowMount(WorkflowNodeRenderer, { props: rendererProps(loop, true) }).get('.node-config-loop').text()).toContain('3')
  })

  it('keeps a visible drop affordance after a Task already has a Tool step', () => {
    const task: TaskNode = {
      id: id(40),
      type: 'task',
      name: 'Publish',
      config: {
        localVariables: [],
        steps: [{
          id: id(41),
          kind: 'script_execution',
          label: 'Prepare result',
          configuration: { language: 'javascript', script: 'return 1' },
          outputMapping: null,
          failureBehavior: { kind: 'fail_task' },
        }],
      },
    }
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) })

    expect(wrapper.findAll('.task-tool-step')).toHaveLength(1)
    expect(wrapper.get('.task-tool-drop-zone').text()).toContain('add another step')
    expect(wrapper.get('.node-config-task').attributes('data-workflow-resource-drop-target')).toBe('task-tool-sequence')
  })

  it('emits a Task Tool step context-menu intent', async () => {
    const task: TaskNode = {
      id: id(42), type: 'task', name: 'Publish', config: { localVariables: [], steps: [{
        id: id(43), kind: 'script_execution', label: 'Prepare result', configuration: { language: 'javascript', script: 'return 1' }, outputMapping: null, failureBehavior: { kind: 'fail_task' },
      }] },
    }
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) })
    await wrapper.get('.task-tool-step-open').trigger('contextmenu', { clientX: 320, clientY: 180 })
    expect(wrapper.emitted('toolStepContextMenu')).toEqual([[task.id, id(43), { x: 320, y: 180 }]])
  })

  it('emits a stable-identity reorder intent when a Task step is dragged', async () => {
    const first = { id: id(44), kind: 'script_execution' as const, label: 'First', configuration: { language: 'javascript' as const, script: 'return 1' }, outputMapping: null, failureBehavior: { kind: 'fail_task' as const } }
    const second = { ...first, id: id(45), label: 'Second' }
    const task: TaskNode = { id: id(46), type: 'task', name: 'Publish', config: { localVariables: [], steps: [first, second] } }
    const wrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) })
    const transfer = { effectAllowed: '', dropEffect: '', setData: () => undefined }
    const rows = wrapper.findAll('.task-tool-step')
    await rows[0]!.get('[aria-label="Drag to reorder step"]').trigger('dragstart', { dataTransfer: transfer })
    await rows[1]!.trigger('dragover', { dataTransfer: transfer, clientY: 10 })
    await rows[1]!.trigger('drop', { dataTransfer: transfer, clientY: 10 })
    expect(wrapper.emitted('reorderTool')).toEqual([[task.id, first.id, 1]])
  })

  it('edits Task and Branch names inline', async () => {
    const task: TaskNode = { id: id(30), type: 'task', name: 'New Task', config: { localVariables: [], steps: [] } }
    const taskWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) })
    expect(taskWrapper.get('.node-name-editor button').text()).toBe('TASK · New Task')
    await taskWrapper.get('.node-name-editor button').trigger('click')
    await taskWrapper.get(`#name-${task.id}`).setValue('Publish brief')
    await taskWrapper.get(`#name-${task.id}`).trigger('blur')
    expect(taskWrapper.emitted('updateNodeName')).toEqual([[task.id, 'Publish brief']])

    const branch: BranchNode = { id: id(31), type: 'branch', name: 'New Branch', config: { cases: [], defaultCase: { id: id(32), label: 'Default' } } }
    const branchWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(branch, true) })
    branchWrapper.getComponent(BranchNodeContent).vm.$emit('rename', 'Quality gate')
    expect(branchWrapper.emitted('updateNodeName')).toEqual([[branch.id, 'Quality gate']])
  })

  it('edits a compound Loop name inline in Configure mode', async () => {
    const loop: LoopNode = {
      id: id(33), type: 'loop', name: 'New Loop', config: {
        maxTurns: 3,
        exitCondition: { kind: 'variable_comparison', variableId: id(34), operator: 'eq', value: true },
        body: { graph: { nodes: [], edges: [] }, layout: { nodePlacements: [], viewport: { x: 0, y: 0, zoom: 1 } } },
      },
    }
    const props = rendererProps(loop, true)
    const wrapper = shallowMount(WorkflowNodeRenderer, {
      props: { ...props, data: { ...props.data, compoundLoop: true } },
    })

    await wrapper.get('[aria-label="Edit loop name"]').trigger('click')
    await wrapper.get(`#name-${loop.id}`).setValue('Research iteration')
    await wrapper.get(`#name-${loop.id}`).trigger('blur')

    expect(wrapper.emitted('updateNodeName')).toEqual([[loop.id, 'Research iteration']])
  })

  it('exposes typed drop targets for Canvas-level resource drop coordination', () => {
    const action = shallowMount(WorkflowNodeRenderer, { props: rendererProps({ ...node, config: { ...node.config, reusableToolIds: [] } }, true) })
    expect(action.get('.is-toolbox').attributes()).toMatchObject({
      'data-workflow-resource-drop-target': 'agent-action-tools',
      'data-workflow-node-id': node.id,
    })
    expect(action.get('.is-knowledge-spaces').attributes()).toMatchObject({
      'data-workflow-resource-drop-target': 'agent-action-knowledge-spaces',
      'data-workflow-node-id': node.id,
    })

    const task: TaskNode = { id: id(21), type: 'task', name: 'Publish', config: { localVariables: [], steps: [] } }
    const taskWrapper = shallowMount(WorkflowNodeRenderer, { props: rendererProps(task, true) })
    expect(taskWrapper.get('.node-config-task').attributes()).toMatchObject({
      'data-workflow-resource-drop-target': 'task-tool-sequence',
      'data-workflow-node-id': task.id,
    })
  })

  it('consumes a Knowledge Space drop at the Knowledge Spaces boundary', async () => {
    const actionWithoutKnowledge = { ...node, config: { ...node.config, knowledgeSpaceIds: [] } }
    const wrapper = shallowMount(WorkflowNodeRenderer, {
      props: {
        ...rendererProps(actionWithoutKnowledge, true),
        activeResourceDrag: { kind: 'knowledge-space', resourceId: knowledgeSpace.id },
      },
    })
    const target = wrapper.get('.is-knowledge-spaces')
    await target.trigger('dragenter')
    await target.trigger('drop')
    expect(wrapper.emitted('resourceEnter')?.[0]?.[1]).toEqual({ kind: 'agent-action-knowledge-spaces', nodeId: node.id })
    expect(wrapper.emitted('resourceDrop')?.[0]).toEqual([
      { kind: 'knowledge-space', resourceId: knowledgeSpace.id },
      { kind: 'agent-action-knowledge-spaces', nodeId: node.id },
    ])
  })

  it('renders and removes a bound Knowledge Space chip', async () => {
    const wrapper = shallowMount(WorkflowNodeRenderer, {
      props: { ...rendererProps(node, true), knowledgeSpaces: [knowledgeSpace] },
    })
    expect(wrapper.get('.knowledge-space-chip').text()).toContain('Product knowledge')
    await wrapper.get('.knowledge-space-chip button').trigger('click')
    expect(wrapper.emitted('unbindKnowledgeSpace')).toEqual([[node.id, knowledgeSpace.id]])
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
    expect(wrapper.find('.is-toolbox .tool-chip').exists()).toBe(false)
    await wrapper.setProps({
      data: { node: { ...initialNode, config: { ...initialNode.config, reusableToolIds: [id(4)] } }, branchHandles: [] },
    })
    expect(wrapper.get('.is-toolbox .tool-chip').text()).toContain('Read File')
  })
})
