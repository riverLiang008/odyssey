export interface DevelopmentSaveFaultController {
  failNextSave(): void
  clear(): void
}

declare global {
  interface Window {
    __ODYSSEY_ACCEPTANCE__?: DevelopmentSaveFaultController
  }
}

let pendingSaveFailures = 0

export function installDevelopmentSaveFaultController(): void {
  if (!import.meta.env.DEV) return
  globalThis.window.__ODYSSEY_ACCEPTANCE__ = {
    failNextSave() { pendingSaveFailures = 1 },
    clear() { pendingSaveFailures = 0 },
  }
}

export function consumeDevelopmentSaveFailure(): boolean {
  if (!import.meta.env.DEV || pendingSaveFailures === 0) return false
  pendingSaveFailures -= 1
  return true
}
