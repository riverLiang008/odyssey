<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import type { Connection } from '@vue-flow/core'
import type { AgentActionNode, BranchNode, LoopNode, TaskNode, UUID, WorkflowEdge } from '@odyssey/schemas'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { useEditorRepository } from '@/app/editorRepository'
import { appShellPresentationKey } from '@/app/appShellPresentation'
import RouteBoundary from '@/app/RouteBoundary.vue'
import {
  connectionToIntent,
  type WorkflowCanvasIntent,
  type WorkflowPaletteNodeType,
  type WorkflowResourceDragPayload,
  type WorkflowResourceDropAction,
} from '@/canvas/workflow'
import {
  cryptoWorkflowIdFactory,
  type AgentActionDraftValues,
  type AddableLoopBodyNode,
  type LoopDraftValues,
  type WorkflowDraftErrorCode,
} from '@/domain/workflow'
import { InlineLoopCanvas, ReusableToolsPanel, WorkflowCanvas, WorkflowNodeCreationDialog, WorkflowNodePalette, WorkflowResourceBrowser, WorkflowSidePanelHost } from '@/features/workflow-editor'
import { parseAgentWorkflowRoute, routeLocations } from '@/router/routeContracts'
import { useWorkflowEditorStore, type WorkflowCanvasContext, type WorkflowResourceCategory } from '@/stores/workflowEditor'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import RevisionConflictDialog from '@/features/editor-persistence/RevisionConflictDialog.vue'
import UnsavedChangesDialog from '@/features/editor-persistence/UnsavedChangesDialog.vue'
import SystemToolPanel from '@/features/workflow-editor/SystemToolPanel.vue'
import AgentReusableToolPanel from '@/features/workflow-editor/AgentReusableToolPanel.vue'
import AgentVariablesPanel from '@/features/workflow-editor/AgentVariablesPanel.vue'
import enterFocusModeIcon from '@/assets/enter-focus-mode.svg'

const route = useRoute()
const repository = useEditorRepository()
const store = useWorkflowEditorStore()
const appShellPresentation = inject(appShellPresentationKey, null)
const { document, persistence, session, hasUnsavedChanges, knowledgeSpaces, knowledgeInventory, systemTools, systemToolStatus, systemToolDraft, toolError, toolKnowledgeSpaces, toolKnowledgeStatus, variableError } = storeToRefs(store)
const identity = computed(() => parseAgentWorkflowRoute(route.params.journeyId, route.params.agentId))
const workflowCanvas = ref<{ createFromClientPoint: (nodeType: WorkflowPaletteNodeType, clientX: number, clientY: number) => boolean } | null>(null)
const focusReturnTarget = ref<globalThis.HTMLElement | null>(null)
const draftError = ref<string | null>(null)
const activeResourceDrag = ref<WorkflowResourceDragPayload | null>(null)
type CanvasContextMenu =
  | { type: 'node'; nodeId: UUID; context: WorkflowCanvasContext; x: number; y: number }
  | { type: 'edge'; edgeId: UUID; context: WorkflowCanvasContext; x: number; y: number }
  | { type: 'task-tool-step'; nodeId: UUID; stepId: UUID; context: WorkflowCanvasContext; x: number; y: number }
