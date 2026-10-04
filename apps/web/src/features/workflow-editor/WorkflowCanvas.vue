<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type EdgeMouseEvent,
  type NodeDragEvent,
  type NodeMouseEvent,
  type ViewportTransform,
} from '@vue-flow/core'
import type { AgentVariable, SystemToolDefinition, AgentReusableTool, CanvasLayout, LoopBodyGraph, LoopNode, UUID, WorkflowGraph } from '@odyssey/schemas'
import type { WorkflowMode } from '@/stores/workflowEditor'

import {
  connectionToIntent,
  evaluateWorkflowResourceDrop,
  fromWorkflowCanvasPosition,
  parseWorkflowNodeDragPayload,
  parseWorkflowResourceDragPayload,
  projectWorkflowCanvas,
  WORKFLOW_NODE_DRAG_MIME,
  WORKFLOW_RESOURCE_DRAG_MIME,
  type WorkflowCanvasIntent,
  type WorkflowCanvasUiErrorCode,
  type WorkflowPaletteNodeType,
  type WorkflowResourceDragPayload,
  type WorkflowResourceDropAction,
  type WorkflowResourceDropTarget,
} from '@/canvas/workflow'
import WorkflowNodeRenderer from './WorkflowNodeRenderer.vue'

const props = defineProps<{
  graph: WorkflowGraph | LoopBodyGraph
  layout: CanvasLayout | LoopNode['config']['body']['layout']
  mode: WorkflowMode
  canvasId: string
  selectedNodeId?: UUID | null
  variables?: readonly AgentVariable[]
  systemTools?: readonly SystemToolDefinition[]
  availableReusableToolIds?: readonly UUID[]
  reusableTools?: readonly AgentReusableTool[]
  activeResourceDrag?: WorkflowResourceDragPayload | null
  normalizeInitialViewport?: boolean
}>()
const emit = defineEmits<{
  intent: [intent: WorkflowCanvasIntent]
  connect: [connection: Connection]
  create: [nodeType: WorkflowPaletteNodeType, point: { x: number; y: number }]
  clearError: []
  reject: [error: WorkflowCanvasUiErrorCode]
  editTool: [nodeId: UUID, stepId: UUID]
  changeTool: [nodeId: UUID, stepId: UUID, operation: 'delete' | 'up' | 'down']
  resourceDrop: [action: WorkflowResourceDropAction]
  updateAgentAction: [nodeId: UUID, details: { name: string; model: string; goal: string }]
}>()
const root = ref<globalThis.HTMLElement | null>(null)
const projection = computed(() => projectWorkflowCanvas(props.graph, props.layout, props.mode))
const { onInit, project: projectPoint, setCenter } = useVueFlow()
let connectionCommitted = false
let isApplyingInitialCenter = false
const resourceDropFeedback = ref<{ nodeId: UUID | null; status: 'idle' | 'valid' | 'invalid' | 'duplicate' | 'unavailable' }>({ nodeId: null, status: 'idle' })
const initialViewport = computed(() => props.normalizeInitialViewport
  ? { x: 0, y: 0, zoom: 1 }
  : projection.value.viewport)

const shouldCenterMinimumWorkflow = computed(() => {
  if (props.graph.nodes.length !== 2 || props.graph.edges.length !== 1) return false
  if (props.layout.viewport.x !== 0 || props.layout.viewport.y !== 0 || props.layout.viewport.zoom !== 1) return false
  const start = props.graph.nodes.find((node) => node.type === 'start' || node.type === 'loop_start')
  const end = props.graph.nodes.find((node) => node.type === 'end' || node.type === 'loop_end')
  const edge = props.graph.edges[0]
  return Boolean(start && end && edge?.sourceNodeId === start.id && edge.targetNodeId === end.id)
})

