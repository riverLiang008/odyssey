import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fixture from '../../../../../packages/schemas/fixtures/runtime-bindings.json'
import { describe, expect, it } from 'vitest'
import { agentWorkflowEditorDocumentSchema, agentWorkflowExportDocumentSchema, uuidSchema } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { compileDsl } from './compiler'
import { printWorkflowDsl } from './printer'

const knowledge = [{ id: uuidSchema.parse(FIXTURE_IDS.knowledgeSpace), name: 'Product Docs' }]
function setup() {
  const document = createAgentWorkflowEditorDocumentFixture('research')
  document.workflow.schemaVersion = '1.2.0'
  const action = document.workflow.nodes.find(node => node.type === 'agent_action')
  if (!action || action.type !== 'agent_action') throw new Error('Missing action')
  action.config.knowledgeSpaceIds.push({ kind: 'system_knowledge_space', key: 'target_knowledge_space' })
  action.config.goal = { kind: 'template', segments: [{ kind: 'text', text: 'Read ' }, { kind: 'system', key: 'document_id' }] }
  const printed = printWorkflowDsl(document, knowledge)
  const context = { baseline: printed.baseline, inventory: { knowledge, ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()) }
  return { document, printed, context }
}
describe('runtime DSL bindings', () => {
  it('compiles the generic Document Curator fixture against only its fixed Playbook', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    document.reusableTools = []
    const knowledge = [{ id: uuidSchema.parse(FIXTURE_IDS.knowledgeSpace), name: 'Document Curator Playbook' }]
    const baseline = printWorkflowDsl(document, knowledge).baseline
    const source = readFileSync(resolve(process.cwd(), '../../doc/product/cases/second-case-document-curator/document-curator.ody'), 'utf8')
    const result = compileDsl(source, { baseline, inventory: { knowledge, ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()), allowIdentityReplacement: true })
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('checked')
    if (result.status === 'checked') expect(result.document.reusableTools).toHaveLength(1)
  })
  it('reuses an existing uniquely named Curator tool when a pasted case uses another alias', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const tool = document.reusableTools[0]
    if (!tool) throw new Error('Missing tool')
    tool.name = 'Find Related Game Documents'
    const knowledge = [{ id: uuidSchema.parse(FIXTURE_IDS.knowledgeSpace), name: 'Document Curator Playbook' }]
    const baseline = printWorkflowDsl(document, knowledge).baseline
    const source = readFileSync(resolve(process.cwd(), '../../doc/product/cases/second-case-document-curator/document-curator.ody'), 'utf8')
    const before = structuredClone(document)
    const result = compileDsl(source, { baseline, inventory: { knowledge, ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()), allowIdentityReplacement: true })
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('checked')
    if (result.status === 'checked') {
      expect(result.document.reusableTools).toHaveLength(1)
      expect(result.document.reusableTools[0]?.id).toBe(tool.id)
    }
    expect(document).toEqual(before)
  })
  it('still rejects two declarations of the same reusable tool name', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    document.reusableTools = []
    const baseline = printWorkflowDsl(document, []).baseline
    const tool = (alias: string) => `reusable_tool ${alias} using system_tool knowledge_retrieval {
      name "Search"; config { knowledgeSpaceId = $sys.target_knowledge_space$; }
      input_bindings []; output_binding none;
    }`
    const source = `workflow "Duplicates" version "0.2" { variables {} tools { ${tool('one')} ${tool('two')} } nodes { start; end; } edges {} }`
    const result = compileDsl(source, { baseline, inventory: { knowledge: [], ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()) })
    expect(result.diagnostics.some(issue => issue.code === 'ODSL503')).toBe(true)
    expect(result.status).toBe('invalid')
  })
  it('preserves tool identity and API header identity when its local alias changes', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const toolId = uuidSchema.parse(crypto.randomUUID())
    document.reusableTools = [{ id: toolId, name: 'Echo', kind: 'api_request', sourceTemplateId: null,
      configuration: { method: 'GET', url: { kind: 'literal', value: 'https://example.invalid' }, headers: [{ id: uuidSchema.parse(crypto.randomUUID()), name: 'Accept', value: { kind: 'literal', value: 'application/json' } }], body: { kind: 'none' } }, inputBindings: [], outputBinding: null }]
    const printed = printWorkflowDsl(document, [])
    const source = printed.source.replaceAll('tool_0_Echo', 'pasted_echo')
    const result = compileDsl(source, { baseline: printed.baseline, inventory: { knowledge: [], ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()) })
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('checked')
    if (result.status === 'checked') expect(result.document.reusableTools).toEqual(document.reusableTools)
  })
  it('rejects writes to read-only system inputs without changing the baseline', () => {
    const document = createAgentWorkflowEditorDocumentFixture('minimal')
    const baseline = printWorkflowDsl(document, []).baseline
    const before = structuredClone(document)
    const result = compileDsl(`workflow "Read only" version "0.2" {
      variables {}
      nodes { start; end; task "Write" { steps {
        step assign using system_tool set_variable {
          config { targetVariableId = $sys.document_id$; operation = assign; value = "x"; }
          on_failure fail_task;
        }
      } } }
      edges { start -> "Write"; "Write" -> end; }
    }`, { baseline, inventory: { knowledge: [], ready: true }, createId: () => uuidSchema.parse(crypto.randomUUID()), allowIdentityReplacement: true })
    expect(result.status).not.toBe('checked')
    expect(result.diagnostics.some(issue => issue.code === 'ODSL302')).toBe(true)
    expect(document).toEqual(before)
  })
  it('accepts the same canonical fixture as the Python boundary', () => {
    expect(agentWorkflowExportDocumentSchema.parse(fixture)).toEqual(fixture)
  })
  it('round trips fixed and system resources without resolving the runtime resource', () => {
    const { document, printed, context } = setup()
    expect(printed.source).toContain('version "0.2"')
    expect(printed.source).toContain('$sys.target_knowledge_space$')
    expect(printed.source).toContain('${sys.document_id}')
    const result = compileDsl(printed.source, context)
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status === 'checked') {
      expect(result.document.workflow).toEqual(document.workflow)
      expect(result.document.layout).toEqual(document.layout)
    }
  })
  it('rejects unknown and wrong-kind system resources at their source span', () => {
    const { printed, context } = setup()
    for (const key of ['missing', 'document_id']) {
      const source = printed.source.replace('$sys.target_knowledge_space$', `$sys.${key}$`)
      const result = compileDsl(source, context)
      expect(result.status).not.toBe('checked')
      const issue = result.diagnostics.find(issue => issue.code === 'ODSL206')
      expect(issue).toBeDefined()
      expect(source.slice(issue?.span.start, issue?.span.end)).toBe(`$sys.${key}$`)
    }
  })
  it('rejects system bindings in old canonical graphs and old DSL', () => {
    const { document, printed, context } = setup()
    expect(agentWorkflowEditorDocumentSchema.safeParse({ ...document, workflow: { ...document.workflow, schemaVersion: '1.1.0' } }).success).toBe(false)
    expect(compileDsl(printed.source.replace('version "0.2"', 'version "0.1"'), context).diagnostics.some(issue => issue.code === 'ODSL601')).toBe(true)
  })
})
