<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SystemToolDefinition, AgentReusableTool, KnowledgeSpaceSummary, UUID } from '@odyssey/schemas'
import { serializeWorkflowResourceDragPayload, WORKFLOW_RESOURCE_DRAG_MIME } from '@/canvas/workflow'
import type { WorkflowResourceDragPayload } from '@/canvas/workflow'
import type { KnowledgeInventoryStatus, WorkflowResourceCategory } from '@/stores/workflowEditor'

const props = defineProps<{
  systemTools?: readonly SystemToolDefinition[]
  systemToolStatus?: 'loading' | 'empty' | 'error' | 'loaded'
  collapsed: boolean
  category: WorkflowResourceCategory
  query: string
  page: number
  pageSize: number
  tools: readonly AgentReusableTool[]
  knowledgeSpaces: readonly KnowledgeSpaceSummary[]
  knowledgeStatus: KnowledgeInventoryStatus
  knowledgeTotal: number
  readOnly?: boolean
}>()
const emit = defineEmits<{
  collapse: [collapsed: boolean]
  category: [category: WorkflowResourceCategory]
  search: [query: string]
  page: [page: number]
  resourceDragStart: [payload: WorkflowResourceDragPayload]
  resourceDragEnd: []
  resourceActivate: [payload: WorkflowResourceDragPayload]
}>()

const searchText = ref(props.query)
const toolKind = ref('all')
watch(() => props.query, (value) => { searchText.value = value })

const categoryLabels: Record<WorkflowResourceCategory, string> = {
  tools: 'Available Tools',
  'knowledge-spaces': 'Knowledge Spaces',
  'agent-variables': 'Agent Variables',
  'dsl-edit': 'DSL Edit',
  'reusable-tools': 'Reusable Tools',
}
const isInventoryCategory = computed(() => props.category === 'tools' || props.category === 'knowledge-spaces')
const filteredTools = computed(() => props.tools.filter((tool) => {
  const matchesQuery = !props.query || `${tool.name} ${tool.kind}`.toLowerCase().includes(props.query.toLowerCase())
  return matchesQuery && (toolKind.value === 'all' || tool.kind === toolKind.value)
}))
const toolKinds = computed(() => [...new Set([...props.tools, ...(props.systemTools ?? [])].map((tool) => tool.kind))])
const toolPageItems = computed(() => filteredTools.value.slice((props.page - 1) * props.pageSize, props.page * props.pageSize))
const total = computed(() => props.category === 'tools' ? filteredTools.value.length : props.knowledgeTotal)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / props.pageSize)))

function submitSearch() { emit('search', searchText.value.trim()) }
function isKnowledgeSelectable(space: KnowledgeSpaceSummary) {
  return ['ready', 'syncing'].includes(space.lifecycleStatus) && ['healthy', 'needs_review'].includes(space.graphStatus)
}
function startDrag(event: globalThis.DragEvent, resourceId: UUID, kind: 'reusable-tool' | 'knowledge-space') {
  if (props.readOnly) return
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const payload = serializeWorkflowResourceDragPayload(resourceId, kind)
  event.dataTransfer.setData(WORKFLOW_RESOURCE_DRAG_MIME, payload)
  event.dataTransfer.setData('text/plain', payload)
  emit('resourceDragStart', { kind, resourceId })
}
function activateResource(resourceId: UUID, kind: 'reusable-tool' | 'knowledge-space') {
  if (props.readOnly) return
  emit('resourceActivate', { kind, resourceId })
}
const filteredSystemTools = computed(() => (props.systemTools ?? []).filter((tool) => `${tool.name} ${tool.description ?? ''} ${tool.category}`.toLowerCase().includes(props.query.toLowerCase()) && (toolKind.value === 'all' || tool.kind === toolKind.value)))
function systemPayload(tool: SystemToolDefinition): WorkflowResourceDragPayload { return { kind: 'system-tool-definition', toolDefinitionId: tool.id, toolKind: tool.kind } }
function startSystemDrag(event: globalThis.DragEvent, tool: SystemToolDefinition) {
  if (props.readOnly || !event.dataTransfer) return
  const payload = systemPayload(tool)
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(WORKFLOW_RESOURCE_DRAG_MIME, JSON.stringify(payload))
  emit('resourceDragStart', payload)
}
</script>