onInit(async () => {
  if (props.normalizeInitialViewport) {
    if (!projection.value.nodes.length) return
    const positions = projection.value.nodes.map((node) => node.position)
    const minX = Math.min(...positions.map((position) => position.x))
    const maxX = Math.max(...positions.map((position) => position.x))
    const minY = Math.min(...positions.map((position) => position.y))
    const maxY = Math.max(...positions.map((position) => position.y))
    isApplyingInitialCenter = true
    await setCenter((minX + maxX + 180) / 2, (minY + maxY + 100) / 2, { zoom: 1 })
    isApplyingInitialCenter = false
    return
  }
  if (!shouldCenterMinimumWorkflow.value) return
  const placements = new Map(props.layout.nodePlacements.map((placement) => [placement.nodeId, placement]))
  const start = props.graph.nodes.find((node) => node.type === 'start' || node.type === 'loop_start')
  const end = props.graph.nodes.find((node) => node.type === 'end' || node.type === 'loop_end')
  const startPlacement = start ? placements.get(start.id) : undefined
  const endPlacement = end ? placements.get(end.id) : undefined
  if (!startPlacement || !endPlacement) return

  isApplyingInitialCenter = true
  await setCenter(
    (startPlacement.x + endPlacement.x + 64) / 2,
    (startPlacement.y + endPlacement.y + 64) / 2,
    { zoom: 1 },
  )
  isApplyingInitialCenter = false
})

function nodeClick(event: NodeMouseEvent) {
  const origin = event.event.target
  if (origin instanceof globalThis.Element && origin.closest('[data-no-node-inspector="true"]')) return
  emit('intent', { type: 'select-node', nodeId: event.node.id as UUID })
}
function edgeClick(event: EdgeMouseEvent) {
  emit('intent', { type: 'select-edge', edgeId: event.edge.id as UUID })
}
function dragStop(event: NodeDragEvent) {
  if (props.mode !== 'configure') return
  const position = fromWorkflowCanvasPosition(event.node.position, props.layout, props.mode)
  emit('intent', { type: 'move-node', nodeId: event.node.id as UUID, x: position.x, y: position.y })
}
function moveEnd({ flowTransform: viewport }: { event: unknown; flowTransform: ViewportTransform }) {
  if (isApplyingInitialCenter) return
  emit('intent', { type: 'update-viewport', x: viewport.x, y: viewport.y, zoom: viewport.zoom })
}
function paneClick() {
  emit('intent', { type: 'select-node', nodeId: null })
  emit('intent', { type: 'select-edge', edgeId: null })
}
function drop(event: globalThis.DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  const transfer = event.dataTransfer
  const resourcePayload = parseWorkflowResourceDragPayload(
    transfer?.getData(WORKFLOW_RESOURCE_DRAG_MIME)
      || transfer?.getData('text/plain')
      || '',
  )
  if (resourcePayload) {
    handleResourceDrop(resourcePayload, resourceTargetFromEvent(event))
    return
  }
  if (props.mode !== 'configure') { emit('reject', 'INVALID_DROP_PAYLOAD'); return }
  const raw = transfer?.getData(WORKFLOW_NODE_DRAG_MIME) || transfer?.getData('text/plain') || ''
  const payload = parseWorkflowNodeDragPayload(raw)
  if (!payload) { emit('reject', 'INVALID_DROP_PAYLOAD'); return }
  const bounds = root.value?.getBoundingClientRect()
  if (!bounds) { emit('reject', 'INVALID_DROP_PAYLOAD'); return }
  emit('clearError')
  const position = fromWorkflowCanvasPosition(projectPoint({
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  }), props.layout, props.mode)
  emit('create', payload.nodeType, position)
}

