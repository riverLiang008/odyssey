export const WORKFLOW_IMPORT_MAX_BYTES = 5 * 1024 * 1024

export type WorkflowImportFileErrorCode = 'FILE_TYPE_UNSUPPORTED' | 'FILE_TOO_LARGE' | 'FILE_READ_FAILED'

export type WorkflowImportFileResult =
  | { readonly ok: true; readonly value: { readonly fileName: string; readonly contents: string } }
  | { readonly ok: false; readonly error: { readonly code: WorkflowImportFileErrorCode } }

export interface WorkflowImportFile {
  readonly name: string
  readonly size: number
  text(): Promise<string>
}

export async function readWorkflowImportFile(file: WorkflowImportFile): Promise<WorkflowImportFileResult> {
  if (!file.name.toLowerCase().endsWith('.json')) return { ok: false, error: { code: 'FILE_TYPE_UNSUPPORTED' } }
  if (file.size > WORKFLOW_IMPORT_MAX_BYTES) return { ok: false, error: { code: 'FILE_TOO_LARGE' } }
  try {
    return { ok: true, value: { fileName: file.name, contents: await file.text() } }
  } catch {
    return { ok: false, error: { code: 'FILE_READ_FAILED' } }
  }
}
