import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { demoAgents } from './demoData'
import { createDemoRepository } from './demoRepository'
import { useWorkflowEditorStore } from '@/stores/workflowEditor'
import SystemToolPanel from '@/features/workflow-editor/SystemToolPanel.vue'
import AgentReusableToolPanel from '@/features/workflow-editor/AgentReusableToolPanel.vue'

describe('Read-only tool inspection', () => {
  it.each(demoAgents)('opens existing Task and Toolbox configuration for $agent.journeyId without changing data', async agent => {
    setActivePinia(createPinia())
    const store=useWorkflowEditorStore()
    await store.load(agent.agent.journeyId,agent.agent.id,createDemoRepository())
    store.setMode('configure')
    const before=store.toSaveInput()
    for(const node of agent.workflow.nodes) {
      if(node.type==='task') for(const step of node.config.steps) {
        expect(store.editSystemTool({kind:'root'},node.id,step.id)).toBe(true)
        const draft=store.systemToolDraft
        if(draft?.host!=='task')throw new Error('Missing Task configuration')
        const wrapper=mount(SystemToolPanel,{props:{draft,task:node,variables:agent.variables,knowledgeSpaces:[],knowledgeStatus:'ready',error:null,readOnly:true}})
        expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
        expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
        await wrapper.get('form').trigger('submit')
        expect(wrapper.emitted('save')).toBeUndefined()
        await wrapper.get('[aria-label="Close Tool configuration"]').trigger('click')
        expect(wrapper.emitted('cancel')).toHaveLength(1)
        wrapper.unmount()
      }
      if(node.type==='agent_action')for(const toolId of node.config.reusableToolIds) {
        expect(store.editAgentReusableTool({kind:'root'},node.id,toolId)).toBe(true)
        const draft=store.systemToolDraft
        if(draft?.host!=='agent-action')throw new Error('Missing Toolbox configuration')
        const wrapper=mount(AgentReusableToolPanel,{props:{draft,variables:agent.variables,knowledgeSpaces:[],knowledgeStatus:'ready',readOnly:true}})
        expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
        await wrapper.get('form').trigger('submit')
        expect(wrapper.emitted('save')).toBeUndefined()
        wrapper.unmount()
      }
    }
    expect(store.toSaveInput()).toEqual(before)
    expect(store.hasUnsavedChanges).toBe(false)
    store.dispose()
  })
})
