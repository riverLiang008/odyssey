import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAgentWorkflowEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures/editorFixtures'
import { createWorkflowExport, serializeWorkflowExport } from '@/domain/workflow-import/workflowImport'
import * as fileAdapter from './workflowImportFileAdapter'
import WorkflowImportDialog from './WorkflowImportDialog.vue'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mountDialog(saveStatus = 'saved') {
  return mount(WorkflowImportDialog, {
    attachTo: document.body,
    global: { stubs: { Teleport: true } },
    props: { availableKnowledgeSpaceIds: new Set<string>([FIXTURE_IDS.knowledgeSpace]), saveStatus, applyError: null },
  })
}

async function chooseValidFile(wrapper: ReturnType<typeof mountDialog>) {
  const exported = createWorkflowExport(createAgentWorkflowEditorDocumentFixture('minimal'), '2026-10-18T06:00:00.000Z')
  vi.spyOn(fileAdapter, 'readWorkflowImportFile').mockResolvedValue({
    ok: true,
    value: { fileName: 'demo.json', contents: serializeWorkflowExport(exported) },
  })
  const input = wrapper.get<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['{}'], 'demo.json', { type: 'application/json' })] })
  await input.trigger('change')
  await flushPromises()
}

describe('WorkflowImportDialog', () => {
  it('previews a validated workflow and emits one destructive apply intent', async () => {
    const wrapper = mountDialog()
    await chooseValidFile(wrapper)

    expect(wrapper.text()).toContain('Planner Agent')
    expect(wrapper.text()).toContain('2 nodes · 1 edges')
    const confirm = wrapper.get('button.is-danger')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')

    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('blocks confirmation during a save', async () => {
    const wrapper = mountDialog('saving')
    await chooseValidFile(wrapper)

    expect(wrapper.text()).toContain('Wait for the current save')
    expect(wrapper.get('button.is-danger').attributes('disabled')).toBeDefined()
  })

  it('shows validation failure without emitting apply', async () => {
    vi.spyOn(fileAdapter, 'readWorkflowImportFile').mockResolvedValue({ ok: true, value: { fileName: 'bad.json', contents: '{' } })
    const wrapper = mountDialog()
    const input = wrapper.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['{'], 'bad.json')] })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('does not contain valid JSON')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
})
