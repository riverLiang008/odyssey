import { effectScope, nextTick, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { uuidSchema, type AgentWorkflowEditorDocument, type KnowledgeSpaceDetail, type RepositoryResult } from '@odyssey/schemas'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'
import { usePreviewKnowledgeSpaces } from './usePreviewKnowledgeSpaces'

const spaceId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8890')
const detail = (name = 'Research Library'): KnowledgeSpaceDetail => ({
  id: spaceId, name, description: null,
  category: { id: spaceId, name: 'Research', colorToken: null, sortOrder: 0, isDefault: true },
  lifecycleStatus: 'ready', graphStatus: 'healthy', fileCount: 1, knowledgeFamilyCount: 1, openIssueCount: 0,
  createdAt: '2026-10-26T00:00:00Z', updatedAt: '2026-10-26T00:00:00Z', rootFolderId: spaceId,
  revision: 1, lastDocumentIndexedAt: null, lastStewardRunAt: null,
})
const loader = () => vi.fn<() => Promise<RepositoryResult<KnowledgeSpaceDetail>>>()

describe('Preview Knowledge Space metadata', () => {
  it('resolves root and Loop references once without mutating the document', async () => {
    const document = shallowRef<AgentWorkflowEditorDocument | null>(createAgentWorkflowEditorDocumentFixture('loop'))
    const action = createAgentWorkflowEditorDocumentFixture('research').workflow.nodes.find(node => node.type === 'agent_action')
    if (!document.value || !action) throw new Error('Fixture requires Action')
    document.value.workflow.nodes.push(action)
    const before = structuredClone(document.value)
    const loadKnowledgeSpace = loader().mockResolvedValue({ ok: true, value: detail() })
    const scope = effectScope()
    const preview = scope.run(() => usePreviewKnowledgeSpaces(document, { loadKnowledgeSpace }))
    try {
      expect(preview?.state.value.type).toBe('loading')
      expect(preview?.state.value.labels[spaceId]).toContain('Loading')
      await flushPromises()
      expect(loadKnowledgeSpace).toHaveBeenCalledTimes(1)
      expect(preview?.state.value).toEqual({ type: 'ready', labels: { [spaceId]: 'Research Library' } })
      expect(document.value).toEqual(before)
    } finally { scope.stop() }
  })

  it('distinguishes transport failure from missing resources and supports retry', async () => {
    const document = shallowRef(createAgentWorkflowEditorDocumentFixture('research'))
    const loadKnowledgeSpace = loader().mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_FAILED' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'NOT_FOUND' } })
      .mockResolvedValueOnce({ ok: true, value: { ...detail(), lifecycleStatus: 'archived' } })
    const scope = effectScope()
    const preview = scope.run(() => usePreviewKnowledgeSpaces(document, { loadKnowledgeSpace }))
    try {
      await flushPromises()
      expect(preview?.state.value.type).toBe('error')
      expect(preview?.state.value.labels[spaceId]).toBe('Knowledge Space details could not be loaded')
      preview?.retry(); await flushPromises()
      expect(preview?.state.value.labels[spaceId]).toBe('Unavailable Knowledge Space')
      preview?.retry(); await flushPromises()
      expect(preview?.state.value.labels[spaceId]).toBe('Research Library (archived)')
    } finally { scope.stop() }
  })

  it('ignores a late result after switching Agent and aborts on close', async () => {
    const document = shallowRef<AgentWorkflowEditorDocument | null>(createAgentWorkflowEditorDocumentFixture('research'))
    let resolveOld: ((value: RepositoryResult<KnowledgeSpaceDetail>) => void) | undefined
    const loadKnowledgeSpace = vi.fn((_: typeof spaceId, options?: { signal?: AbortSignal }) => {
      if (loadKnowledgeSpace.mock.calls.length === 1) {
        oldSignal = options?.signal
        return new Promise<RepositoryResult<KnowledgeSpaceDetail>>(resolve => { resolveOld = resolve })
      }
      return Promise.resolve<RepositoryResult<KnowledgeSpaceDetail>>({ ok: true, value: detail('New metadata') })
    })
    let oldSignal: AbortSignal | undefined
    const scope = effectScope()
    const preview = scope.run(() => usePreviewKnowledgeSpaces(document, { loadKnowledgeSpace }))
    try {
      const next = createAgentWorkflowEditorDocumentFixture('research')
      next.agent.id = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f9999')
      document.value = next
      await flushPromises()
      expect(oldSignal?.aborted).toBe(true)
      resolveOld?.({ ok: true, value: detail('Stale metadata') })
      await flushPromises()
      expect(preview?.state.value.labels[spaceId]).toBe('New metadata')
      document.value = null
      await nextTick()
      expect(preview?.state.value).toEqual({ type: 'idle', labels: {} })
    } finally { scope.stop() }
  })
})
