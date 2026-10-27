<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { VueFlow, useVueFlow, type NodeMouseEvent } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { KnowledgeGraphOverview, UUID } from '@odyssey/schemas'
import { filterKnowledgeGraphByFamily, projectKnowledgeGraphCanvas, type KnowledgeGraphViewport } from '@/canvas/knowledge'
import AppSelect, { type AppSelectOption } from '@/components/AppSelect.vue'
import KnowledgeGraphNode from './KnowledgeGraphNode.vue'
import KnowledgeGraphInspector from './KnowledgeGraphInspector.vue'

const props = defineProps<{
  graph: KnowledgeGraphOverview
  selectedNodeId: UUID | null
  viewport: KnowledgeGraphViewport
}>()
const emit = defineEmits<{
  openDocument: [resourceId: UUID]
  selectedNodeChange: [nodeId: UUID | null]
  viewportChange: [viewport: KnowledgeGraphViewport]
}>()
const canvasId = `knowledge-graph-${useId()}`
const hasFitted = ref(false)
const selectedFamilyId = ref('all')
const familyOptions = computed<readonly AppSelectOption[]>(() => [
  { value: 'all', label: 'All families' },
  ...props.graph.families.map(family => ({ value: family.id, label: family.name })),
])
const filteredGraph = computed<KnowledgeGraphOverview>(() => {
  const family = props.graph.families.find(candidate => candidate.id === selectedFamilyId.value)
  return filterKnowledgeGraphByFamily(props.graph, family?.id ?? null)
})
const projection = computed(() => projectKnowledgeGraphCanvas(filteredGraph.value))
const canvasNodes = computed(() => projection.value.nodes.map(node => ({ ...node, selected: node.id === props.selectedNodeId })))
const canvasEdges = computed(() => [...projection.value.edges])
const selectedNode = computed(() => props.graph.nodes.find(node => node.id === props.selectedNodeId) ?? null)
const { fitView, onNodesInitialized } = useVueFlow(canvasId)

async function fitGraph() {
  await nextTick()
  await fitView({ padding: 0.2, minZoom: 0.35, maxZoom: 1.25, duration: 180 })
}

onNodesInitialized(() => {
  if (hasFitted.value) return
  hasFitted.value = true
  void fitGraph()
})

watch(() => props.graph.knowledgeSpaceId, () => {
  emit('selectedNodeChange', null)
  selectedFamilyId.value = 'all'
  hasFitted.value = false
})

watch(selectedFamilyId, async () => {
  if (!filteredGraph.value.nodes.some(node => node.id === props.selectedNodeId)) emit('selectedNodeChange', null)
  await fitGraph()
})

function selectNode(event: NodeMouseEvent) {
  emit('selectedNodeChange', event.node.id as UUID)
}

function openNode(event: NodeMouseEvent) {
  emit('openDocument', event.node.id as UUID)
}

function closeInspector() {
  emit('selectedNodeChange', null)
}

function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key !== 'Escape' || props.selectedNodeId === null) return
  event.preventDefault()
  closeInspector()
}
</script>

<template>
  <div class="knowledge-graph-canvas" :class="{ 'has-inspector': selectedNode }" @keydown="handleKeydown">
    <div class="knowledge-graph-canvas__surface" role="application" :aria-label="`Knowledge graph with ${graph.nodes.length} documents and ${graph.edges.length} relationships`">
      <div v-if="graph.families.length" class="knowledge-graph-canvas__filter">
        <AppSelect v-model="selectedFamilyId" :options="familyOptions" control-label="Filter graph by knowledge family" />
        <small>{{ filteredGraph.nodes.length }}/{{ graph.nodes.length }} documents</small>
      </div>
      <VueFlow
        :id="canvasId" :nodes="canvasNodes" :edges="canvasEdges" :default-viewport="props.viewport"
        :nodes-draggable="false" :nodes-connectable="false" :edges-updatable="false"
        :elements-selectable="true" :select-nodes-on-drag="false" :connect-on-click="false" :auto-connect="false"
        :zoom-on-scroll="true" :zoom-on-pinch="true" :zoom-on-double-click="false" :pan-on-drag="true"
        :delete-key-code="null" :selection-key-code="null" :multi-selection-key-code="null"
        :min-zoom="0.25" :max-zoom="1.6"
        @node-click="selectNode" @node-double-click="openNode" @pane-click="closeInspector" @viewport-change-end="emit('viewportChange', $event)"
      >
        <template #node-knowledge-document="nodeProps"><KnowledgeGraphNode v-bind="nodeProps" /></template>
      </VueFlow>
      <div class="knowledge-graph-canvas__controls" aria-label="Graph controls">
        <span>{{ filteredGraph.nodes.length }} documents · {{ filteredGraph.edges.length }} relationships</span>
        <button type="button" title="Fit graph to view" aria-label="Fit graph to view" @click="fitGraph">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" /></svg>
        </button>
      </div>
      <p v-if="projection.diagnostics.length" class="knowledge-graph-canvas__diagnostic" role="alert">Some relationships could not be displayed because their documents are missing.</p>
    </div>
    <KnowledgeGraphInspector v-if="selectedNode" :graph="graph" :node="selectedNode" @close="closeInspector" @open-document="emit('openDocument', $event)" />
  </div>
</template>
