import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { parseWorkflowNodeDragPayload, WORKFLOW_NODE_DRAG_MIME } from '@/canvas/workflow'
import WorkflowNodePalette from './WorkflowNodePalette.vue'

describe('WorkflowNodePalette', () => {
  it('writes the typed payload to both the Odyssey and text drag channels', async () => {
    const values = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: 'none',
      setData(type: string, value: string) { values.set(type, value) },
    }
    const wrapper = mount(WorkflowNodePalette)
    const task = wrapper.get('button.is-task')
    await task.trigger('dragstart', { dataTransfer })
    expect(dataTransfer.effectAllowed).toBe('copy')
    expect(parseWorkflowNodeDragPayload(values.get(WORKFLOW_NODE_DRAG_MIME) ?? '')).toEqual({ kind: 'workflow-node-template', nodeType: 'task' })
    expect(values.get('text/plain')).toBe(values.get(WORKFLOW_NODE_DRAG_MIME))
  })

  it('keeps click creation as a keyboard-accessible equivalent path', async () => {
    const wrapper = mount(WorkflowNodePalette)
    await wrapper.get('button.is-branch').trigger('click')
    expect(wrapper.emitted('create')).toEqual([['branch']])
  })

  it('enables Agent Action and gates Loop creation on its explicit prerequisite', async () => {
    const wrapper = mount(WorkflowNodePalette, { props: { canCreateLoop: false, loopDisabledReason: 'Create an Agent Variable first' } })
    expect(wrapper.get('button.is-agent_action').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button.is-loop').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.is-loop').text()).toContain('Create an Agent Variable first')
    await wrapper.setProps({ canCreateLoop: true })
    await wrapper.get('button.is-loop').trigger('click')
    expect(wrapper.emitted('create')).toEqual([['loop']])
  })

  it('emits a pointer drop after crossing the drag threshold without also clicking', async () => {
    const wrapper = mount(WorkflowNodePalette)
    const task = wrapper.get('button.is-task')
    await task.trigger('pointerdown', { button: 0, clientX: 20, clientY: 20 })
    globalThis.window.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 70 }))
    globalThis.window.dispatchEvent(new MouseEvent('pointerup', { clientX: 240, clientY: 210 }))
    await task.trigger('click')
    expect(wrapper.emitted('drop')).toEqual([['task', { clientX: 240, clientY: 210 }]])
    expect(wrapper.emitted('create')).toBeUndefined()
  })

  it('becomes read-only when Flow view disables authoring', () => {
    const wrapper = mount(WorkflowNodePalette, { props: { disabled: true } })
    expect(wrapper.classes()).toContain('is-read-only-mode')
    expect(wrapper.get('button.is-agent_action').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.is-task').attributes('disabled')).toBeDefined()
  })

  it('keeps the Figma-style Nodes rail available while collapsed', async () => {
    const wrapper = mount(WorkflowNodePalette, { props: { collapsed: true } })
    expect(wrapper.classes()).toContain('is-collapsed')
    expect(wrapper.find('.palette-group').exists()).toBe(false)
    expect(wrapper.findAll('.compact-palette-item')).toHaveLength(4)
    expect(wrapper.get('.compact-palette-item.is-branch').attributes('data-tooltip')).toBe('Branch')
    expect(wrapper.get('.palette-collapse').attributes('aria-label')).toBe('Expand Workflow nodes')
    await wrapper.get('.compact-palette-item.is-task').trigger('click')
    expect(wrapper.emitted('create')).toEqual([['task']])
    await wrapper.get('.palette-collapse').trigger('click')
    expect(wrapper.emitted('collapse')).toEqual([[false]])
  })
})
