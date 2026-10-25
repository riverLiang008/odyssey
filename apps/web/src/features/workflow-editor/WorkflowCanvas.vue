<script setup lang="ts">
import { workflowRouting } from '@odyssey/design-tokens'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { mapModeViewport, modeViewportAnchor } from '@/canvas/workflow/modeViewport'
import { expandMeasuredLoopFrames } from '@/canvas/workflow/measuredLoopProjection'
import type { LoopChildSize } from '@/canvas/workflow/loopBounds'
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type EdgeMouseEvent,
  type NodeDragEvent,
  type NodeMouseEvent,
  type ViewportTransform,
} from '@vue-flow/core'
import type { JourneyEditorDocument, AgentVariable, SystemToolDefinition, AgentReusableTool, CanvasLayout, KnowledgeSpaceSummary, LoopBodyGraph, LoopNode, UUID, WorkflowGraph } from '@odyssey/schemas'
import type { WorkflowMode } from '@/stores/workflowEditor'
import { isKnowledgeSpaceReferenceable } from '@/domain/knowledge'

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
  routingJourney?: JourneyEditorDocument | null
  graph: WorkflowGraph | LoopBodyGraph
  layout: CanvasLayout | LoopNode['config']['body']['layout']
  mode: WorkflowMode
  canvasId: string
  selectedNodeId?: UUID | null
  variables?: readonly AgentVariable[]
  systemTools?: readonly SystemToolDefinition[]
  availableReusableToolIds?: readonly UUID[]
  reusableTools?: readonly AgentReusableTool[]
  knowledgeSpaces?: readonly KnowledgeSpaceSummary[]
  activeResourceDrag?: WorkflowResourceDragPayload | null
  normalizeInitialViewport?: boolean
}>()
type CanvasTargetContext = { kind: 'root' } | { kind: 'loop-body'; loopNodeId: UUID }
const emit = defineEmits<{
  intent: [context: CanvasTargetContext, intent: WorkflowCanvasIntent]
  connect: [context: CanvasTargetContext, connection: Connection]
  create: [context: CanvasTargetContext, nodeType: WorkflowPaletteNodeType, point: { x: number; y: number }]
  resize: [nodeId: UUID, size: { width: number; height: number }]
  loopBounds: [loopNodeId: UUID, sizes: readonly LoopChildSize[]]
  clearError: []
  reject: [error: WorkflowCanvasUiErrorCode]
  editTool: [nodeId: UUID, stepId: UUID]
  editReusableTool: [nodeId: UUID, reusableToolId: UUID]
  changeTool: [nodeId: UUID, stepId: UUID, operation: 'delete' | 'up' | 'down']
  reorderTool: [nodeId: UUID, stepId: UUID, targetIndex: number]
  toolStepContextMenu: [nodeId: UUID, stepId: UUID, point: { x: number; y: number }]
  resourceDrop: [action: WorkflowResourceDropAction]
  updateAgentAction: [nodeId: UUID, details: { name: string; model: string; goal: string }]
  updateNodeName: [nodeId: UUID, name: string]
  nodeContextMenu: [context: CanvasTargetContext, nodeId: UUID, point: { x: number; y: number }]
  edgeContextMenu: [context: CanvasTargetContext, edgeId: UUID, point: { x: number; y: number }]
}>()
const root = ref<globalThis.HTMLElement | null>(null)
const measuredSizes = shallowRef<readonly LoopChildSize[]>([])
const projection = computed(() => {
  const result = projectWorkflowCanvas(props.graph, props.layout, props.mode, props.routingJourney)
  return { ...result, nodes: expandMeasuredLoopFrames(result.nodes, measuredSizes.value) }
})
const { onInit, onNodesInitialized, fitView, project: projectPoint, setCenter, setViewport: setCanvasViewport, viewport } = useVueFlow(props.canvasId)
let modeProjection = projection.value
let modeChangeSeq = 0
let modeAnchorId: string | null = null
watch(() => props.selectedNodeId, () => { modeAnchorId = null })
watch(() => props.mode, async () => {
  const seq = ++modeChangeSeq
  const size = { width: root.value?.clientWidth ?? 0, height: root.value?.clientHeight ?? 0 }
  modeAnchorId = modeViewportAnchor(modeProjection, viewport.value, size, modeAnchorId ?? props.selectedNodeId)
  const mapped = mapModeViewport(modeProjection, projection.value, viewport.value, size, modeAnchorId)
  modeProjection = projection.value
  isApplyingInitialCenter = true
  await nextTick()
  if (seq !== modeChangeSeq) return
  try { await setCanvasViewport(mapped) } finally { if (seq === modeChangeSeq) isApplyingInitialCenter = false }
})
watch(projection, value => { modeProjection = value }, { flush: 'post' })
let boundsObserver: globalThis.ResizeObserver | undefined
let boundsFrame: number | undefined
let disposed = false
function scheduleBounds() {
  if (disposed || boundsFrame !== undefined) return
  boundsFrame = globalThis.requestAnimationFrame(() => {
    boundsFrame = undefined
    if (!('schemaVersion' in props.graph)) return
    const allSizes: LoopChildSize[] = []
    for (const loop of props.graph.nodes) {
      if (loop.type !== 'loop') continue
      const sizes = loop.config.body.graph.nodes.flatMap(node => {
        const card = root.value?.querySelector<globalThis.HTMLElement>(`[data-measured-node-id="${node.id}"]`)
        return card && card.offsetWidth && card.offsetHeight ? [{ nodeId: node.id, width: card.offsetWidth, height: card.offsetHeight }] : []
      })
      allSizes.push(...sizes)
      if (sizes.length && props.mode === 'configure') emit('loopBounds', loop.id, sizes)
    }
    if (JSON.stringify(allSizes) !== JSON.stringify(measuredSizes.value)) measuredSizes.value = allSizes
  })
}
function observeBounds() {
  if (disposed) return
  boundsObserver?.disconnect()
  root.value?.querySelectorAll('[data-measured-node-id]').forEach(card => boundsObserver?.observe(card))
  scheduleBounds()
}
onMounted(() => { if (globalThis.ResizeObserver) boundsObserver = new globalThis.ResizeObserver(scheduleBounds); observeBounds() })
watch(projection, async () => { await nextTick(); observeBounds() }, { flush: 'post' })
onBeforeUnmount(() => { disposed = true; modeChangeSeq++; boundsObserver?.disconnect(); if (boundsFrame !== undefined) globalThis.cancelAnimationFrame(boundsFrame) })
let connectionCommitted = false
let isApplyingInitialCenter = false
const resourceDropFeedback = ref<{ nodeId: UUID | null; targetKind: WorkflowResourceDropTarget['kind'] | null; status: 'idle' | 'valid' | 'invalid' | 'duplicate' | 'unavailable' }>({ nodeId: null, targetKind: null, status: 'idle' })
const initialViewport = computed(() => props.normalizeInitialViewport
  ? { x: 0, y: 0, zoom: 1 }
  : projection.value.viewport)

