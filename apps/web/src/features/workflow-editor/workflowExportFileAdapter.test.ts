import { describe, expect, it, vi } from 'vitest'

import { downloadWorkflowJson, type WorkflowDownloadEnvironment } from './workflowExportFileAdapter'

function environment(overrides: Partial<WorkflowDownloadEnvironment> = {}) {
  const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  const value: WorkflowDownloadEnvironment = {
    createObjectUrl: vi.fn(() => 'blob:workflow'),
    revokeObjectUrl: vi.fn(),
    createAnchor: vi.fn(() => anchor),
    ...overrides,
  }
  return { anchor, value }
}

describe('downloadWorkflowJson', () => {
  it('downloads the JSON and always releases the object URL', () => {
    const fixture = environment()

    expect(downloadWorkflowJson('workflow.json', '{"ok":true}', fixture.value)).toEqual({ ok: true })
    expect(fixture.anchor.href).toBe('blob:workflow')
    expect(fixture.anchor.download).toBe('workflow.json')
    expect(fixture.anchor.click).toHaveBeenCalledOnce()
    expect(fixture.anchor.remove).toHaveBeenCalledOnce()
    expect(fixture.value.revokeObjectUrl).toHaveBeenCalledWith('blob:workflow')
  })

  it('returns a stable error when the browser download fails', () => {
    const fixture = environment({ createAnchor: () => { throw new Error('blocked') } })

    expect(downloadWorkflowJson('workflow.json', '{}', fixture.value)).toEqual({
      ok: false,
      error: { code: 'DOWNLOAD_FAILED' },
    })
    expect(fixture.value.revokeObjectUrl).toHaveBeenCalledWith('blob:workflow')
  })
})
