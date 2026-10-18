<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentReusableTool, UUID } from '@odyssey/schemas'
import { serializeWorkflowResourceDragPayload, WORKFLOW_RESOURCE_DRAG_MIME, type WorkflowResourceDragPayload } from '@/canvas/workflow'

const props = defineProps<{
  agentName: string
  tools: readonly AgentReusableTool[]
  readOnly?: boolean
  referenceCount: (toolId: UUID) => number
}>()
const emit = defineEmits<{
  collapse: []
  edit: [toolId: UUID]
  delete: [toolId: UUID]
  browseSystemTools: []
  resourceDragStart: [payload: WorkflowResourceDragPayload]
  resourceDragEnd: []
}>()
const query = ref('')
const filteredTools = computed(() => props.tools.filter((tool) => `${tool.name} ${tool.kind}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const kindLabel = (kind: string) => kind.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function startDrag(event: globalThis.DragEvent, toolId: UUID) {
  if (props.readOnly || !event.dataTransfer) return
  const serialized = serializeWorkflowResourceDragPayload(toolId, 'reusable-tool')
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(WORKFLOW_RESOURCE_DRAG_MIME, serialized)
  event.dataTransfer.setData('text/plain', serialized)
  emit('resourceDragStart', { kind: 'reusable-tool', resourceId: toolId })
}
</script>

<template>
  <aside class="workflow-resource-browser reusable-tools-panel" aria-label="Reusable Tools">
    <header><div><p class="workflow-eyebrow">RESOURCES</p><h2>Reusable Tools</h2></div><button type="button" class="resource-browser-collapse" @click="emit('collapse')">Collapse</button></header>
    <p class="reusable-tools-subtitle">Saved within {{ agentName }} · drag to create an instance</p>
    <form class="resource-browser-search" role="search" @submit.prevent><input v-model="query" placeholder="Search reusable tools…" aria-label="Search reusable tools" /><span aria-hidden="true">⌕</span></form>
    <button type="button" class="reusable-tools-create" :disabled="readOnly" @click="emit('browseSystemTools')">＋ Create from System Tools</button>
    <h3 class="reusable-tools-heading">SAVED IN THIS AGENT</h3>
    <div class="reusable-tools-list">
      <p v-if="!filteredTools.length" class="resource-browser-empty">{{ tools.length ? 'No matching reusable Tools.' : 'No reusable Tools saved in this Agent yet.' }}</p>
      <article v-for="tool in filteredTools" :key="tool.id" :draggable="!readOnly" @dragstart="startDrag($event, tool.id)" @dragend="emit('resourceDragEnd')">
        <i aria-hidden="true" /><span class="reusable-tool-copy"><strong>{{ tool.name }}</strong><small>{{ kindLabel(tool.kind) }}</small><small>Independent snapshot when dropped into a Task</small></span>
        <span class="reusable-tool-uses">{{ referenceCount(tool.id) }} {{ referenceCount(tool.id) === 1 ? 'use' : 'uses' }}</span>
        <div class="reusable-tool-actions"><button type="button" :disabled="readOnly" @click="emit('edit', tool.id)">Edit</button><button type="button" :disabled="readOnly || referenceCount(tool.id) > 0" :title="referenceCount(tool.id) > 0 ? 'Remove Agent Action references before deleting' : 'Delete reusable Tool'" @click="emit('delete', tool.id)">Delete</button><span aria-hidden="true">⠿</span></div>
      </article>
    </div>
    <p class="resource-browser-hint">Drop into an Agent Action to reference this Tool. Drop into a Task to create an independently editable snapshot.</p>
  </aside>
</template>

<style scoped>
.reusable-tools-panel { gap: 12px; }
.reusable-tools-subtitle { margin: -8px 0 0; padding-bottom: 12px; border-bottom: 1px solid #d9e2f2; color: #60708c; font-size: 10px; line-height: 15px; }
.resource-browser-search { flex-shrink: 0; }
.resource-browser-search span { display: grid; width: 34px; place-items: center; color: #60708c; }
.reusable-tools-create { min-height: 36px; border: 1px solid #4d72f2; border-radius: 7px; background: #ebf0ff; color: #4d72f2; cursor: pointer; }
.reusable-tools-create:disabled { opacity: .5; cursor: not-allowed; }
.reusable-tools-heading { margin: 2px 0 0; color: #60708c; font-size: 10px; font-weight: 500; letter-spacing: .04em; }
.reusable-tools-list { min-height: 0; display: grid; align-content: start; gap: 10px; overflow-y: auto; }
.reusable-tools-list article { min-height: 86px; padding: 11px 12px; border: 1px solid #d9e2f2; border-radius: 8px; background: #f4f7fc; display: grid; grid-template-columns: 9px minmax(0, 1fr) auto; grid-template-rows: 1fr auto; gap: 5px 9px; cursor: grab; }
.reusable-tools-list article:hover { border-color: #91a8ef; background: #f3f6ff; }
.reusable-tools-list i { width: 9px; height: 9px; margin-top: 5px; border-radius: 50%; background: #4d72f2; }
.reusable-tool-copy { min-width: 0; }
.reusable-tool-copy strong,.reusable-tool-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reusable-tool-copy strong { color: #22304a; font-size: 13px; line-height: 18px; }
.reusable-tool-copy small { color: #60708c; font-size: 10px; line-height: 15px; }
.reusable-tool-uses { color: #4d72f2; font-size: 10px; line-height: 18px; }
.reusable-tool-actions { grid-column: 2 / 4; display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.reusable-tool-actions button { padding: 2px 6px; border: 0; background: transparent; color: #4d72f2; font-size: 10px; cursor: pointer; }
.reusable-tool-actions button:disabled { color: #9aa6ba; cursor: not-allowed; }
.reusable-tool-actions span { color: #60708c; }
</style>
