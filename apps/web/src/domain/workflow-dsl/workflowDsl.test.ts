import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { uuidSchema, toolStepSchema } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures'
import { compileDsl } from './compiler'
import { printWorkflowDsl } from './printer'
import { normalizeDslName, parseDsl, sourcePosition } from './syntax'

const knowledge = [{ id: uuidSchema.parse(FIXTURE_IDS.knowledgeSpace), name: 'Product Docs' }]
function setup(kind: 'minimal' | 'research' | 'loop' = 'minimal') {
  const document = createAgentWorkflowEditorDocumentFixture(kind)
  const printed = printWorkflowDsl(document, knowledge)
  return { document, printed, context: { inventory: { knowledge, ready: true }, baseline: printed.baseline, createId: () => uuidSchema.parse(crypto.randomUUID()) } }
}
describe('Workflow DSL', () => {
  it('prints default boundaries as statements and accepts their existing block forms', () => {
    for (const kind of ['minimal', 'loop'] as const) {
      const { printed, document, context } = setup(kind)
      expect(printed.source).toContain('start;')
      expect(printed.source).toContain('end;')
      if (kind === 'loop') {
        expect(printed.source).toContain('loop_start;')
        expect(printed.source).toContain('loop_end;')
      }
      const expanded = printed.source.replace(/\b(start|end|loop_start|loop_end);/g, (_, type: string) => `${type} {}`)
      for (const source of [printed.source, expanded]) {
        const result = compileDsl(source, context)
        expect(result.status).toBe('checked')
        if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
      }
    }
  })
  it('preserves custom boundary names by printing their full declarations', () => {
    const { document, context } = setup()
    document.workflow.nodes[0].name = 'Begin here'
    document.workflow.nodes[1].name = 'Finish here'
    const printed = printWorkflowDsl(document, knowledge)
    expect(printed.source).toContain('start "Begin here" {')
    expect(printed.source).toContain('end "Finish here" {')
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
  })
  it('rejects duplicate, named-statement and out-of-scope shorthand boundaries', () => {
    const { context, printed } = setup()
    for (const extra of ['start;', 'end;', 'start "Other";', 'loop_start;', 'loop_end;', 'task;']) {
      const result = compileDsl(printed.source.replace('nodes {', `nodes { ${extra}`), context)
      expect(result.status, extra).toBe('invalid')
    }
  })
  it('prints named cases and preserves case IDs, conditions and edges on rename', () => {
    const { document, printed, context } = setup('research')
    const branch = document.workflow.nodes.find((node) => node.type === 'branch')
    if (!branch || branch.type !== 'branch') throw new Error('Branch fixture required')
    const first = branch.config.cases[0]
    if (!first) throw new Error('Case fixture required')
    expect(printed.source).toContain(`case ${JSON.stringify(first.label)} {`)
    const source = printed.source.replaceAll(JSON.stringify(first.label), '"通过审核"')
    const result = compileDsl(source, context)
    expect(result.status).toBe('checked')
    if (result.status === 'checked') {
      const updated = result.document.workflow.nodes.find((node) => node.id === branch.id)
      expect(updated?.type === 'branch' && updated.config.cases[0]).toEqual({ ...first, label: '通过审核' })
      expect(result.document.workflow.edges).toEqual(document.workflow.edges)
    }
  })
  it('distinguishes a case named default from the Default outlet and rejects case aliases', () => {
    const { document, context } = setup('research')
    const branch = document.workflow.nodes.find((node) => node.type === 'branch')
    if (!branch || branch.type !== 'branch' || !branch.config.cases[0]) throw new Error('Branch fixture required')
    branch.config.cases[0].label = 'default'
    const caseEdge = document.workflow.edges.find((edge) => edge.sourceHandleId === branch.config.cases[0]?.id)
    const defaultEdge = document.workflow.edges.find((edge) => edge.sourceHandleId === branch.config.defaultCase.id)
    if (caseEdge && defaultEdge) defaultEdge.targetNodeId = caseEdge.targetNodeId
    const printed = printWorkflowDsl(document, knowledge)
    expect(printed.source).toContain('."default" ->')
    expect(printed.source).toContain('.default ->')
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
    for (const source of [printed.source.replace('case "default"', 'case old "default"'), printed.source.replace('case "default"', 'case old'), printed.source.replace('."default" ->', '.old ->')]) expect(compileDsl(source, { ...context, baseline: printed.baseline }).status).toBe('invalid')
    const duplicate = printed.source.replace('default "', 'case " default " { when true == true; } default "')
    expect(compileDsl(duplicate, { ...context, baseline: printed.baseline }).diagnostics.some((entry) => entry.code === 'ODSL201')).toBe(true)
  })
  it('keeps root and Loop presentation out of DSL and rejects authored layout', () => {
    const { printed, context } = setup('loop')
    expect(printed.source).not.toMatch(/\blayout\s*\{|\bviewport\s*\(/)
    for (const source of [printed.source.replace('variables {', 'layout { viewport (0, 0, 1); } variables {'), printed.source.replace('max_turns', 'layout {} max_turns')]) {
      const result = compileDsl(source, context)
      expect(result.status).toBe('invalid')
      expect(result.diagnostics.some((entry) => entry.code === 'ODSL102')).toBe(true)
    }
  })
  it('prints and compiles the existing minimum document without changing IDs or layout', () => {
    const { document, printed, context } = setup()
    const result = compileDsl(printed.source, context)
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document).toEqual({ workflow: document.workflow, layout: document.layout, variables: document.variables, reusableTools: document.reusableTools })
  })
  it('prints and compiles a configured workflow', () => {
    const { printed, context, document } = setup('research')
    const result = compileDsl(printed.source, context)
    expect(result.diagnostics).toEqual([])
    if (result.status === 'checked') expect(result.document).toEqual({ workflow: document.workflow, layout: document.layout, variables: document.variables, reusableTools: document.reusableTools })
    expect(result.status).toBe('checked')
  })
  it('rejects malformed syntax and unknown variables without modifying the baseline', () => {
    const { printed, context } = setup()
    const before = JSON.stringify(context.baseline.document)
    const result = compileDsl(printed.source.replace('nodes {', 'nodes { agent_action "research" { model "gpt-5"; goal "${agent.missing}"; }'), context)
    expect(result.status).toBe('invalid')
    expect(result.diagnostics.some((entry) => entry.code === 'ODSL202')).toBe(true)
    expect(JSON.stringify(context.baseline.document)).toBe(before)
    const broken = parseDsl('workflow "x" version "0.1" { nodes { task a { steps {')
    expect(broken.diagnostics.some((entry) => entry.code === 'ODSL101')).toBe(true)
  })
  it('supports Branch and Loop authored examples', () => {
    for (const file of ['02-branch.ody', '03-loop.ody']) {
      const { context } = setup()
      const source = readFileSync(resolve(process.cwd(), '../../doc/planning/implementation/DSL/examples', file), 'utf8')
      const result = compileDsl(source, { ...context, allowIdentityReplacement: true })
      expect(result.diagnostics, file).toEqual([])
      expect(result.status).toBe('checked')
    }
  })
  it('retains Canvas for incomplete strings and diagnoses invalid escapes', () => {
    expect(parseDsl('goal "open\nnext;').diagnostics.some((entry) => entry.code === 'ODSL002')).toBe(true)
    expect(parseDsl('goal "bad\\q";').diagnostics.some((entry) => entry.code === 'ODSL003')).toBe(true)
    expect(parseDsl('/* open').diagnostics.some((entry) => entry.code === 'ODSL004')).toBe(true)
  })
  it('uses NFC and preserves case; reports raw UTF-16 locations', () => {
    expect(normalizeDslName(' e\u0301 ')).toBe('é')
    expect(normalizeDslName('Docs')).not.toBe(normalizeDslName('docs'))
    expect(sourcePosition('abc\r\nx', 5)).toEqual({ offset: 5, line: 2, column: 1 })
  })
  it('round-trips the existing Loop fixture with its embedded layout and handles', () => {
    const { printed, context, document } = setup('loop')
    const result = compileDsl(printed.source, context)
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document).toEqual({ workflow: document.workflow, layout: document.layout, variables: document.variables, reusableTools: document.reusableTools })
  })
  it('round-trips all five System Tool configs, step labels and header/form IDs', () => {
    const { document, context } = setup('research')
    const newId = () => uuidSchema.parse(crypto.randomUUID())
    const target = { ...document.variables[0], id: newId(), key: 'tool_result' }
    document.variables.push(target)
    target.ownership = 'shared'
    target.dataType = 'json'
    const task = document.workflow.nodes.find((node) => node.type === 'task')
    if (!task || task.type !== 'task') throw new Error('Task fixture required')
    const literal = (value: string) => ({ kind: 'literal', value })
    const configurations = [
      { kind: 'knowledge_retrieval', configuration: { knowledgeSpaceId: knowledge[0].id, query: literal('query'), topK: 3 }, outputMapping: { sourceKey: 'retrieved_documents', targetVariableId: target.id } },
      { kind: 'script_execution', configuration: { language: 'javascript', script: 'return input;', inputs: [{ alias: 'input', variableId: target.id }] }, outputMapping: { sourceKey: 'result', targetVariableId: target.id } },
      { kind: 'api_request', configuration: { method: 'POST', url: literal('https://example.invalid'), headers: [{ id: newId(), name: 'Accept', value: literal('json') }], body: { kind: 'form_data', entries: [{ id: newId(), name: 'item', value: { kind: 'variable', variableId: target.id } }] } }, outputMapping: { sourceKey: 'response.data', targetVariableId: target.id } },
      { kind: 'set_variable', configuration: { targetVariableId: target.id, operation: 'assign', value: { kind: 'literal', value: { a: ['x', true, 2] } } }, outputMapping: null },
      { kind: 'llm_call', configuration: { model: 'gpt-5', prompt: literal('Show ${literal} verbatim.'), systemPrompt: literal('System') }, outputMapping: { sourceKey: 'response.text', targetVariableId: target.id } },
    ]
    task.config.steps = configurations.map((entry) => toolStepSchema.parse({ ...entry, id: newId(), label: 'Custom label', failureBehavior: { kind: 'retry', maxAttempts: 2 } }))
    const printed = printWorkflowDsl(document, knowledge)
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.diagnostics).toEqual([])
    if (result.status === 'checked') expect(result.document).toEqual({ workflow: document.workflow, layout: document.layout, variables: document.variables, reusableTools: document.reusableTools })
    expect(result.status).toBe('checked')
  })
  it('preserves non-identifier Variable keys through explicit key metadata', () => {
    const { document, context } = setup()
    document.variables[0].key = '用户主题'
    const printed = printWorkflowDsl(document, knowledge)
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.diagnostics).toEqual([])
    if (result.status === 'checked') expect(result.document.variables).toEqual(document.variables)
  })
  it('keeps invalid references, cycles and ambiguous resources from producing a candidate', () => {
    const { printed, context } = setup('research')
    for (const source of [printed.source.replace('Product Docs', 'Missing'), printed.source.replace('edges {', 'edges { end -> start;')]) {
      const result = compileDsl(source, context)
      expect(result.status).toBe('invalid')
    }
    const result = compileDsl(printed.source, { ...context, inventory: { ready: true, knowledge: [...knowledge, { id: uuidSchema.parse(crypto.randomUUID()), name: ' Product Docs ' }] } })
    expect(result.diagnostics.some((entry) => entry.code === 'ODSL502')).toBe(true)
    expect(result.status).toBe('invalid')
  })
  it('compiles the Research and named-exit examples using explicit target context', () => {
    for (const file of ['01-research.ody', '04-named-exits.ody']) {
      const { document, context } = setup()
      document.reusableTools[0].name = 'Product Lookup'
      if (file === '04-named-exits.ody') {
        const end = document.workflow.nodes.find((node) => node.type === 'end')
        if (!end || end.type !== 'end') throw new Error('End fixture required')
        end.name = 'Accepted'
        document.workflow.nodes.push({ ...structuredClone(end), id: uuidSchema.parse(crypto.randomUUID()), name: 'Rejected' })
      }
      const printed = printWorkflowDsl(document, knowledge)
      const source = readFileSync(resolve(process.cwd(), '../../doc/planning/implementation/DSL/examples', file), 'utf8')
      const result = compileDsl(source, { ...context, baseline: printed.baseline, allowIdentityReplacement: true })
      expect(result.diagnostics, file).toEqual([])
      expect(result.status).toBe('checked')
    }
  })
  it('renames an unchanged node while retaining its UUID, edges and presentation', () => {
    const { context, printed, document } = setup('research')
    const original = document.workflow.nodes.find((node) => node.type === 'agent_action')
    if (!original) throw new Error('Action fixture required')
    const source = printed.source.replaceAll(JSON.stringify(original.name), JSON.stringify('调研 / "新名称"'))
    const result = compileDsl(source, context)
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status !== 'checked') return
    expect(result.document.workflow.nodes.find((node) => node.id === original.id)?.name).toBe('调研 / "新名称"')
    expect(result.document.workflow.edges).toEqual(document.workflow.edges)
    expect(result.document.layout).toEqual(document.layout)
  })
  it('rejects duplicate normalized names, old aliases, inner name fields and bare node references', () => {
    const { context, printed } = setup('research')
    for (const source of [
      printed.source.replace('nodes {', 'nodes { agent_action " e\u0301 " { model "gpt-5"; goal "x"; } agent_action "é" { model "gpt-5"; goal "x"; }'),
      printed.source.replace(/agent_action "[^"\n]+"/, 'agent_action research'),
      printed.source.replace(/model "[^"]+";/, 'name "Other"; model "gpt-5";'),
      printed.source.replace('edges {', 'edges { start -> research;'),
    ]) {
      const result = compileDsl(source, context)
      expect(result.status).toBe('invalid')
      expect(result.diagnostics.some((entry) => ['ODSL102', 'ODSL201'].includes(entry.code))).toBe(true)
    }
  })
  it('distinguishes quoted reserved names from implicit boundaries', () => {
    const { document, context } = setup('research')
    const action = document.workflow.nodes.find((node) => node.type === 'agent_action')
    if (!action) throw new Error('Action fixture required')
    action.name = 'start'
    const printed = printWorkflowDsl(document, knowledge)
    expect(printed.source).toContain('start -> "start";')
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
  })
  it('allows the same name in root and Loop scopes, including escaped Unicode names', () => {
    const { document, context } = setup('loop')
    const loop = document.workflow.nodes.find((node) => node.type === 'loop')
    if (!loop || loop.type !== 'loop') throw new Error('Loop fixture required')
    const action = loop.config.body.graph.nodes.find((node) => node.type === 'agent_action')
    if (!action) throw new Error('Action fixture required')
    loop.name = action.name = '调研 / "步骤"'
    const printed = printWorkflowDsl(document, knowledge)
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
  })
  it('retains Task and Loop descendants when only their owning node is renamed', () => {
    for (const kind of ['research', 'loop'] as const) {
      const { context, printed, document } = setup(kind)
      const target = document.workflow.nodes.find((node) => node.type === (kind === 'loop' ? 'loop' : 'task'))
      if (!target) throw new Error('Fixture node required')
      const source = printed.source.replaceAll(JSON.stringify(target.name), '"Renamed owner"')
      const result = compileDsl(source, context)
      expect(result.diagnostics).toEqual([])
      expect(result.status).toBe('checked')
      if (result.status === 'checked') {
        expect(result.document.workflow.nodes.find((node) => node.id === target.id)).toEqual({ ...target, name: 'Renamed owner' })
        expect(result.document.workflow.edges).toEqual(document.workflow.edges)
      }
    }
  })
  it('resolves normalized references while preserving original names and diagnostic spans', () => {
    const { document, context } = setup('research')
    const action = document.workflow.nodes.find((node) => node.type === 'agent_action')
    if (!action) throw new Error('Action fixture required')
    action.name = ' e\u0301 '
    const printed = printWorkflowDsl(document, knowledge)
    const source = printed.source.replace('start -> " e\u0301 ";', 'start -> "é";')
    const result = compileDsl(source, { ...context, baseline: printed.baseline })
    expect(result.diagnostics).toEqual([])
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
    const invalid = source.replace('agent_action " e\u0301 "', 'agent_action "   "')
    const error = compileDsl(invalid, { ...context, baseline: printed.baseline }).diagnostics.find((item) => item.code === 'ODSL508')
    expect(error).toBeDefined()
    if (error) expect(invalid.slice(error.span.start, error.span.end)).toBe('"   "')
    action.name = '\ud800'
    expect(() => printWorkflowDsl(document, knowledge)).not.toThrow()
  })
  it('round-trips multiple Pattern-owned Ends using names and fixed exits', () => {
    const { document, context } = setup()
    const end = document.workflow.nodes.find((node) => node.type === 'end')
    if (!end || end.type !== 'end') throw new Error('End fixture required')
    end.name = 'Accepted'
    document.workflow.nodes.push({ ...structuredClone(end), id: uuidSchema.parse(crypto.randomUUID()), name: 'Rejected' })
    const printed = printWorkflowDsl(document, knowledge)
    expect(printed.source).toContain('end "Accepted" {')
    expect(printed.source).toContain('start -> "Accepted";')
    const result = compileDsl(printed.source, { ...context, baseline: printed.baseline })
    expect(result.status).toBe('checked')
    if (result.status === 'checked') expect(result.document.workflow).toEqual(document.workflow)
  })
  it('blocks ambiguous renames until explicitly reviewed', () => {
    const { context, printed, document } = setup('research')
    const action = document.workflow.nodes.find((node) => node.type === 'agent_action')
    if (!action) throw new Error('Action fixture required')
    const source = printed.source.replaceAll(JSON.stringify(action.name), '"Renamed"').replace('Research the requested topic.', 'Changed at the same time.')
    const blocked = compileDsl(source, context)
    expect(blocked.status).toBe('context-required')
    expect(blocked.diagnostics.some((entry) => entry.code === 'ODSL507')).toBe(true)
    expect(compileDsl(source, { ...context, allowIdentityReplacement: true }).status).toBe('checked')
  })
  it('returns diagnostics for truncated editing states without throwing or mutating context', () => {
    const { printed, context } = setup('loop')
    const snapshot = JSON.stringify(context.baseline.document)
    for (let offset = 0; offset < printed.source.length; offset += 17) {
      expect(() => compileDsl(printed.source.slice(0, offset), context)).not.toThrow()
    }
    expect(JSON.stringify(context.baseline.document)).toBe(snapshot)
  })
})