const shouldCenterMinimumWorkflow = computed(() => {
  if (props.graph.nodes.length !== 2 || props.graph.edges.length > 1) return false
  if (props.layout.viewport.x !== 0 || props.layout.viewport.y !== 0 || props.layout.viewport.zoom !== 1) return false
  const start = props.graph.nodes.find((node) => node.type === 'start' || node.type === 'loop_start')
  const end = props.graph.nodes.find((node) => node.type === 'end' || node.type === 'loop_end')
  const edge = props.graph.edges[0]
  return Boolean(start && end && (!edge || (edge.sourceNodeId === start.id && edge.targetNodeId === end.id)))
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
  const viewport = props.layout.viewport
  const boundaryOnly = props.graph.nodes.every((node) => node.type === 'start' || node.type === 'end')
  if (boundaryOnly && props.graph.nodes.filter((node) => node.type === 'end').length > 1
      && viewport.x === 0 && viewport.y === 0 && viewport.zoom === 1 && root.value) {
    const positions = projection.value.nodes.map((node) => node.position)
    const maxX = Math.max(...positions.map((point) => point.x)) + Number.parseFloat(workflowRouting.exitWidth)
    const maxY = Math.max(...positions.map((point) => point.y)) + Number.parseFloat(workflowRouting.exitMinHeight)
    const zoom = Math.max(.35, Math.min(1,
      (root.value.clientWidth - workflowRouting.viewportLeftInset - workflowRouting.viewportPadding) / maxX,
      (root.value.clientHeight - workflowRouting.viewportTopInset - workflowRouting.viewportPadding) / maxY))
    isApplyingInitialCenter = true
    await setCanvasViewport({ x: workflowRouting.viewportLeftInset, y: workflowRouting.viewportTopInset, zoom })
    isApplyingInitialCenter = false
    return
  }
})