const canvasContextMenu = ref<CanvasContextMenu | null>(null)
const conflictDialogOpen = ref(false)
const saveErrorToastVisible = ref(false)
const reusableToolSavedToastVisible = ref(false)
let interactionToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
let saveErrorToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
let reusableToolSavedToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
const activeLoop = computed<LoopNode | null>(() => {
  const context = session.value.context
  if (context.kind !== 'loop-body') return null
  const node = document.value?.workflow.nodes.find((candidate) => candidate.id === context.loopNodeId)
  return node?.type === 'loop' ? node : null
})
const expandedLoop = computed<LoopNode | null>(() => {
  const presentation = session.value.loopPresentation
  if (presentation.type !== 'expanded-inline') return null
  const node = document.value?.workflow.nodes.find((candidate) => candidate.id === presentation.loopNodeId)
  return node?.type === 'loop' ? node : null
})
const saveLabel = computed(() => {
  if (persistence.value.saveStatus === 'saving') return 'Saving…'
  if (persistence.value.saveStatus === 'saved') return 'Saved'
  if (persistence.value.saveStatus === 'error') return 'Save failed'
  if (persistence.value.saveStatus === 'conflict') return 'Conflict'
  return persistence.value.mutationSeq > persistence.value.savedMutationSeq ? 'Unsaved changes' : 'Ready'
})
watch(() => persistence.value.saveStatus, (status) => {
  if (status === 'conflict') conflictDialogOpen.value = true
  else conflictDialogOpen.value = false
  if (saveErrorToastTimer) globalThis.clearTimeout(saveErrorToastTimer)
  saveErrorToastTimer = null
  saveErrorToastVisible.value = status === 'error'
  if (status === 'error') {
    saveErrorToastTimer = globalThis.setTimeout(() => {
      saveErrorToastVisible.value = false
      saveErrorToastTimer = null
    }, 4500)
  }
})
const activeGraph = computed(() => activeLoop.value?.config.body.graph ?? document.value?.workflow ?? null)
const activeLayout = computed(() => activeLoop.value?.config.body.layout ?? document.value?.layout ?? null)
const activeCanvasId = computed(() => activeLoop.value ? `loop-${activeLoop.value.id}` : 'workflow-root')
const selectedNode = computed(() => {
  const panel = session.value.panel
  if (panel?.type === 'loop-inspector') {
    return document.value?.workflow.nodes.find((node) => node.id === panel.loopNodeId) ?? null
  }
  return activeGraph.value?.nodes.find((node) => node.id === session.value.selectedNodeId) ?? null
})
const taskToolDraft = computed(() => systemToolDraft.value?.host === 'task' ? systemToolDraft.value : null)
const reusableToolDraft = computed(() => systemToolDraft.value?.host === 'agent-action' || systemToolDraft.value?.host === 'reusable-tool-library' ? systemToolDraft.value : null)
const toolTask = computed(() => taskToolDraft.value ? store.toolTask(taskToolDraft.value.context, taskToolDraft.value.nodeId) : null)
function editTool(nodeId: UUID, stepId: UUID) { store.editSystemTool(session.value.context, nodeId, stepId) }
function changeTool(nodeId: UUID, stepId: UUID, operation: 'delete' | 'up' | 'down') { store.changeSystemTool(session.value.context, nodeId, operation === 'delete' ? { type: 'delete', stepId } : { type: 'move', stepId, direction: operation === 'up' ? -1 : 1 }) }
function reorderTool(nodeId: UUID, stepId: UUID, targetIndex: number) { store.changeSystemTool(session.value.context, nodeId, { type: 'reorder', stepId, targetIndex }) }
function openTaskToolStepContextMenu(nodeId: UUID, stepId: UUID, context: WorkflowCanvasContext, point: { x: number; y: number }) {
  if (session.value.mode !== 'configure') return
  canvasContextMenu.value = { type: 'task-tool-step', nodeId, stepId, context, x: point.x, y: point.y }
}
function editContextToolStep() {
  const menu = canvasContextMenu.value
  if (menu?.type !== 'task-tool-step') return
  store.editSystemTool(menu.context, menu.nodeId, menu.stepId)
  canvasContextMenu.value = null
}
function saveContextToolStepToReusableTools() {
  const menu = canvasContextMenu.value
  if (menu?.type !== 'task-tool-step') return
  const saved = store.saveTaskToolStepToReusableTools(menu.context, menu.nodeId, menu.stepId)
  canvasContextMenu.value = null
  if (!saved) return
  if (reusableToolSavedToastTimer) globalThis.clearTimeout(reusableToolSavedToastTimer)
  reusableToolSavedToastVisible.value = true
  reusableToolSavedToastTimer = globalThis.setTimeout(() => {
    reusableToolSavedToastVisible.value = false
    reusableToolSavedToastTimer = null
  }, 2600)
}
function deleteContextToolStep() {
  const menu = canvasContextMenu.value
  if (menu?.type !== 'task-tool-step') return
  store.changeSystemTool(menu.context, menu.nodeId, { type: 'delete', stepId: menu.stepId })
  canvasContextMenu.value = null
}
const selectedEdge = computed<WorkflowEdge | null>(() => activeGraph.value?.edges.find((edge) => edge.id === session.value.selectedEdgeId) ?? null)

watch(identity, (next) => {
  if (next) void store.load(next.journeyId, next.agentId, repository)
  else store.dispose()
}, { immediate: true })
const unsavedChangesGuard = useUnsavedChangesGuard(hasUnsavedChanges, () => store.save(repository))
onUnmounted(() => store.dispose())
watch(
  () => [store.lastDomainError?.code ?? null, store.lastCanvasError] as const,
  ([domainError, canvasError]) => {
    if (interactionToastTimer) globalThis.clearTimeout(interactionToastTimer)
    interactionToastTimer = null
    if (!domainError && !canvasError) return
    interactionToastTimer = globalThis.setTimeout(() => store.clearWorkflowErrors(), 3200)
  },
)
onUnmounted(() => {
  if (interactionToastTimer) globalThis.clearTimeout(interactionToastTimer)
  if (saveErrorToastTimer) globalThis.clearTimeout(saveErrorToastTimer)
  if (reusableToolSavedToastTimer) globalThis.clearTimeout(reusableToolSavedToastTimer)
})
watch(() => session.value.focusMode, (enabled) => appShellPresentation?.setFocusMode(enabled), { immediate: true })
appShellPresentation?.setProductHeaderVisible(false)
onUnmounted(() => {
  appShellPresentation?.setFocusMode(false)
  appShellPresentation?.setProductHeaderVisible(true)
})

