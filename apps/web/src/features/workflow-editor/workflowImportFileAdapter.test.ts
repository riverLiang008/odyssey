import { describe, expect, it } from 'vitest'

import { readWorkflowImportFile, WORKFLOW_IMPORT_MAX_BYTES } from './workflowImportFileAdapter'

describe('readWorkflowImportFile', () => {
  it('reads a JSON file', async () => {
    await expect(readWorkflowImportFile({ name: 'workflow.JSON', size: 12, text: async () => '{"ok":true}' })).resolves.toEqual({
      ok: true,
      value: { fileName: 'workflow.JSON', contents: '{"ok":true}' },
    })
  })

  it('rejects unsupported and oversized files before reading', async () => {
    await expect(readWorkflowImportFile({ name: 'workflow.txt', size: 1, text: async () => '' })).resolves.toMatchObject({ ok: false, error: { code: 'FILE_TYPE_UNSUPPORTED' } })
    await expect(readWorkflowImportFile({ name: 'workflow.json', size: WORKFLOW_IMPORT_MAX_BYTES + 1, text: async () => '' })).resolves.toMatchObject({ ok: false, error: { code: 'FILE_TOO_LARGE' } })
  })

  it('maps file read failures to a stable error', async () => {
    await expect(readWorkflowImportFile({ name: 'workflow.json', size: 1, text: async () => { throw new Error('denied') } })).resolves.toMatchObject({ ok: false, error: { code: 'FILE_READ_FAILED' } })
  })
})
