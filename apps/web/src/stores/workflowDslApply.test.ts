import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createAgentWorkflowEditorDocumentFixture, createJourneyEditorDocumentFixture } from '@/fixtures'
import { InMemoryEditorRepository } from '@/repositories'
import { useWorkflowEditorStore } from './workflowEditor'
import { printWorkflowDsl } from '@/domain/workflow-dsl/printer'
import { compileDsl } from '@/domain/workflow-dsl/compiler'
import { uuidSchema, type AgentWorkflowExportDocument } from '@odyssey/schemas'

describe('DSL application transaction', () => {
  beforeEach(() => setActivePinia(createPinia()))
  async function setup() {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const repository = new InMemoryEditorRepository({ journeys: [createJourneyEditorDocumentFixture()], agentWorkflows: [document] })
    const store = useWorkflowEditorStore()
    await store.load(document.agent.journeyId, document.agent.id, repository)
    store.setResourceBrowserCategory('dsl-edit')
    return { store, document, repository }
  }
  it('commits once, retains the DSL panel/IDs and persists through save/reload', async () => {
    const { store, document, repository } = await setup()
    const knowledge = [{ id: document.reusableTools[0].kind === 'knowledge_retrieval' ? document.reusableTools[0].configuration.knowledgeSpaceId : uuidSchema.parse(crypto.randomUUID()), name: 'Docs' }]
    const printed = printWorkflowDsl(document, knowledge)
    const result = compileDsl(printed.source.replace('Research the requested topic.', 'Updated goal.'), { baseline: printed.baseline, inventory: { knowledge, ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()) })
    expect(result.status).toBe('checked')
    if (result.status !== 'checked') return
    const before = store.persistence.mutationSeq
    expect(store.applyCompiledWorkflow(result.document, before)).toEqual({ ok: true })
    expect(store.persistence.mutationSeq).toBe(before + 1)
    expect(store.session.panel?.type).toBe('dsl-edit')
    expect(store.session.resourceBrowser.collapsed).toBe(false)
    expect(store.document?.workflow.nodes.map((node) => node.id)).toEqual(document.workflow.nodes.map((node) => node.id))
    expect(await store.save(repository)).toBe(true)
    await store.load(document.agent.journeyId, document.agent.id, repository)
    expect(JSON.stringify(store.document?.workflow)).toContain('Updated goal.')
    store.dispose()
  })
  it('rejects stale, invalid, read-only, and changed End candidates without mutation', async () => {
    const { store, document } = await setup()
    const payload: AgentWorkflowExportDocument = { workflow: document.workflow, layout: document.layout, variables: document.variables, reusableTools: document.reusableTools }
    const before = JSON.stringify(store.document)
    const seq = store.persistence.mutationSeq
    expect(store.applyCompiledWorkflow(payload, seq + 1).ok).toBe(false)
    const invalid = structuredClone(payload)
    invalid.workflow.nodes = invalid.workflow.nodes.filter((node) => node.type !== 'end')
    expect(store.applyCompiledWorkflow(invalid, seq).ok).toBe(false)
    store.setMode('flow')
    expect(store.applyCompiledWorkflow(payload, seq).ok).toBe(false)
    expect(store.persistence.mutationSeq).toBe(seq)
    expect(JSON.stringify(store.document)).toBe(before)
    store.dispose()
  })
})
