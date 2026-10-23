import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createAgentWorkflowEditorDocumentFixture, FIXTURE_IDS } from '@/fixtures/editorFixtures'
import {
  createWorkflowExport,
  parseWorkflowImportJson,
  serializeWorkflowExport,
  workflowExportFileName,
} from './workflowImport'

const exportedAt = '2026-10-18T06:00:00.000Z'

describe('workflow JSON import/export', () => {
  it('round-trips a canonical document without identity revision or UI state', () => {
    const source = createAgentWorkflowEditorDocumentFixture('research')
    const exported = createWorkflowExport(source, exportedAt)
    const json = serializeWorkflowExport(exported)
    const result = parseWorkflowImportJson(json, { availableKnowledgeSpaceIds: new Set([FIXTURE_IDS.knowledgeSpace]) })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.document).toEqual({
      workflow: source.workflow,
      layout: source.layout,
      variables: source.variables,
      reusableTools: source.reusableTools,
    })
    expect(json).not.toContain('"revision"')
    expect(json.endsWith('\n')).toBe(true)
    expect(result.summary).toMatchObject({ sourceAgentName: 'Research Agent', rootNodeCount: 5, variableCount: 1, reusableToolCount: 1, knowledgeSpaceCount: 1 })
  })

  it('rejects malformed JSON and unsupported envelopes without mutation', () => {
    expect(parseWorkflowImportJson('{', { availableKnowledgeSpaceIds: new Set() })).toMatchObject({ ok: false, error: { code: 'JSON_INVALID' } })
    expect(parseWorkflowImportJson(JSON.stringify({ kind: 'odyssey.agent-workflow', formatVersion: 2 }), { availableKnowledgeSpaceIds: new Set() })).toMatchObject({ ok: false, error: { code: 'EXPORT_SCHEMA_INVALID' } })
  })

  it('rejects missing Knowledge Space references', () => {
    const exported = createWorkflowExport(createAgentWorkflowEditorDocumentFixture('research'), exportedAt)
    const result = parseWorkflowImportJson(serializeWorkflowExport(exported), { availableKnowledgeSpaceIds: new Set() })

    expect(result).toMatchObject({ ok: false, error: { code: 'REFERENCE_MISSING' } })
  })

  it('does not mutate the source and creates a safe deterministic filename', () => {
    const source = createAgentWorkflowEditorDocumentFixture('minimal')
    const before = structuredClone(source)
    createWorkflowExport(source, exportedAt)

    expect(source).toEqual(before)
    expect(workflowExportFileName('Demo / Agent?', '2026-10-18')).toBe('odyssey-workflow-demo-agent-2026-10-18.json')
  })

  it('keeps the checked-in Demo export compatible with the import contract', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/fixtures/agent-workflow-export-demo.json'), 'utf8')

    expect(parseWorkflowImportJson(source, { availableKnowledgeSpaceIds: new Set() }).ok).toBe(true)
  })
})
