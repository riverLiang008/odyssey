export interface WorkflowDownloadAnchor {
  href: string
  download: string
  click(): void
  remove(): void
}

export interface WorkflowDownloadEnvironment {
  createObjectUrl(blob: Blob): string
  revokeObjectUrl(url: string): void
  createAnchor(): WorkflowDownloadAnchor
}

export type WorkflowDownloadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly code: 'DOWNLOAD_FAILED' } }

function browserDownloadEnvironment(): WorkflowDownloadEnvironment {
  return {
    createObjectUrl: (blob) => globalThis.URL.createObjectURL(blob),
    revokeObjectUrl: (url) => globalThis.URL.revokeObjectURL(url),
    createAnchor: () => globalThis.document.createElement('a'),
  }
}

export function downloadWorkflowJson(
  fileName: string,
  contents: string,
  environment: WorkflowDownloadEnvironment = browserDownloadEnvironment(),
): WorkflowDownloadResult {
  let objectUrl: string | null = null
  let anchor: WorkflowDownloadAnchor | null = null
  try {
    objectUrl = environment.createObjectUrl(new Blob([contents], { type: 'application/json;charset=utf-8' }))
    anchor = environment.createAnchor()
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.click()
    return { ok: true }
  } catch {
    return { ok: false, error: { code: 'DOWNLOAD_FAILED' } }
  } finally {
    anchor?.remove()
    if (objectUrl) environment.revokeObjectUrl(objectUrl)
  }
}