function keyboardDelete(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape' && canvasContextMenu.value) { canvasContextMenu.value = null; return }
  if (event.key === 'Escape' && session.value.creationDraft.type !== 'closed') { closeCreationDraft(); return }
  if (event.key === 'Escape' && session.value.focusMode) { void setFocusMode(false); return }
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  const target = event.target
  if (target instanceof globalThis.HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
  if (session.value.mode !== 'configure') return
  if (session.value.selectedNodeId) removeActiveNode(session.value.selectedNodeId)
  else if (session.value.selectedEdgeId) removeActiveEdge(session.value.selectedEdgeId)
}
onMounted(() => globalThis.window.addEventListener('keydown', keyboardDelete))
onMounted(() => {
  if (globalThis.window.innerWidth <= 1100) store.setResourceBrowserCollapsed(true)
})
onUnmounted(() => globalThis.window.removeEventListener('keydown', keyboardDelete))

function retry() {
  const current = identity.value
  if (current) void store.load(current.journeyId, current.agentId, repository)
}

function createNode(nodeType: WorkflowPaletteNodeType, point?: { x: number; y: number }) {
  const current = document.value
  if (!current || session.value.mode !== 'configure') return
  const graph = activeGraph.value
  if (!graph) return
  const createdNodeCount = Math.max(0, graph.nodes.length - 2)
  const fallback = { x: 190 + (createdNodeCount % 2) * 190, y: 260 + Math.floor(createdNodeCount / 2) * 130 }
  const placement = point ?? fallback
  if (nodeType === 'loop') {
    if (store.stageCreationDraft(nodeType, placement)) draftError.value = null
    return
  }
  const node = nodeType === 'agent_action'
    ? ({ id: cryptoWorkflowIdFactory.nodeId(), type: 'agent_action', name: 'New Agent Action', config: { model: 'gpt-5', goal: { kind: 'literal', value: '' }, knowledgeSpaceIds: [], reusableToolIds: [] } } satisfies AgentActionNode)
    : nodeType === 'task'
    ? ({ id: cryptoWorkflowIdFactory.nodeId(), type: 'task', name: 'New Task', config: { localVariables: [], steps: [] } } satisfies TaskNode)
    : ({
        id: cryptoWorkflowIdFactory.nodeId(),
        type: 'branch',
        name: 'New Branch',
        config: { cases: [], defaultCase: { id: cryptoWorkflowIdFactory.branchHandleId(), label: 'Default' } },
      } satisfies BranchNode)
  if (!activeLoop.value) { store.createWorkflowNode(node, placement); return }
  const result = store.createWorkflowLoopBodyNode(activeLoop.value.id, node as AddableLoopBodyNode, placement)
  if (!result?.ok) return
  store.selectNode(node.id)
  store.selectEdge(null)
  store.setPanel({ type: 'node-inspector', nodeId: node.id })
}

const draftErrorMessages: Record<WorkflowDraftErrorCode, string> = {
  NAME_REQUIRED: 'Enter a node name.',
  MODEL_REQUIRED: 'Enter a model.',
  GOAL_REQUIRED: 'Describe the Agent Action goal.',
  MAX_TURNS_INVALID: 'Maximum turns must be a positive whole number.',
  VARIABLE_REQUIRED: 'Choose an Agent Variable.',
  COMPARISON_VALUE_INVALID: 'Enter a comparison value that matches the variable type.',
  DRAFT_SCHEMA_INVALID: 'This node configuration is invalid. Review the fields and try again.',
}
function submitAgentActionDraft(values: AgentActionDraftValues) {
  const result = store.submitAgentActionDraft(values, cryptoWorkflowIdFactory)
  draftError.value = result.ok ? null : draftErrorMessages[result.error.code]
}
function submitLoopDraft(values: LoopDraftValues) {
  const result = store.submitLoopDraft(values, cryptoWorkflowIdFactory)
  draftError.value = result.ok ? null : draftErrorMessages[result.error.code]
}
function closeCreationDraft() { store.closeCreationDraft(); draftError.value = null }

function removeActiveNode(nodeId: UUID) {
  if (session.value.mode !== 'configure') return
  const loop = activeLoop.value
  if (!loop || loop.id === nodeId) {
    store.removeWorkflowNodeWithLayout(nodeId)
    if (loop?.id === nodeId) store.collapseInlineLoop()
    return
  }
  const result = store.removeWorkflowLoopBodyNode(loop.id, nodeId)
  if (!result?.ok) return
  closeInspector()
}

function openNodeContextMenu(nodeId: UUID, context: WorkflowCanvasContext, point: { x: number; y: number }) {
  if (session.value.mode !== 'configure') return
  canvasContextMenu.value = {
    type: 'node',
    nodeId,
    context,
    x: Math.min(point.x, globalThis.window.innerWidth - 176),
    y: Math.min(point.y, globalThis.window.innerHeight - 64),
  }
}
function openEdgeContextMenu(edgeId: UUID, context: WorkflowCanvasContext, point: { x: number; y: number }) {
  if (session.value.mode !== 'configure') return
  canvasContextMenu.value = {
    type: 'edge',
    edgeId,
    context,
    x: Math.min(point.x, globalThis.window.innerWidth - 176),
    y: Math.min(point.y, globalThis.window.innerHeight - 64),
  }
}
function closeCanvasContextMenu() { canvasContextMenu.value = null }
function deleteContextNode() {
  const target = canvasContextMenu.value
  if (!target || target.type !== 'node') return
  canvasContextMenu.value = null
  if (target.context.kind === 'root') {
    store.removeWorkflowNodeWithLayout(target.nodeId)
    if (expandedLoop.value?.id === target.nodeId) store.collapseInlineLoop()
    return
  }
  store.removeWorkflowLoopBodyNode(target.context.loopNodeId, target.nodeId)
}
function deleteContextEdge() {
  const target = canvasContextMenu.value
  if (!target || target.type !== 'edge') return
  canvasContextMenu.value = null
  if (target.context.kind === 'root') { store.removeWorkflowEdge(target.edgeId); return }
  store.removeWorkflowLoopBodyEdge(target.context.loopNodeId, target.edgeId)
}

function removeActiveEdge(edgeId: UUID) {
  if (session.value.mode !== 'configure') return
  const loop = activeLoop.value
  if (!loop) { store.removeWorkflowEdge(edgeId); return }
  const result = store.removeWorkflowLoopBodyEdge(loop.id, edgeId)
  if (!result?.ok) return
  closeInspector()
}

function handleIntent(intent: WorkflowCanvasIntent) {
  switch (intent.type) {
    case 'select-node':
      store.selectNode(intent.nodeId)
      if (intent.nodeId) {
        store.selectEdge(null)
        const node = activeGraph.value?.nodes.find((candidate) => candidate.id === intent.nodeId)
        store.setPanel(node?.type === 'loop' ? { type: 'node-inspector', nodeId: intent.nodeId } : { type: session.value.resourceBrowser.category })
      } else if (!session.value.selectedEdgeId) store.setPanel(null)
      return
    case 'select-edge':
      store.selectEdge(intent.edgeId)
      if (intent.edgeId) {
        store.selectNode(null)
        store.setPanel({ type: session.value.resourceBrowser.category })
      } else if (!session.value.selectedNodeId) store.setPanel(null)
      return
    case 'move-node': {
      const loop = activeLoop.value
      if (!loop) store.moveWorkflowNode(intent.nodeId, { x: intent.x, y: intent.y })
      else store.moveWorkflowLoopBodyNode(loop.id, intent.nodeId, { x: intent.x, y: intent.y })
      return
    }
    case 'update-viewport': {
      const loop = activeLoop.value
      if (!loop) store.setViewport({ x: intent.x, y: intent.y, zoom: intent.zoom })
      else store.setWorkflowLoopBodyViewport(loop.id, { x: intent.x, y: intent.y, zoom: intent.zoom })
      return
    }
    case 'create-node': createNode(intent.nodeType, { x: intent.x, y: intent.y }); return
  }
}

function handleConnect(connection: Connection) {
  const intent = connectionToIntent(connection, cryptoWorkflowIdFactory.edgeId())
  if (!intent) return
  const loop = activeLoop.value
  if (!loop) store.connectWorkflowNodes(intent)
  else store.connectWorkflowLoopBodyNodes(loop.id, intent)
}

function ensureExpandedLoopContext() {
  const loop = expandedLoop.value
  if (loop && (session.value.context.kind !== 'loop-body' || session.value.context.loopNodeId !== loop.id)) {
    store.switchCanvasContext({ kind: 'loop-body', loopNodeId: loop.id })
  }
}
function handleChildIntent(intent: WorkflowCanvasIntent) { ensureExpandedLoopContext(); handleIntent(intent) }
function handleChildConnect(connection: Connection) { ensureExpandedLoopContext(); handleConnect(connection) }
function createChildNode(nodeType: WorkflowPaletteNodeType, point: { x: number; y: number }) { ensureExpandedLoopContext(); createNode(nodeType, point) }
function selectRootNode(nodeId: UUID) {
  if (session.value.context.kind !== 'root') store.switchCanvasContext({ kind: 'root' })
  store.selectNode(nodeId)
  store.selectEdge(null)
  const node = document.value?.workflow.nodes.find((candidate) => candidate.id === nodeId)
  store.setPanel(node?.type === 'loop' ? { type: 'node-inspector', nodeId } : { type: session.value.resourceBrowser.category })
}

function closeInspector() {
  store.selectNode(null)
  store.selectEdge(null)
  store.setPanel({ type: session.value.resourceBrowser.category })
}

function save() { void store.save(repository) }
function retrySave() {
  saveErrorToastVisible.value = false
  void store.retrySave()
}
function reloadServerVersion() {
  conflictDialogOpen.value = false
  void store.reloadAfterConflict()
}
function overwriteServerVersion() {
  conflictDialogOpen.value = false
  void store.overwriteAfterConflict()
}
function dropPaletteNode(nodeType: WorkflowPaletteNodeType, point: { clientX: number; clientY: number }) {
  workflowCanvas.value?.createFromClientPoint(nodeType, point.clientX, point.clientY)
}

function openLoop(loopNodeId: string) {
  const id = loopNodeId as UUID
  if (!store.expandLoopInline(id)) return
  store.selectNode(null)
  store.selectEdge(null)
  store.setPanel({ type: 'loop-inspector', loopNodeId: id })
}
function selectResourceCategory(category: WorkflowResourceCategory) {
  store.setResourceBrowserCategory(category)
  if (category === 'knowledge-spaces') void store.loadKnowledgeSpaces(repository)
}
function searchResources(query: string) {
  store.setResourceBrowserQuery(query)
  if (session.value.resourceBrowser.category === 'knowledge-spaces') void store.loadKnowledgeSpaces(repository)
}
function changeResourcePage(page: number) {
  store.setResourceBrowserPage(page)
  if (session.value.resourceBrowser.category === 'knowledge-spaces') void store.loadKnowledgeSpaces(repository)
}
function updateAgentActionTools(toolId: UUID, bind: boolean) {
  if (session.value.mode !== 'configure') return
  const node = selectedNode.value
  if (!node) return
  if (bind) store.bindWorkflowAgentActionReusableTool(session.value.context, node.id, toolId)
  else store.unbindWorkflowAgentActionReusableTool(session.value.context, node.id, toolId)
}
function updateAgentActionKnowledgeSpaces(knowledgeSpaceId: UUID, bind: boolean) {
  if (session.value.mode !== 'configure') return
  const node = selectedNode.value
  if (!node) return
  if (bind) store.bindWorkflowAgentActionKnowledgeSpace(session.value.context, node.id, knowledgeSpaceId)
  else store.unbindWorkflowAgentActionKnowledgeSpace(session.value.context, node.id, knowledgeSpaceId)
}
function updateAgentActionDetails(nodeId: UUID, details: { name: string; model: string; goal: string }) {
  if (session.value.mode !== 'configure') return
  store.updateWorkflowAgentActionDetails(session.value.context, nodeId, details)
}
function updateNodeName(nodeId: UUID, name: string) {
  if (session.value.mode !== 'configure') return
  store.renameWorkflowNode(session.value.context, nodeId, name)
}
function handleResourceDrop(action: WorkflowResourceDropAction) {
  if (session.value.mode !== 'configure') return
  switch (action.type) {
    case 'configure-system-tool':
      store.openSystemTool(session.value.context, action.nodeId, action.toolDefinitionId)
      return
    case 'bind-reusable-tool':
      store.bindWorkflowAgentActionReusableTool(session.value.context, action.nodeId, action.reusableToolId)
      return
    case 'unbind-reusable-tool':
      store.unbindWorkflowAgentActionReusableTool(session.value.context, action.nodeId, action.reusableToolId)
      return
    case 'append-task-tool-step':
      store.appendWorkflowTaskToolStep(session.value.context, action.nodeId, action.reusableToolId)
      return
    case 'bind-knowledge-space':
      store.bindWorkflowAgentActionKnowledgeSpace(session.value.context, action.nodeId, action.knowledgeSpaceId)
      return
    case 'unbind-knowledge-space':
      store.unbindWorkflowAgentActionKnowledgeSpace(session.value.context, action.nodeId, action.knowledgeSpaceId)
      return
  }
}
function activateResource(payload: WorkflowResourceDragPayload) {
  if (session.value.mode !== 'configure') return
  const node = selectedNode.value
  if (!node) { store.rejectCanvasInteraction('INVALID_RESOURCE_TARGET'); return }
  if (payload.kind === 'system-tool-definition') { store.openSystemTool(session.value.context, node.id, payload.toolDefinitionId); return }
  if (payload.kind === 'reusable-tool' && node.type === 'agent_action') {
    handleResourceDrop({ type: 'bind-reusable-tool', nodeId: node.id, reusableToolId: payload.resourceId })
    return
  }
  if (payload.kind === 'reusable-tool' && node.type === 'task') {
    handleResourceDrop({ type: 'append-task-tool-step', nodeId: node.id, reusableToolId: payload.resourceId })
    return
  }
  if (payload.kind === 'knowledge-space' && node.type === 'agent_action') {
    handleResourceDrop({ type: 'bind-knowledge-space', nodeId: node.id, knowledgeSpaceId: payload.resourceId })
    return
  }
  store.rejectCanvasInteraction('WRONG_RESOURCE_TYPE')
}
function exitLoop() { store.collapseInlineLoop() }
function updateLoop(details: Pick<LoopNode, 'name'> & Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>) {
  if (session.value.mode !== 'configure') return
  const loop = expandedLoop.value ?? activeLoop.value ?? (selectedNode.value?.type === 'loop' ? selectedNode.value : null)
  if (loop) store.updateWorkflowLoopDetails(loop.id, details)
}

function canvasErrorMessage(code: string): string {
  if (code === 'INVALID_CONNECTION') return 'Connection rejected. Choose compatible handles and keep the workflow acyclic.'
  if (code === 'INVALID_RESOURCE_TARGET') return 'Drop rejected. Drop the Tool into an Agent Action Toolbox or Task sequence.'
  if (code === 'WRONG_RESOURCE_TYPE') return 'Drop rejected. This resource type is not supported by that target.'
  if (code === 'RESOURCE_ALREADY_BOUND') return 'Drop rejected. This resource is already linked to the target.'
  if (code === 'RESOURCE_NOT_AVAILABLE') return 'Drop rejected. This resource is no longer available in the Agent.'
  return 'Drop rejected. Drag an enabled Workflow node from the Palette onto the Canvas.'
}
async function setFocusMode(enabled: boolean) {
  if (enabled) focusReturnTarget.value = globalThis.document.activeElement as globalThis.HTMLElement | null
  store.setFocusMode(enabled)
  await nextTick()
  if (!enabled) focusReturnTarget.value?.focus()
}
</script>

<template>
  <section v-if="!identity" class="proof-page"><h1>Invalid Agent Workflow</h1><RouterLink to="/journeys">Return to Journeys</RouterLink></section>
  <RouteBoundary v-else-if="persistence.loadStatus !== 'ready'" :status="persistence.loadStatus" subject="Agent workflow" :error="persistence.error" :back-to="routeLocations.journey(identity.journeyId)" back-label="Return to Journey" @retry="retry" />
  <section v-else-if="document" class="editor-page workflow-editor-page" :class="{ 'is-focus-mode': session.focusMode }" @click="closeCanvasContextMenu">
    <header class="workflow-toolbar">
      <div class="workflow-context-path">
        <RouterLink :to="routeLocations.journey(document.agent.journeyId)">← OdyJourney / {{ document.agent.name }}</RouterLink>
        <button v-if="expandedLoop" type="button" @click="exitLoop">Root workflow</button>
        <span v-if="expandedLoop">/ {{ expandedLoop.name }}</span>
      </div>
      <nav class="workflow-resource-nav" aria-label="Agent resource configuration">
        <button v-for="item in ([['tools', 'Tools'], ['knowledge-spaces', 'Knowledge Spaces'], ['agent-variables', 'Agent Variables'], ['dsl-edit', 'DSL Edit'], ['reusable-tools', 'Reusable Tools']] as const)" :key="item[0]" type="button" :class="{ 'is-active': session.resourceBrowser.category === item[0] && !session.resourceBrowser.collapsed }" @click="selectResourceCategory(item[0])">{{ item[1] }}</button>
      </nav>
      <div class="workflow-toolbar-actions">
        <span class="save-state" role="status">{{ saveLabel }}</span>
        <button v-if="persistence.saveStatus === 'conflict'" type="button" class="save-button" @click="conflictDialogOpen = true">Resolve conflict</button>
        <button v-else type="button" class="save-button" :disabled="persistence.saveStatus === 'saving' || persistence.mutationSeq === persistence.savedMutationSeq" @click="save">Save now</button>
      </div>
    </header>
    <Transition name="save-toast">
      <div v-if="saveErrorToastVisible && persistence.error && persistence.error.code !== 'REVISION_CONFLICT'" class="workflow-save-toast" role="alert" aria-live="assertive">
        <span><strong>Save failed</strong><small>Your local work is preserved.</small></span>
        <button type="button" @click="retrySave">Retry</button>
      </div>
    </Transition>
    <Transition name="save-toast">
      <div v-if="reusableToolSavedToastVisible" class="workflow-save-toast is-success" role="status" aria-live="polite">
        <span><strong>Saved</strong><small>Added to Reusable Tools.</small></span>
      </div>
    </Transition>
    <Transition name="workflow-toast">
      <p v-if="store.lastDomainError" class="workflow-interaction-toast" role="alert">Action rejected: {{ store.lastDomainError.code.replaceAll('_', ' ').toLowerCase() }}.</p>
      <p v-else-if="store.lastCanvasError" class="workflow-interaction-toast" role="alert">{{ canvasErrorMessage(store.lastCanvasError) }}</p>
    </Transition>
    <div class="workflow-editor-layout" :class="{ 'is-palette-collapsed': session.paletteCollapsed, 'is-resource-collapsed': session.resourceBrowser.collapsed }">
      <WorkflowNodePalette :collapsed="session.paletteCollapsed" :disabled="session.mode !== 'configure'" :can-create-loop="session.context.kind === 'root' && document.variables.length > 0" :loop-disabled-reason="session.context.kind === 'loop-body' ? 'Nested Loops are not supported' : 'Create an Agent Variable first'" @collapse="store.setPaletteCollapsed" @create="createNode" @drop="dropPaletteNode" />
      <main class="workflow-canvas-panel">
        <div class="workflow-canvas-controls">
          <div class="mode-toggle"><button type="button" :class="{ 'is-active': session.mode === 'flow' }" @click="store.setMode('flow')">Flow</button><button type="button" :class="{ 'is-active': session.mode === 'configure' }" @click="store.setMode('configure')">Configure</button></div>
          <button type="button" class="focus-button" :aria-label="session.focusMode ? 'Exit focus mode' : 'Enter focus mode'" :title="session.focusMode ? 'Exit focus mode' : 'Enter focus mode'" @click="setFocusMode(!session.focusMode)"><img :src="enterFocusModeIcon" alt="" /></button>
        </div>
        <InlineLoopCanvas v-if="expandedLoop && document" :key="`inline-${expandedLoop.id}`" ref="workflowCanvas" :canvas-id="`loop-${expandedLoop.id}`" :root-graph="document.workflow" :loop="expandedLoop" :mode="session.mode" :selected-node-id="session.context.kind === 'loop-body' ? session.selectedNodeId : null" :root-selected-node-id="session.context.kind === 'root' ? session.selectedNodeId : null" :variables="document.variables" :system-tools="systemTools" :available-reusable-tool-ids="document.reusableTools.map((tool) => tool.id)" :reusable-tools="document.reusableTools" :knowledge-spaces="knowledgeSpaces" :active-resource-drag="activeResourceDrag" @edit-tool="(nodeId, stepId) => { ensureExpandedLoopContext(); editTool(nodeId, stepId) }" @edit-reusable-tool="(nodeId, toolId) => { ensureExpandedLoopContext(); store.editAgentReusableTool(session.context, nodeId, toolId) }" @change-tool="(nodeId, stepId, op) => { ensureExpandedLoopContext(); changeTool(nodeId, stepId, op) }" @reorder-tool="(nodeId, stepId, targetIndex) => { ensureExpandedLoopContext(); reorderTool(nodeId, stepId, targetIndex) }" @tool-step-context-menu="openTaskToolStepContextMenu" @intent="handleChildIntent" @connect="handleChildConnect" @create="createChildNode" @select-root="selectRootNode" @collapse="exitLoop" @clear-error="store.clearWorkflowErrors" @reject="store.rejectCanvasInteraction" @resource-drop="(action) => { ensureExpandedLoopContext(); handleResourceDrop(action) }" @update-agent-action="updateAgentActionDetails" @update-node-name="updateNodeName" @node-context-menu="openNodeContextMenu" @edge-context-menu="openEdgeContextMenu" />
        <WorkflowCanvas v-else-if="activeGraph && activeLayout" :key="activeCanvasId" ref="workflowCanvas" :canvas-id="activeCanvasId" :graph="activeGraph" :layout="activeLayout" :mode="session.mode" :selected-node-id="session.selectedNodeId" :variables="document.variables" :system-tools="systemTools" :available-reusable-tool-ids="document.reusableTools.map((tool) => tool.id)" :reusable-tools="document.reusableTools" :knowledge-spaces="knowledgeSpaces" :active-resource-drag="activeResourceDrag" @edit-tool="editTool" @edit-reusable-tool="(nodeId, toolId) => store.editAgentReusableTool(session.context, nodeId, toolId)" @change-tool="changeTool" @reorder-tool="reorderTool" @tool-step-context-menu="(nodeId, stepId, point) => openTaskToolStepContextMenu(nodeId, stepId, session.context, point)" @intent="handleIntent" @connect="handleConnect" @create="createNode" @clear-error="store.clearWorkflowErrors" @reject="store.rejectCanvasInteraction" @resource-drop="handleResourceDrop" @update-agent-action="updateAgentActionDetails" @update-node-name="updateNodeName" @node-context-menu="(nodeId, point) => openNodeContextMenu(nodeId, session.context, point)" @edge-context-menu="(edgeId, point) => openEdgeContextMenu(edgeId, session.context, point)" />
      </main>
      <div class="workflow-right-panel-host">
        <WorkflowSidePanelHost v-if="!systemToolDraft && (session.panel?.type === 'node-inspector' || session.panel?.type === 'loop-inspector')" :node="selectedNode" :edge="selectedEdge" :tools="document.reusableTools" :variables="document.variables" :knowledge-spaces="knowledgeSpaces" :knowledge-status="knowledgeInventory.status" :loop-expanded="Boolean(expandedLoop)" :read-only="session.mode === 'flow'" @close="closeInspector" @open-loop="openLoop" @update-loop="updateLoop" @bind-tool="updateAgentActionTools($event, true)" @unbind-tool="updateAgentActionTools($event, false)" @bind-knowledge-space="updateAgentActionKnowledgeSpaces($event, true)" @unbind-knowledge-space="updateAgentActionKnowledgeSpaces($event, false)" @reject-resource="store.rejectCanvasInteraction" />
        <SystemToolPanel v-else-if="taskToolDraft && toolTask" :key="`${taskToolDraft.nodeId}-${taskToolDraft.step?.id ?? taskToolDraft.kind}`" :draft="taskToolDraft" :task="toolTask" :variables="document.variables" :knowledge-spaces="toolKnowledgeSpaces" :knowledge-status="toolKnowledgeStatus" :error="toolError" @save="store.saveSystemTool" @cancel="store.cancelSystemTool" />
        <AgentReusableToolPanel v-else-if="reusableToolDraft" :key="`${reusableToolDraft.host}-${reusableToolDraft.tool?.id ?? reusableToolDraft.kind}`" :draft="reusableToolDraft" :variables="document.variables" :knowledge-spaces="toolKnowledgeSpaces" :knowledge-status="toolKnowledgeStatus" @save="store.saveAgentReusableTool" @cancel="store.cancelSystemTool" />
        <AgentVariablesPanel v-else-if="session.resourceBrowser.category === 'agent-variables' && !session.resourceBrowser.collapsed" :variables="document.variables" :read-only="session.mode === 'flow'" :error="variableError" :reference-count="store.variableReferenceCount" @save="store.saveAgentVariable" @delete="store.deleteAgentVariable" @collapse="store.setResourceBrowserCollapsed(true)" />
        <ReusableToolsPanel v-else-if="session.resourceBrowser.category === 'reusable-tools' && !session.resourceBrowser.collapsed" :agent-name="document.agent.name" :tools="document.reusableTools" :read-only="session.mode === 'flow'" :reference-count="store.reusableToolReferenceCount" @collapse="store.setResourceBrowserCollapsed(true)" @edit="store.editLibraryReusableTool" @delete="store.deleteLibraryReusableTool" @browse-system-tools="selectResourceCategory('tools')" @resource-drag-start="activeResourceDrag = $event" @resource-drag-end="activeResourceDrag = null" />
        <WorkflowResourceBrowser v-else :system-tools="systemTools" :system-tool-status="systemToolStatus" :collapsed="session.resourceBrowser.collapsed" :category="session.resourceBrowser.category" :query="session.resourceBrowser.query" :page="session.resourceBrowser.page" :page-size="session.resourceBrowser.pageSize" :tools="document.reusableTools" :knowledge-spaces="knowledgeSpaces" :knowledge-status="knowledgeInventory.status" :knowledge-total="knowledgeInventory.total" :read-only="session.mode === 'flow'" @collapse="store.setResourceBrowserCollapsed" @category="selectResourceCategory" @search="searchResources" @page="changeResourcePage" @resource-drag-start="activeResourceDrag = $event" @resource-drag-end="activeResourceDrag = null" @resource-activate="activateResource" />
      </div>
    </div>
    <div v-if="canvasContextMenu" class="workflow-canvas-context-menu" role="menu" :aria-label="canvasContextMenu.type === 'node' ? 'Node actions' : canvasContextMenu.type === 'edge' ? 'Route actions' : 'Tool step actions'" :style="{ left: `${canvasContextMenu.x}px`, top: `${canvasContextMenu.y}px` }" @click.stop>
      <button v-if="canvasContextMenu.type === 'node'" type="button" role="menuitem" @click="deleteContextNode">Delete node</button>
      <button v-else-if="canvasContextMenu.type === 'edge'" type="button" role="menuitem" @click="deleteContextEdge">Delete route</button>
      <template v-else><button type="button" role="menuitem" class="is-neutral" @click="editContextToolStep">Edit configuration</button><button type="button" role="menuitem" class="is-neutral" @click="saveContextToolStepToReusableTools">Save to Reusable Tools</button><button type="button" role="menuitem" @click="deleteContextToolStep">Delete step</button></template>
    </div>
    <WorkflowNodeCreationDialog v-if="session.creationDraft.type !== 'closed'" :draft="session.creationDraft" :variables="document.variables" :error="draftError" @close="closeCreationDraft" @submit-agent-action="submitAgentActionDraft" @submit-loop="submitLoopDraft" />
    <RevisionConflictDialog v-if="conflictDialogOpen" subject="Workflow" @stay="conflictDialogOpen = false" @reload="reloadServerVersion" @overwrite="overwriteServerVersion" />
    <UnsavedChangesDialog v-if="unsavedChangesGuard.confirmationOpen.value" @stay="unsavedChangesGuard.stay" @leave="unsavedChangesGuard.leave" />
  </section>
</template>
