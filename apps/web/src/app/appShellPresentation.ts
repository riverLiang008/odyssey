import type { InjectionKey } from 'vue'

export interface AppShellPresentation {
  setFocusMode(enabled: boolean): void
  setProductHeaderVisible(visible: boolean): void
}

export const appShellPresentationKey: InjectionKey<AppShellPresentation> = Symbol('app-shell-presentation')
