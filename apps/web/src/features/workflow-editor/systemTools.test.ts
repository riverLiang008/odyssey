import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { toolStepSchema, uuidSchema, type TaskNode } from '@odyssey/schemas'
import fixtures from '../../../../../packages/schemas/fixtures/system-tools.json'
import SystemToolPanel from './SystemToolPanel.vue'
import WorkflowResourceBrowser from './WorkflowResourceBrowser.vue'
const id = (n: number) => uuidSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const task: TaskNode = { id: id(1), name: 'Task', type: 'task', config: { steps: [], localVariables: [{ id: id(2), key: 'output', dataType: 'json', defaultValue: null }] } }
describe('System Tool configuration UI', () => {
  it.each(fixtures.valid)('opens and saves $kind through canonical parsing', async (input) => {
    const step = toolStepSchema.parse(input)
    const wrapper = mount(SystemToolPanel, { props: { draft: { context: { kind: 'root' }, nodeId: task.id, kind: step.kind, step }, task, variables: [], knowledgeSpaces: [], knowledgeStatus: 'ready', error: null } })
    await wrapper.get('form').trigger('submit')
    const saved = wrapper.emitted('save')?.[0]?.[0]
    expect(saved).toEqual(step)
    await wrapper.get('button[aria-label="Close Tool configuration"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.find('button[disabled]').text()).toContain('New Task Variable')
  })
  it.each(['loading', 'empty', 'error', 'loaded'] as const)('renders inventory %s', (status) => {
    const tools = status === 'loaded' ? [{ id: id(5), kind: 'llm_call' as const, source: 'built_in' as const, name: 'LLM Call', category: 'Intelligence', description: 'Run one inference', configurationSchema: {}, inputSchema: {}, outputSchema: {} }] : []
    const wrapper = mount(WorkflowResourceBrowser, { props: { collapsed: false, category: 'tools', query: '', page: 1, pageSize: 6, tools: [], knowledgeSpaces: [], knowledgeStatus: 'ready', knowledgeTotal: 0, systemTools: tools, systemToolStatus: status } })
    expect(wrapper.text()).toContain(status === 'loading' ? 'Loading System Tools' : status === 'error' ? 'System Tools could not be loaded' : status === 'empty' ? 'No matching System Tools' : 'Run one inference')
  })
})
