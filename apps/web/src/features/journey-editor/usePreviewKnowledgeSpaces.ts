import { computed, readonly, shallowRef, watch, type Ref } from 'vue'
import type { AgentWorkflowEditorDocument, LoopBodyGraph, UUID, WorkflowGraph } from '@odyssey/schemas'
import type { KnowledgeSpaceInventoryRepository } from '@/repositories'

type PreviewKnowledgeState = {
  type: 'idle' | 'loading' | 'ready' | 'error'
  labels: Readonly<Record<string, string>>
}

function referenceIds(graph: WorkflowGraph | LoopBodyGraph): UUID[] {
  return graph.nodes.flatMap(node => node.type === 'agent_action'
    ? node.config.knowledgeSpaceIds.filter((id): id is UUID => typeof id === 'string')
    : node.type === 'loop' ? referenceIds(node.config.body.graph) : [])
}

/** Read-only presentation metadata; never writes to the workflow or editor session. */
export function usePreviewKnowledgeSpaces(
  document: Readonly<Ref<AgentWorkflowEditorDocument | null>>,
  repository: Pick<KnowledgeSpaceInventoryRepository, 'loadKnowledgeSpace'>,
) {
  const state = shallowRef<PreviewKnowledgeState>({ type: 'idle', labels: {} })
  const retrySeq = shallowRef(0)
  const request = computed(() => ({
    agentId: document.value?.agent.id,
    ids: document.value ? [...new Set(referenceIds(document.value.workflow))] : [],
    retry: retrySeq.value,
  }))
  watch(request, async ({ ids }, _, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    if (!ids.length) { state.value = { type: 'idle', labels: {} }; return }
    state.value = { type: 'loading', labels: Object.fromEntries(ids.map(id => [id, 'Loading Knowledge Space…'])) }
    const results = await Promise.all(ids.map(async id => {
      try {
        return { id, result: await repository.loadKnowledgeSpace(id, { signal: controller.signal }) }
      } catch {
        return { id, result: { ok: false as const, error: { code: 'NETWORK_FAILED' as const } } }
      }
    }))
    if (controller.signal.aborted) return
    const labels: Record<string, string> = {}
    let failed = false
    for (const { id, result } of results) {
      if (result.ok && result.value.id === id) {
        labels[id] = result.value.lifecycleStatus === 'archived' ? `${result.value.name} (archived)` : result.value.name
      } else if (!result.ok && result.error.code === 'NOT_FOUND') {
        labels[id] = 'Unavailable Knowledge Space'
      } else {
        labels[id] = 'Knowledge Space details could not be loaded'
        failed = true
      }
    }
    state.value = { type: failed ? 'error' : 'ready', labels }
  }, { immediate: true })
  return { state: readonly(state), retry: () => { retrySeq.value += 1 } }
}