function resourceTargetFromEvent(event: globalThis.DragEvent): WorkflowResourceDropTarget {
  const origin = event.target
  if (!(origin instanceof globalThis.Element)) return { kind: 'canvas-pane' }
  const dropZone = origin.closest<globalThis.HTMLElement>('[data-workflow-resource-drop-target][data-workflow-node-id]')
  const kind = dropZone?.dataset.workflowResourceDropTarget
  const nodeId = dropZone?.dataset.workflowNodeId
  if (!nodeId || (kind !== 'agent-action-tools' && kind !== 'task-tool-sequence')) return { kind: 'canvas-pane' }
  return { kind, nodeId: nodeId as UUID }
}
function createFromClientPoint(nodeType: WorkflowPaletteNodeType, clientX: number, clientY: number): boolean {
  if (props.mode !== 'configure') return false
  const bounds = root.value?.getBoundingClientRect()
  if (!bounds || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
    emit('reject', 'INVALID_DROP_PAYLOAD')
    return false
  }
  emit('clearError')
  const position = fromWorkflowCanvasPosition(
    projectPoint({ x: clientX - bounds.left, y: clientY - bounds.top }),
    props.layout,
    props.mode,
  )
  emit('create', nodeType, position)
  return true
}
defineExpose({ createFromClientPoint })
function dragOver(event: globalThis.DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}
function handleResourceDrop(payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget) {
  if (target.kind === 'canvas-pane') { emit('reject', 'INVALID_RESOURCE_TARGET'); return }
  const node = props.graph.nodes.find((candidate) => candidate.id === target.nodeId)
  const evaluation = evaluateWorkflowResourceDrop(payload, target, {
    node: node?.type === 'agent_action' || node?.type === 'task' ? node : null,
    systemTools: props.systemTools, mode: props.mode, availableReusableToolIds: new Set(props.availableReusableToolIds ?? []),
  })
  if (evaluation.status === 'valid') {
    resourceDropFeedback.value = { nodeId: null, status: 'idle' }
    emit('clearError')
    emit('resourceDrop', evaluation.action)
  } else {
    resourceDropFeedback.value = { nodeId: target.nodeId, status: evaluation.status }
  }
}
function evaluateResourceTarget(payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget) {
  if (target.kind === 'canvas-pane') return evaluateWorkflowResourceDrop(payload, target, { node: null, systemTools: props.systemTools, mode: props.mode, availableReusableToolIds: new Set(props.availableReusableToolIds ?? []) })
  const node = props.graph.nodes.find((candidate) => candidate.id === target.nodeId)
  return evaluateWorkflowResourceDrop(payload, target, {
    node: node?.type === 'agent_action' || node?.type === 'task' ? node : null,
    systemTools: props.systemTools, mode: props.mode, availableReusableToolIds: new Set(props.availableReusableToolIds ?? []),
  })
}
function resourceEnter(payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget) {
  const evaluation = evaluateResourceTarget(payload, target)
  resourceDropFeedback.value = { nodeId: target.kind === 'canvas-pane' ? null : target.nodeId, status: evaluation.status }
}
function resourceLeave(target: WorkflowResourceDropTarget) {
  if (target.kind !== 'canvas-pane' && resourceDropFeedback.value.nodeId === target.nodeId) resourceDropFeedback.value = { nodeId: null, status: 'idle' }
}
function unbindTool(nodeId: UUID, reusableToolId: UUID) {
  emit('clearError')
  emit('resourceDrop', { type: 'unbind-reusable-tool', nodeId, reusableToolId })
}
function connectStart() {
  connectionCommitted = false
  emit('clearError')
}
function connect(connection: Connection) {
  if (props.mode !== 'configure') return
  if (!connectionToIntent(connection, globalThis.crypto.randomUUID() as UUID)) {
    emit('reject', 'INVALID_CONNECTION')
    return
  }
  connectionCommitted = true
  emit('connect', connection)
}
function connectEnd() {
  if (!connectionCommitted) emit('reject', 'INVALID_CONNECTION')
  connectionCommitted = false
}
</script>

<template>
  <section ref="root" class="workflow-flow-surface" @dragenter.prevent @dragover="dragOver" @drop="drop">
    <VueFlow
      :id="canvasId"
      :nodes="projection.nodes"
      :edges="projection.edges"
      :default-viewport="initialViewport"
      :min-zoom="0.35"
      :max-zoom="1.8"
      :nodes-draggable="mode === 'configure'"
      :nodes-connectable="mode === 'configure'"
      @node-click="nodeClick"
      @edge-click="edgeClick"
      @node-drag-stop="dragStop"
      @move-end="moveEnd"
      @pane-click="paneClick"
      @connect-start="connectStart"
      @connect="connect"
      @connect-end="connectEnd"
    >
      <template #node-workflow="nodeProps">
        <WorkflowNodeRenderer
          v-bind="nodeProps"
          :configure-expanded="mode === 'configure'"
          :tools="reusableTools ?? []"
          :variables="variables" :active-resource-drag="activeResourceDrag"
          :resource-drop-state="resourceDropFeedback.status"
          :resource-drop-node-id="resourceDropFeedback.nodeId"
          @edit-tool="(nodeId, stepId) => emit('editTool', nodeId, stepId)"
          @change-tool="(nodeId, stepId, operation) => emit('changeTool', nodeId, stepId, operation)"
          @resource-enter="resourceEnter"
          @resource-leave="resourceLeave"
          @resource-drop="handleResourceDrop"
          @unbind-tool="unbindTool"
          @update-agent-action="(nodeId, details) => emit('updateAgentAction', nodeId, details)"
        />
      </template>
    </VueFlow>
    <p v-if="projection.diagnostics.length" class="canvas-diagnostic" role="status">Some nodes use temporary fallback positions. Move and save them to repair layout.</p>
  </section>
</template>