// Wait for measured node bounds so the boundary pills are centered at their actual size.
onNodesInitialized(async () => {
  if (props.normalizeInitialViewport || !shouldCenterMinimumWorkflow.value) return
  isApplyingInitialCenter = true
  try {
    await fitView({ minZoom: 1, maxZoom: 1, duration: 0 })
  } finally {
    isApplyingInitialCenter = false
  }
})

function nodeClick(event: NodeMouseEvent) {
  const origin = event.event.target
  if (origin instanceof globalThis.Element && origin.closest('[data-no-node-inspector="true"]')) return
  emit('intent', (event.node.data.context ?? { kind: 'root' }) as CanvasTargetContext, { type: 'select-node', nodeId: event.node.id as UUID })
}
function nodeContextMenu(event: NodeMouseEvent) {
  event.event.preventDefault()
  if (props.mode !== 'configure') return
  if (!(event.event instanceof globalThis.MouseEvent)) return
  const node = event.node.data.node
  if (!node || ['start', 'end', 'loop_start', 'loop_end'].includes(node.type)) return
  emit('nodeContextMenu', (event.node.data.context ?? { kind: 'root' }) as CanvasTargetContext, node.id, { x: event.event.clientX, y: event.event.clientY })
}
function edgeClick(event: EdgeMouseEvent) {
  emit('intent', contextForNodeId(event.edge.source as UUID), { type: 'select-edge', edgeId: event.edge.id as UUID })
}
function edgeContextMenu(event: EdgeMouseEvent) {
  event.event.preventDefault()
  if (props.mode !== 'configure') return
  if (!(event.event instanceof globalThis.MouseEvent)) return
  emit('edgeContextMenu', contextForNodeId(event.edge.source as UUID), event.edge.id as UUID, { x: event.event.clientX, y: event.event.clientY })
}
function dragStop(event: NodeDragEvent) {
  if (props.mode !== 'configure') return
  const context = (event.node.data.context ?? { kind: 'root' }) as CanvasTargetContext
  const position = context.kind === 'root' ? fromWorkflowCanvasPosition(event.node.position, props.layout, props.mode) : event.node.position
  emit('intent', context, { type: 'move-node', nodeId: event.node.id as UUID, x: position.x, y: position.y })
}
function moveEnd({ flowTransform: viewport }: { event: unknown; flowTransform: ViewportTransform }) {
  if (isApplyingInitialCenter) return
  modeAnchorId = null
  const saved = props.mode === 'configure' ? viewport : mapModeViewport(
    projection.value, projectWorkflowCanvas(props.graph, props.layout, 'configure', props.routingJourney), viewport,
    { width: root.value?.clientWidth ?? 0, height: root.value?.clientHeight ?? 0 }, props.selectedNodeId,
  )
  emit('intent', { kind: 'root' }, { type: 'update-viewport', x: saved.x, y: saved.y, zoom: saved.zoom })
}
function paneClick() {
  emit('intent', { kind: 'root' }, { type: 'select-node', nodeId: null })
  emit('intent', { kind: 'root' }, { type: 'select-edge', edgeId: null })
}
function contextForNodeId(nodeId: UUID): CanvasTargetContext {
  if ('schemaVersion' in props.graph) {
    for (const node of props.graph.nodes) if (node.type === 'loop' && node.config.body.graph.nodes.some((child) => child.id === nodeId)) return { kind: 'loop-body', loopNodeId: node.id }
  }
  return { kind: 'root' }
}
function creationTarget(nodeType: WorkflowPaletteNodeType, position: { x: number; y: number }): { context: CanvasTargetContext; point: { x: number; y: number } } | null {
  if (!('schemaVersion' in props.graph)) return { context: { kind: 'root' }, point: position }
  const placements = new Map(props.layout.nodePlacements.map((placement) => [placement.nodeId, placement]))
  const loop = [...props.graph.nodes].reverse().find((node) => {
    if (node.type !== 'loop') return false
    const placement = placements.get(node.id)
    if (!placement) return false
    const width = placement.width ?? 720
    const height = placement.height ?? 480
    return position.x >= placement.x && position.x <= placement.x + width && position.y >= placement.y + 58 && position.y <= placement.y + height
  })
  if (!loop || loop.type !== 'loop') return { context: { kind: 'root' }, point: position }
  if (nodeType !== 'task' && nodeType !== 'agent_action') return null
  const placement = placements.get(loop.id)
  if (!placement) return null
  return { context: { kind: 'loop-body', loopNodeId: loop.id }, point: { x: Math.max(12, position.x - placement.x), y: Math.max(70, position.y - placement.y) } }
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
  const target = creationTarget(payload.nodeType, position)
  if (!target) { emit('reject', 'INVALID_DROP_PAYLOAD'); return }
  emit('create', target.context, payload.nodeType, target.point)
}