<template>
  <aside class="workflow-resource-browser" :class="{ 'is-collapsed': collapsed }" aria-label="Workflow resources">
    <header>
      <div><p class="workflow-eyebrow">RESOURCES</p><h2>{{ categoryLabels[category] }}</h2></div>
      <button type="button" class="resource-browser-collapse" :aria-expanded="!collapsed" :aria-label="collapsed ? 'Expand resources' : 'Collapse resources'" @click="emit('collapse', !collapsed)">{{ collapsed ? '‹' : 'Collapse' }}</button>
    </header>

    <template v-if="!collapsed && isInventoryCategory">
      <form class="resource-browser-search" role="search" @submit.prevent="submitSearch">
        <input v-model="searchText" :placeholder="category === 'tools' ? 'Search tools…' : 'Search Knowledge Spaces…'" aria-label="Search resources" />
        <button type="submit" aria-label="Submit resource search">⌕</button>
      </form>
      <div v-if="category === 'tools'" class="resource-browser-filters">
        <button type="button" :class="{ 'is-active': toolKind === 'all' }" @click="toolKind = 'all'; emit('page', 1)">All tools</button>
        <select v-model="toolKind" aria-label="Filter Tool kind" @change="emit('page', 1)"><option value="all">All kinds</option><option v-for="kind in toolKinds" :key="kind" :value="kind">{{ kind.replaceAll('_', ' ') }}</option></select>
      </div>

      <div v-if="category === 'tools'" class="resource-browser-items">
        <h3>System Tools</h3>
        <p v-if="systemToolStatus === 'loading'" role="status">Loading System Tools…</p>
        <p v-else-if="systemToolStatus === 'error'" role="alert">System Tools could not be loaded.</p>
        <p v-else-if="!filteredSystemTools.length">No matching System Tools.</p>
        <template v-else><article v-for="tool in filteredSystemTools" :key="tool.id" :draggable="!readOnly" :tabindex="readOnly ? -1 : 0" @dragstart="startSystemDrag($event, tool)" @dragend="emit('resourceDragEnd')" @dblclick="!readOnly && emit('resourceActivate', systemPayload(tool))" @keydown.enter.prevent="!readOnly && emit('resourceActivate', systemPayload(tool))"><i aria-hidden="true" /><span><strong>{{ tool.name }}</strong><small>{{ tool.description }}</small><small>{{ tool.category }} · System / Built-in</small></span></article></template>
        <h3 v-if="tools.length">Reusable Tools</h3>
        <p v-if="tools.length && !toolPageItems.length" class="resource-browser-empty">No matching reusable Tools.</p>
        <article v-for="tool in toolPageItems" :key="tool.id" :draggable="!readOnly" :tabindex="readOnly ? -1 : 0" :class="{ 'is-disabled': readOnly }" @dragstart="startDrag($event, tool.id, 'reusable-tool')" @dragend="emit('resourceDragEnd')" @dblclick="activateResource(tool.id, 'reusable-tool')" @keydown.enter.prevent="activateResource(tool.id, 'reusable-tool')"><i aria-hidden="true" /><span><strong>{{ tool.name }}</strong><small>{{ tool.kind.replaceAll('_', ' ') }}</small></span><span class="resource-card-grip" aria-hidden="true">⋮⋮</span></article>
      </div>
      <div v-else class="resource-browser-items">
        <p v-if="knowledgeStatus === 'loading'" class="resource-browser-empty" role="status">Loading Knowledge Spaces…</p>
        <p v-else-if="knowledgeStatus === 'error'" class="resource-browser-empty" role="alert">Knowledge Spaces could not be loaded.</p>
        <p v-else-if="!knowledgeSpaces.length" class="resource-browser-empty">No matching Knowledge Spaces.</p>
        <article v-for="space in knowledgeSpaces" v-else :key="space.id" :draggable="!readOnly && isKnowledgeSelectable(space)" :tabindex="!readOnly && isKnowledgeSelectable(space) ? 0 : -1" :class="{ 'is-disabled': readOnly || !isKnowledgeSelectable(space) }" @dragstart="isKnowledgeSelectable(space) && startDrag($event, space.id, 'knowledge-space')" @dragend="emit('resourceDragEnd')" @dblclick="isKnowledgeSelectable(space) && activateResource(space.id, 'knowledge-space')" @keydown.enter.prevent="isKnowledgeSelectable(space) && activateResource(space.id, 'knowledge-space')"><i aria-hidden="true" /><span><strong>{{ space.name }}</strong><small>{{ space.lifecycleStatus }} · {{ space.graphStatus }}</small></span><span class="resource-card-grip" aria-hidden="true">⋮⋮</span></article>
      </div>
      <footer v-if="totalPages > 1"><button type="button" :disabled="page <= 1" @click="emit('page', page - 1)">Previous</button><span>{{ page }} / {{ totalPages }}</span><button type="button" :disabled="page >= totalPages" @click="emit('page', page + 1)">Next</button></footer>
      <p class="resource-browser-hint">Drag a System Tool to a Task sequence. Select a Task and press Enter on a Tool for keyboard access.</p>
    </template>

    <section v-else-if="!collapsed" class="resource-browser-unavailable"><span>Coming next</span><p>This resource workspace is not configurable in the current API yet.</p></section>
  </aside>
</template>
