<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Connection } from '@vue-flow/core'
import type { AgentVariable, SystemToolDefinition, AgentReusableTool, KnowledgeSpaceSummary, LoopNode, UUID, WorkflowGraph, WorkflowNode } from '@odyssey/schemas'
import type { WorkflowCanvasContext, WorkflowMode } from '@/stores/workflowEditor'
import type { WorkflowCanvasIntent, WorkflowCanvasUiErrorCode, WorkflowPaletteNodeType, WorkflowResourceDragPayload, WorkflowResourceDropAction } from '@/canvas/workflow'
import WorkflowCanvas from './WorkflowCanvas.vue'

const props = defineProps<{
  rootGraph: WorkflowGraph
  loop: LoopNode
  mode: WorkflowMode
  canvasId: string
  selectedNodeId?: UUID | null
  rootSelectedNodeId?: UUID | null
  variables?: readonly AgentVariable[]
  systemTools?: readonly SystemToolDefinition[]
  availableReusableToolIds?: readonly UUID[]
  reusableTools?: readonly AgentReusableTool[]
  knowledgeSpaces?: readonly KnowledgeSpaceSummary[]
  activeResourceDrag?: WorkflowResourceDragPayload | null
}>()
defineEmits<{
  intent: [intent: WorkflowCanvasIntent]
  connect: [connection: Connection]
  create: [nodeType: WorkflowPaletteNodeType, point: { x: number; y: number }]
  clearError: []
  reject: [error: WorkflowCanvasUiErrorCode]
  collapse: []
  selectRoot: [nodeId: UUID]
  editTool: [nodeId: UUID, stepId: UUID]
  editReusableTool: [nodeId: UUID, reusableToolId: UUID]
  changeTool: [nodeId: UUID, stepId: UUID, operation: 'delete' | 'up' | 'down']
  reorderTool: [nodeId: UUID, stepId: UUID, targetIndex: number]
  toolStepContextMenu: [nodeId: UUID, stepId: UUID, context: WorkflowCanvasContext, point: { x: number; y: number }]
  resourceDrop: [action: WorkflowResourceDropAction]
  updateAgentAction: [nodeId: UUID, details: { name: string; model: string; goal: string }]
  updateNodeName: [nodeId: UUID, name: string]
  nodeContextMenu: [nodeId: UUID, context: WorkflowCanvasContext, point: { x: number; y: number }]
  edgeContextMenu: [edgeId: UUID, context: WorkflowCanvasContext, point: { x: number; y: number }]
}>()
const childCanvas = ref<InstanceType<typeof WorkflowCanvas> | null>(null)
const rootStart = computed(() => props.rootGraph.nodes.find((node) => node.type === 'start'))
const rootEnd = computed(() => props.rootGraph.nodes.find((node) => node.type === 'end'))
const rootSiblings = computed(() => props.rootGraph.nodes.filter((node) => !['start', 'end'].includes(node.type) && node.id !== props.loop.id))

