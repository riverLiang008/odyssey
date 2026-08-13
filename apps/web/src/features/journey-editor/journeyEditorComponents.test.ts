import { mount } from '@vue/test-utils'
import { uuidSchema, type UUID } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import AgentLibrary from './AgentLibrary.vue'
import AgentSlot from './AgentSlot.vue'
import AgentSlotContextMenu from './AgentSlotContextMenu.vue'
import PatternTemplateLibrary from './PatternTemplateLibrary.vue'
import SystemCanvas from './SystemCanvas.vue'
import { saveAgentAsTemplate, type AgentLifecycleIdFactory } from '@/domain/agent-template'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'

const SLOT_ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-777777777777')

function factory(): AgentLifecycleIdFactory {
  let sequence = 300000
  const next = (): UUID => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${(sequence++).toString(16).padStart(12, '0')}`)
  return {
    agentId: next, agentTemplateId: next, workflowNodeId: next, workflowEdgeId: next,
    branchHandleId: next, branchConditionId: next, variableId: next, reusableToolId: next,
    toolStepId: next, configurationEntryId: next,
  }
}

describe('Journey editor presentational libraries', () => {
  it('shows the real Agent Template empty state and emits typed Template identity', async () => {
    const empty = mount(AgentLibrary, { props: { templates: [] } })
    expect(empty.text()).toContain('No Agent templates yet')
    expect(empty.text()).toContain('Save as Template')
    const saved = saveAgentAsTemplate(
      createAgentWorkflowEditorDocumentFixture('research'), SLOT_ID, 'Research Template', null,
      '2026-08-14T00:00:00Z', factory(),
    )
    if (!saved.ok) throw new Error(saved.error.code)
    const populated = mount(AgentLibrary, { props: { templates: [saved.value] } })
    await populated.get('button').trigger('click')
    expect(populated.emitted('choose')).toEqual([[saved.value.id]])
  })

  it('emits Pattern identity without deciding replacement behavior', async () => {
    const wrapper = mount(PatternTemplateLibrary)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('choose')?.[0]).toEqual(['hub_and_spoke'])
  })

  it('supports menu action, Escape close and initial keyboard focus', async () => {
    const opener = globalThis.document.createElement('button')
    globalThis.document.body.append(opener)
    opener.focus()
    const wrapper = mount(AgentSlotContextMenu, { props: { slotId: SLOT_ID }, attachTo: document.body })
    expect(document.activeElement).toBe(wrapper.get('button').element)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['open', SLOT_ID]])
    wrapper.get('.agent-menu').element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }))
    expect(wrapper.emitted('close')).toBeUndefined()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    expect(globalThis.document.activeElement).toBe(opener)
    opener.remove()
  })

  it('renders explicit Slot and diagnostic states and emits identity-only intents', async () => {
    const model = {
      kind: 'solo_component', name: 'Solo', routes: [],
      diagnostics: [{ code: 'AGENT_SUMMARY_MISSING', id: SLOT_ID }],
      slots: [{ id: SLOT_ID, label: 'Add agent', topologyRole: null, order: null,
        position: { x: 360, y: 210 }, agent: null, assignment: 'missing-summary',
        selected: true, canAssign: false, canReorder: false }],
    } as const
    const wrapper = mount(SystemCanvas, { props: { model } })
    expect(wrapper.text()).toContain('Agent unavailable')
    expect(wrapper.text()).toContain('Some canvas references are unavailable')
    await wrapper.get('.agent-slot').trigger('click')
    expect(wrapper.emitted('selectSlot')).toEqual([[SLOT_ID]])
  })

  it.each(['valid', 'invalid', 'occupied', 'duplicate', 'confirmation'] as const)(
    'maps %s feedback to a visible class and message', (tone) => {
      const model = { id: SLOT_ID, label: 'Agent Slot', topologyRole: null, order: null,
        position: { x: 0, y: 0 }, agent: null, assignment: 'empty', selected: false,
        canAssign: true, canReorder: false } as const
      const wrapper = mount(AgentSlot, { props: { model, feedback: { tone, message: `${tone} feedback` } } })
      expect(wrapper.classes()).toContain(`is-${tone}`)
      expect(wrapper.text()).toContain(`${tone} feedback`)
    },
  )

  it('announces configured, empty, missing-summary and disabled Slot states accurately', () => {
    const base = { id: SLOT_ID, label: 'Agent Slot', topologyRole: null, order: null,
      position: { x: 0, y: 0 }, selected: false, canReorder: false } as const
    const configured = mount(AgentSlot, { props: { model: { ...base,
      agent: { id: SLOT_ID, name: 'Research Agent', description: null, revision: 1,
        updatedAt: '2026-08-14T00:00:00.000Z' },
      assignment: 'configured', canAssign: false } } })
    expect(configured.get('button').attributes('aria-label')).toBe('Research Agent, configured')
    const empty = mount(AgentSlot, { props: { model: { ...base, agent: null, assignment: 'empty', canAssign: true } } })
    expect(empty.get('button').attributes('aria-label')).toBe('Agent Slot, empty slot')
    const missing = mount(AgentSlot, { props: { model: { ...base, agent: null, assignment: 'missing-summary', canAssign: false } } })
    expect(missing.get('button').attributes('aria-label')).toContain('Agent unavailable')
    const disabled = mount(AgentSlot, { props: { model: { ...base, agent: null, assignment: 'empty', canAssign: true }, disabled: true } })
    expect(disabled.get('button').attributes('aria-label')).toContain('disabled')
  })

  it('guards Slot intents when disabled and emits identity-only intents when enabled', async () => {
    const model = { id: SLOT_ID, label: 'Agent Slot', topologyRole: null, order: null,
      position: { x: 0, y: 0 }, agent: null, assignment: 'empty', selected: false,
      canAssign: true, canReorder: false } as const
    const disabled = mount(AgentSlot, { props: { model, disabled: true } })
    await disabled.get('button').trigger('click')
    await disabled.get('button').trigger('contextmenu')
    expect(disabled.emitted('select')).toBeUndefined()
    expect(disabled.emitted('menu')).toBeUndefined()

    const enabled = mount(AgentSlot, { props: { model } })
    await enabled.get('button').trigger('click')
    await enabled.get('button').trigger('contextmenu')
    expect(enabled.emitted('select')).toEqual([[SLOT_ID]])
    expect(enabled.emitted('menu')).toEqual([[SLOT_ID]])
  })
})