function resourceTargetFromEvent(event: globalThis.DragEvent): WorkflowResourceDropTarget {
  const origin = event.target
  if (!(origin instanceof globalThis.Element)) return { kind: 'canvas-pane' }
  const dropZone = origin.closest<globalThis.HTMLElement>('[data-workflow-resource-drop-target][data-workflow-node-id]')
  const kind = dropZone?.dataset.workflowResourceDropTarget
  const nodeId = dropZone?.dataset.workflowNodeId
  if (!nodeId || (kind !== 'agent-action-tools' && kind !== 'agent-action-knowledge-spaces' && kind !== 'task-tool-sequence')) return { kind: 'canvas-pane' }
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
  const target = creationTarget(nodeType, position)
  if (!target) { emit('reject', 'INVALID_DROP_PAYLOAD'); return false }
  emit('create', target.context, nodeType, target.point)
  return true
}
defineExpose({ createFromClientPoint })
function dragOver(event: globalThis.DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}
function handleResourceDrop(payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget) {
  if (target.kind === 'canvas-pane') { emit('reject', 'INVALID_RESOURCE_TARGET'); return }
  const node = projection.value.nodes.find(candidate => candidate.id === target.nodeId)?.data?.node
  const evaluation = evaluateWorkflowResourceDrop(payload, target, {
    node: node?.type === 'agent_action' || node?.type === 'task' ? node : null,
    systemTools: props.systemTools, mode: props.mode, availableReusableToolIds: new Set(props.availableReusableToolIds ?? []), availableKnowledgeSpaceIds: new Set((props.knowledgeSpaces ?? []).filter(isKnowledgeSpaceReferenceable).map((space) => space.id)),
  })
  if (evaluation.status === 'valid') {
    resourceDropFeedback.value = { nodeId: null, targetKind: null, status: 'idle' }
    emit('clearError')
    emit('resourceDrop', evaluation.action)
  } else {
    resourceDropFeedback.value = { nodeId: target.nodeId, targetKind: target.kind, status: evaluation.status }
  }
}
function evaluateResourceTarget(payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget) {
  if (target.kind === 'canvas-pane') return evaluateWorkflowResourceDrop(payload, target, { node: null, systemTools: props.systemTools, mode: props.mode, availableReusableToolIds: new Set(props.availableReusableToolIds ?? []), availableKnowledgeSpaceIds: new Set((props.knowledgeSpaces ?? []).filter(isKnowledgeSpaceReferenceable).map((space) => space.id)) })
  const node = projection.value.nodes.find(candidate => candidate.id === target.nodeId)?.data?.node
  return evaluateWorkflowResourceDrop(payload, target, {
    node: node?.type === 'agent_action' || node?.type === 'task' ? node : null,
    systemTools: props.systemTools, mode: props.mode, availableReusableToolIds: new Set(props.availableReusableToolIds ?? []), availableKnowledgeSpaceIds: new Set((props.knowledgeSpaces ?? []).filter(isKnowledgeSpaceReferenceable).map((space) => space.id)),
  })
}
function resourceEnter(payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget) {
  const evaluation = evaluateResourceTarget(payload, target)
  resourceDropFeedback.value = { nodeId: target.kind === 'canvas-pane' ? null : target.nodeId, targetKind: target.kind, status: evaluation.status }
}
function resourceLeave(target: WorkflowResourceDropTarget) {
  if (target.kind !== 'canvas-pane' && resourceDropFeedback.value.nodeId === target.nodeId && resourceDropFeedback.value.targetKind === target.kind) resourceDropFeedback.value = { nodeId: null, targetKind: null, status: 'idle' }
}
function unbindTool(nodeId: UUID, reusableToolId: UUID) {
  emit('clearError')
  emit('resourceDrop', { type: 'unbind-reusable-tool', nodeId, reusableToolId })
}
function unbindKnowledgeSpace(nodeId: UUID, knowledgeSpaceId: UUID) {
  emit('clearError')
  emit('resourceDrop', { type: 'unbind-knowledge-space', nodeId, knowledgeSpaceId })
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
  const sourceContext = contextForNodeId(connection.source as UUID)
  const targetContext = contextForNodeId(connection.target as UUID)
  if (sourceContext.kind !== targetContext.kind || (sourceContext.kind === 'loop-body' && targetContext.kind === 'loop-body' && sourceContext.loopNodeId !== targetContext.loopNodeId)) {
    emit('reject', 'INVALID_CONNECTION')
    return
  }
  emit('connect', sourceContext, connection)
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
      @node-context-menu="nodeContextMenu"
      @edge-click="edgeClick"
      @edge-context-menu="edgeContextMenu"
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
          :configure-expanded="mode === 'configure' && ((nodeProps.data.context?.kind ?? 'root') === 'root' || nodeProps.data.node.type === 'branch')"
          :read-only="nodeProps.data.node.type === 'branch' ? mode !== 'configure' : undefined"
          :tools="reusableTools ?? []"
          :knowledge-spaces="knowledgeSpaces ?? []"
          :variables="variables" :active-resource-drag="activeResourceDrag"
          :resource-drop-state="resourceDropFeedback.status"
          :resource-drop-node-id="resourceDropFeedback.nodeId"
          :resource-drop-target-kind="resourceDropFeedback.targetKind"
          @edit-tool="(nodeId, stepId) => emit('editTool', nodeId, stepId)"
          @edit-reusable-tool="(nodeId, reusableToolId) => emit('editReusableTool', nodeId, reusableToolId)"
          @change-tool="(nodeId, stepId, operation) => emit('changeTool', nodeId, stepId, operation)"
          @reorder-tool="(nodeId, stepId, targetIndex) => emit('reorderTool', nodeId, stepId, targetIndex)"
          @tool-step-context-menu="(nodeId, stepId, point) => emit('toolStepContextMenu', nodeId, stepId, point)"
          @resource-enter="resourceEnter"
          @resource-leave="resourceLeave"
          @resource-drop="handleResourceDrop"
          @unbind-tool="unbindTool"
          @unbind-knowledge-space="unbindKnowledgeSpace"
          @update-agent-action="(nodeId, details) => emit('updateAgentAction', nodeId, details)"
          @update-node-name="(nodeId, name) => emit('updateNodeName', nodeId, name)"
          @resize-node="(nodeId, size) => emit('resize', nodeId, size)"
        />
      </template>
    </VueFlow>
    <p v-if="projection.diagnostics.length" class="canvas-diagnostic" role="status">Some nodes use temporary fallback positions. Move and save them to repair layout.</p>
  </section>
</template>
