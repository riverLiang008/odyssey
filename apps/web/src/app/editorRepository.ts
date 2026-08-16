import { inject, type InjectionKey } from 'vue'

import type { OdysseyEditorRepository } from '@/repositories'
import { HttpEditorRepository } from '@/repositories'

export const editorRepositoryKey: InjectionKey<OdysseyEditorRepository> = Symbol('editorRepository')

export function useEditorRepository(): OdysseyEditorRepository {
  const repository = inject(editorRepositoryKey)
  if (!repository) throw new Error('EditorRepository provider is missing')
  return repository
}

export function createEditorRepository(): OdysseyEditorRepository {
  return new HttpEditorRepository({ baseUrl: import.meta.env.VITE_API_BASE_URL })
}
