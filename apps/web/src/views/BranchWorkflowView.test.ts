import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { editorRepositoryKey } from '@/app/editorRepository'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import { createAppRouter } from '@/router'
import { useWorkflowEditorStore } from '@/stores/workflowEditor'
import WorkflowNodePalette from '@/features/workflow-editor/WorkflowNodePalette.vue'
import AgentWorkflowView from './AgentWorkflowView.vue'

describe('Branch workflow view integration', () => {
  it('keeps new Case 1 as a UI draft until Create Branch and persists only valid configuration', async () => {
    const doc = createAgentWorkflowEditorDocumentFixture('minimal')
    const repo = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [doc] })
    const pinia = createPinia(), router = createAppRouter(createMemoryHistory())
    await router.push(`/journeys/${doc.agent.journeyId}/agents/${doc.agent.id}`); await router.isReady()
    const wrapper = mount(AgentWorkflowView, { global: { plugins: [pinia, router], provide: { [editorRepositoryKey]: repo }, stubs: { WorkflowCanvas: true } } })
    try {
      await flushPromises()
      const store = useWorkflowEditorStore(pinia), original = structuredClone(store.toSaveInput())
      wrapper.getComponent(WorkflowNodePalette).vm.$emit('create', 'branch'); await flushPromises()
      expect(wrapper.get('[aria-label="Case 1 name"]').element).toHaveProperty('value', 'Case 1')
      expect(store.toSaveInput()).toEqual(original)
      await wrapper.get('[aria-label^="Case 1 condition 1 left:"]').trigger('click')
      const variableOption = wrapper.findAll('[role="option"]').find(option => option.text().includes(doc.variables[0]?.displayName ?? ''))
      if (!variableOption) throw new Error('Expected variable option')
      await variableOption.trigger('click')
      await wrapper.get('[aria-label="Case 1 condition 1 right"]').setValue('3')
      await wrapper.get('.branch-panel form').trigger('submit'); await flushPromises()
      const created = store.document?.workflow.nodes.find(n => n.type === 'branch')
      expect(created).toMatchObject({ type: 'branch', config: { cases: [{ label: 'Case 1', match: 'all', conditions: [{ right: { kind: 'literal', value: 3 } }] }] } })
      expect(store.document?.workflow.nodes.filter(n => n.type !== 'branch')).toEqual(doc.workflow.nodes)
      expect(await store.save(repo)).toBe(true)
      expect(store.toSaveInput()).not.toHaveProperty('branchDraftCache')
      expect(wrapper.text()).not.toContain('New Branch draft')
      await wrapper.get('[aria-label="Delete Case 1"]').trigger('click'); await flushPromises()
      const dialog = globalThis.document.querySelector('.branch-confirmation')
      const button = dialog?.querySelector('button')
      if (!button || !created) throw new Error('Expected Branch confirmation')
      button.dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
      expect(store.document?.workflow.nodes.some(n => n.id === created.id)).toBe(true)
    } finally { wrapper.unmount() }
  })
})