function canReach(sourceNodeId: UUID, targetNodeId: UUID): boolean {
  const outgoing = new Map<UUID, UUID[]>()
  for (const edge of props.rootGraph.edges) {
    const targets = outgoing.get(edge.sourceNodeId) ?? []
    targets.push(edge.targetNodeId)
    outgoing.set(edge.sourceNodeId, targets)
  }
  const pending = [sourceNodeId]
  const visited = new Set<UUID>()
  while (pending.length) {
    const current = pending.pop()
    if (!current || visited.has(current)) continue
    if (current === targetNodeId) return true
    visited.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  return false
}

const precedingSiblings = computed(() => rootSiblings.value.filter((node) => canReach(node.id, props.loop.id)))
const followingSiblings = computed(() => rootSiblings.value.filter((node) => !canReach(node.id, props.loop.id)))

function siblingSubtitle(node: WorkflowNode): string {
  if (node.type === 'agent_action') return node.config.model
  if (node.type === 'task') return `${node.config.steps.length} tool steps`
  if (node.type === 'branch') return `${node.config.cases.length + 1} routes`
  return node.type.replaceAll('_', ' ')
}

function createFromClientPoint(nodeType: WorkflowPaletteNodeType, clientX: number, clientY: number) {
  return childCanvas.value?.createFromClientPoint(nodeType, clientX, clientY) ?? false
}
defineExpose({ createFromClientPoint })
</script>

<template>
  <section class="inline-loop-stage" aria-label="Expanded Loop in Root Workflow">
    <div class="inline-root-boundary is-start" aria-label="Root workflow start">
      <span>{{ rootStart?.name ?? 'Start' }}</span>
    </div>
    <template v-for="node in precedingSiblings" :key="node.id">
      <span class="inline-root-route" aria-hidden="true" />
      <button type="button" class="inline-root-sibling" :class="{ 'is-selected': rootSelectedNodeId === node.id }" @click="$emit('selectRoot', node.id)" @contextmenu.prevent="$emit('nodeContextMenu', node.id, { kind: 'root' }, { x: $event.clientX, y: $event.clientY })">
        <strong>{{ node.name }}</strong><small>{{ siblingSubtitle(node) }}</small>
      </button>
    </template>
    <span class="inline-root-route before-loop" aria-hidden="true" />

    <section class="inline-loop-container" :aria-label="`${loop.name} Loop body`">
      <header class="inline-loop-heading" @contextmenu.prevent="$emit('nodeContextMenu', loop.id, { kind: 'root' }, { x: $event.clientX, y: $event.clientY })">
        <div>
          <p>LOOP · {{ loop.name.toUpperCase() }}</p>
          <div><h2>Loop Body</h2><span>Expanded inline · nested graph remains owned by this Loop</span></div>
        </div>
        <button type="button" @click="$emit('collapse')">Collapse</button>
      </header>
      <WorkflowCanvas
        ref="childCanvas"
        :canvas-id="canvasId"
        :graph="loop.config.body.graph"
        :layout="loop.config.body.layout"
        :mode="mode"
        :selected-node-id="selectedNodeId"
        :available-reusable-tool-ids="availableReusableToolIds ?? []"
        :variables="variables" :system-tools="systemTools"
        :reusable-tools="reusableTools ?? []"
        :knowledge-spaces="knowledgeSpaces ?? []"
        :active-resource-drag="activeResourceDrag"
        normalize-initial-viewport
        @edit-tool="(nodeId, stepId) => $emit('editTool', nodeId, stepId)"
        @edit-reusable-tool="(nodeId, reusableToolId) => $emit('editReusableTool', nodeId, reusableToolId)"
        @change-tool="(nodeId, stepId, operation) => $emit('changeTool', nodeId, stepId, operation)"
        @reorder-tool="(nodeId, stepId, targetIndex) => $emit('reorderTool', nodeId, stepId, targetIndex)"
        @tool-step-context-menu="(nodeId, stepId, point) => $emit('toolStepContextMenu', nodeId, stepId, { kind: 'loop-body', loopNodeId: loop.id }, point)"
        @intent="$emit('intent', $event)"
        @connect="$emit('connect', $event)"
        @create="(nodeType, point) => $emit('create', nodeType, point)"
        @clear-error="$emit('clearError')"
        @reject="$emit('reject', $event)"
        @resource-drop="$emit('resourceDrop', $event)"
        @update-agent-action="(nodeId, details) => $emit('updateAgentAction', nodeId, details)"
        @update-node-name="(nodeId, name) => $emit('updateNodeName', nodeId, name)"
        @node-context-menu="(nodeId, point) => $emit('nodeContextMenu', nodeId, { kind: 'loop-body', loopNodeId: loop.id }, point)"
        @edge-context-menu="(edgeId, point) => $emit('edgeContextMenu', edgeId, { kind: 'loop-body', loopNodeId: loop.id }, point)"
      />
    </section>

    <template v-for="node in followingSiblings" :key="node.id">
      <span class="inline-root-route" aria-hidden="true" />
      <button type="button" class="inline-root-sibling" :class="{ 'is-selected': rootSelectedNodeId === node.id }" @click="$emit('selectRoot', node.id)" @contextmenu.prevent="$emit('nodeContextMenu', node.id, { kind: 'root' }, { x: $event.clientX, y: $event.clientY })">
        <strong>{{ node.name }}</strong><small>{{ siblingSubtitle(node) }}</small>
      </button>
    </template>
    <span class="inline-root-route after-loop" aria-hidden="true" />
    <div class="inline-root-boundary is-end" aria-label="Root workflow end">
      <span>{{ rootEnd?.name ?? 'End' }}</span>
    </div>
  </section>
</template>
