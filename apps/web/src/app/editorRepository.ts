import { inject, type InjectionKey } from 'vue'

import {
  createAgentWorkflowEditorDocumentFixture,
  createJourneyEditorDocumentFixture,
} from '@/fixtures'
import type { EditorRepository } from '@/repositories'
import { InMemoryEditorRepository } from '@/repositories'

export const editorRepositoryKey: InjectionKey<EditorRepository> = Symbol('editorRepository')

export function useEditorRepository(): EditorRepository {
  const repository = inject(editorRepositoryKey)
  if (!repository) throw new Error('EditorRepository provider is missing')
  return repository
}

export function createEditorRepository(): EditorRepository {
  return new InMemoryEditorRepository({
    journeys: [createJourneyEditorDocumentFixture()],
    agentWorkflows: [
      createAgentWorkflowEditorDocumentFixture('research'),
      createAgentWorkflowEditorDocumentFixture('minimal'),
      createAgentWorkflowEditorDocumentFixture('loop'),
    ],
  })
}
