<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRaw } from 'vue'
import type { JourneyEditorDocument, AgentWorkflowEditorDocument, RepositoryError, UUID } from '@odyssey/schemas'

import { createWorkflowPreviewViewModel } from '@/canvas/workflow-preview'
import WorkflowPreviewCanvas from './WorkflowPreviewCanvas.vue'

const props = defineProps<{
  journey?: JourneyEditorDocument
  agentId: UUID
  agentName: string
  status: 'loading' | 'ready' | 'error'
  document: AgentWorkflowEditorDocument | null
  error: RepositoryError | null
  knowledgeSpaceLabels?: Readonly<Record<string, string>>
  knowledgeStatus?: 'idle' | 'loading' | 'ready' | 'error'
}>()
const emit = defineEmits<{ close: []; open: [agentId: UUID]; retry: []; retryKnowledge: [] }>()
const model = computed(() => props.document ? createWorkflowPreviewViewModel(toRaw(props.document), props.journey) : null)

function keydown(event: globalThis.KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
onMounted(() => globalThis.document.addEventListener('keydown', keydown))
onBeforeUnmount(() => globalThis.document.removeEventListener('keydown', keydown))
</script>

<template>
  <aside class="workflow-preview" aria-label="Read-only Workflow Preview">
    <header class="workflow-preview__header">
      <div><small>WORKFLOW PREVIEW</small><strong>{{ agentName }}</strong></div>
      <span class="workflow-preview__readonly">Read only</span>
      <button type="button" class="workflow-preview__open" :disabled="status !== 'ready'" aria-label="Open canvas" @click="emit('open', agentId)">↗</button>
      <button type="button" class="workflow-preview__close" aria-label="Close Workflow Preview" @click="emit('close')">×</button>
    </header>
    <p v-if="model && knowledgeStatus === 'loading'" class="workflow-preview__status" role="status">Loading Knowledge Space details…</p>
    <p v-else-if="model && knowledgeStatus === 'error'" class="workflow-preview__status is-error" role="alert">Some Knowledge Space details could not be loaded. <button type="button" @click="emit('retryKnowledge')">Retry Knowledge Spaces</button></p>
    <div class="workflow-preview__body">
      <p v-if="status === 'loading'" class="workflow-preview__status" role="status">Loading Workflow…</p>
      <div v-else-if="status === 'error'" class="workflow-preview__status is-error" role="alert">
        <strong>Workflow unavailable</strong><span>{{ error?.code ?? 'UNKNOWN_ERROR' }}</span><button type="button" @click="emit('retry')">Retry</button>
      </div>
      <template v-else-if="model">
        <WorkflowPreviewCanvas :key="model.agentId" :model="model" :knowledge-space-labels="knowledgeSpaceLabels" />
      </template>
      <p v-else class="workflow-preview__status">No Workflow topology available.</p>
    </div>
    <footer v-if="model" class="workflow-preview__footer"><span>{{ model.nodes.length }} nodes · {{ model.edges.length }} edges</span><span v-if="model.diagnostics.length">Some items unavailable</span></footer>
  </aside>
</template>
