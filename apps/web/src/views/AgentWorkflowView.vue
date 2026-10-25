<script setup lang="ts">
import { describeEndTarget, workflowEndRoutingStatus } from '@/domain/workflow/workflowEndRouting'
import type { ImportEndMapping } from '@/domain/workflow-import/importEndBindings'
import type { BranchPanelSession } from '@/features/workflow-editor/branchPanelSession'
import type { BranchEditIntent } from '@/domain/workflow/branchDrafts'
import { computed, shallowRef, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import type { Connection } from '@vue-flow/core'
import type { AgentActionNode, AgentWorkflowExportDocument, BranchNode, LoopNode, TaskNode, UUID, WorkflowEdge } from '@odyssey/schemas'
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
  createDefaultLoop,
  cryptoWorkflowIdFactory,
  type AgentActionDraftValues,
  type AddableLoopBodyNode,
  type LoopDraftValues,
  type WorkflowDraftErrorCode,
} from '@/domain/workflow'
import { ReusableToolsPanel, WorkflowCanvas, WorkflowImportDialog, WorkflowNodeCreationDialog, WorkflowNodePalette, WorkflowResourceBrowser, WorkflowResourceNav, WorkflowSidePanelHost, WorkflowToolsMenu } from '@/features/workflow-editor'
import { createWorkflowExport, serializeWorkflowExport, workflowExportFileName } from '@/domain/workflow-import/workflowImport'
import { downloadWorkflowJson } from '@/features/workflow-editor/workflowExportFileAdapter'
import { parseAgentWorkflowRoute, routeLocations } from '@/router/routeContracts'
import { useWorkflowEditorStore, type WorkflowCanvasContext, type WorkflowResourceCategory } from '@/stores/workflowEditor'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import RevisionConflictDialog from '@/features/editor-persistence/RevisionConflictDialog.vue'
import UnsavedChangesDialog from '@/features/editor-persistence/UnsavedChangesDialog.vue'
import SystemToolPanel from '@/features/workflow-editor/SystemToolPanel.vue'
import AgentReusableToolPanel from '@/features/workflow-editor/AgentReusableToolPanel.vue'
import AgentVariablesPanel from '@/features/workflow-editor/AgentVariablesPanel.vue'
import enterFocusModeIcon from '@/assets/enter-focus-mode.svg'
import WorkflowExitNotice from '@/features/workflow-editor/WorkflowExitNotice.vue'
import type { KnowledgeSpaceReference } from '@odyssey/schemas'
import WorkflowDslEditor from '@/features/workflow-editor/WorkflowDslEditor.vue'
import { useWorkflowDsl } from '@/features/workflow-editor/useWorkflowDsl'

const route = useRoute()
const repository = useEditorRepository()
const store = useWorkflowEditorStore()
const appShellPresentation = inject(appShellPresentationKey, null)
const { routingJourney, document, persistence, session, hasUnsavedChanges, knowledgeSpaces, knowledgeInventory, systemTools, systemToolStatus, systemToolDraft, toolError, toolKnowledgeSpaces, toolKnowledgeStatus, variableError } = storeToRefs(store)
const identity = computed(() => parseAgentWorkflowRoute(route.params.journeyId, route.params.agentId))
const dsl = useWorkflowDsl({ document, journey: routingJourney, knowledge: toolKnowledgeSpaces, knowledgeStatus: toolKnowledgeStatus, mutationSeq: () => persistence.value.mutationSeq, apply: (candidate, seq) => store.applyCompiledWorkflow(candidate, seq) })
const branchDraftCache = new Map<UUID, BranchPanelSession>()
const branchDraftDirty = ref(false)
function updateBranchDraftDirty() { branchDraftDirty.value = branchDraftCache.size > 0 }
const hasUnappliedWork = computed(() => hasUnsavedChanges.value || dsl.dirty.value || branchDraftDirty.value)
const workflowCanvas = ref<{ createFromClientPoint: (nodeType: WorkflowPaletteNodeType, clientX: number, clientY: number) => boolean } | null>(null)
const focusReturnTarget = ref<globalThis.HTMLElement | null>(null)
const focusResourceNavCompact = ref(true)
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
const workflowTransferToast = ref<'export-success' | 'export-error' | 'import-success' | 'import-error' | null>(null)
const workflowImportOpen = ref(false)
const workflowImportApplyError = ref<string | null>(null)
const importTargetEnds = computed(() => document.value?.workflow.nodes.filter((node) => node.type === 'end').map((node) => ({ id: node.id, name: node.config.binding && routingJourney.value ? describeEndTarget(node.config.binding, routingJourney.value.pattern, routingJourney.value.agents) : node.name })) ?? [])
const workflowImportKnowledgeSpaceIds = ref<ReadonlySet<string>>(new Set())
let workflowImportInventoryController: globalThis.AbortController | null = null
let interactionToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
let saveErrorToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
let reusableToolSavedToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
let workflowExportToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
const activeLoop = computed<LoopNode | null>(() => {
  const context = session.value.context
  if (context.kind !== 'loop-body') return null
  const node = document.value?.workflow.nodes.find((candidate) => candidate.id === context.loopNodeId)
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
const exitStatus = computed(() => document.value && routingJourney.value
  ? workflowEndRoutingStatus(document.value.workflow, routingJourney.value.pattern, document.value.agent.id) : null)
const activeGraph = computed(() => activeLoop.value?.config.body.graph ?? document.value?.workflow ?? null)
const branchCreation = shallowRef<{ node: BranchNode; context: WorkflowCanvasContext; point: { x: number; y: number } } | null>(null)
const branchError = ref<string | null>(null)
const branchTargetNames = computed(() => Object.fromEntries((activeGraph.value?.nodes ?? []).map(n => [n.id, n.name])))
const selectedNode = computed(() => {
  if (branchCreation.value) return branchCreation.value.node
  const panel = session.value.panel
  if (panel?.type === 'loop-inspector') {
    return document.value?.workflow.nodes.find((node) => node.id === panel.loopNodeId) ?? null
  }
  return activeGraph.value?.nodes.find((node) => node.id === session.value.selectedNodeId) ?? null
})
const taskToolDraft = computed(() => systemToolDraft.value?.host === 'task' ? systemToolDraft.value : null)
const reusableToolDraft = computed(() => systemToolDraft.value?.host === 'agent-action' || systemToolDraft.value?.host === 'reusable-tool-library' ? systemToolDraft.value : null)
const rightPanelVisible = computed(() => {
  const panelType = session.value.panel?.type
  return Boolean(
    taskToolDraft.value
    || reusableToolDraft.value
    || branchCreation.value
    || panelType === 'node-inspector'
    || panelType === 'loop-inspector'
    || !session.value.resourceBrowser.collapsed,
  )
})
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
function showWorkflowTransferToast(status: 'export-success' | 'export-error' | 'import-success' | 'import-error') {
  if (workflowExportToastTimer) globalThis.clearTimeout(workflowExportToastTimer)
  workflowTransferToast.value = status
  workflowExportToastTimer = globalThis.setTimeout(() => {
    workflowTransferToast.value = null
    workflowExportToastTimer = null
  }, status.endsWith('success') ? 2600 : 4500)
}
function exportWorkflow() {
  const current = document.value
  if (!current) return
  try {
    const now = new Date()
    const exported = createWorkflowExport(current, now.toISOString())
    const result = downloadWorkflowJson(
      workflowExportFileName(current.agent.name, now.toISOString().slice(0, 10)),
      serializeWorkflowExport(exported),
    )
    showWorkflowTransferToast(result.ok ? 'export-success' : 'export-error')
  } catch {
    showWorkflowTransferToast('export-error')
  }
}
async function openWorkflowImport() {
  workflowImportApplyError.value = null
  if (knowledgeInventory.value.status === 'ready' && knowledgeSpaces.value.length === knowledgeInventory.value.total) {
    workflowImportKnowledgeSpaceIds.value = new Set(knowledgeSpaces.value.map((space) => space.id))
    workflowImportOpen.value = true
    return
  }
  workflowImportInventoryController?.abort()
  const controller = new globalThis.AbortController()
  workflowImportInventoryController = controller
  const ids = new Set<string>()
  let page = 1
  let total = 0
  let fetched = 0
  do {
    const result = await repository.listKnowledgeSpaces({ page, pageSize: 100 }, { signal: controller.signal })
    if (controller.signal.aborted) return
    if (!result.ok) {
      workflowImportInventoryController = null
      showWorkflowTransferToast('import-error')
      return
    }
    result.value.items.forEach((space) => ids.add(space.id))
    fetched += result.value.items.length
    total = result.value.total
    if (result.value.items.length === 0 && fetched < total) {
      workflowImportInventoryController = null
      showWorkflowTransferToast('import-error')
      return
    }
    page += 1
  } while (fetched < total)
  workflowImportInventoryController = null
  workflowImportKnowledgeSpaceIds.value = ids
  workflowImportOpen.value = true
}
function closeWorkflowImport() {
  workflowImportOpen.value = false
  workflowImportApplyError.value = null
}
function applyWorkflowImport(candidate: AgentWorkflowExportDocument, mapping?: ImportEndMapping[]) {
  workflowImportApplyError.value = null
  const result = store.replaceWorkflowFromImport(candidate, mapping)
  if (!result.ok) {
    workflowImportApplyError.value = result.error.code
    return
  }
  closeWorkflowImport()
  showWorkflowTransferToast('import-success')
}
function deleteContextToolStep() {
  const menu = canvasContextMenu.value
  if (menu?.type !== 'task-tool-step') return
  store.changeSystemTool(menu.context, menu.nodeId, { type: 'delete', stepId: menu.stepId })
  canvasContextMenu.value = null
}
const selectedEdge = computed<WorkflowEdge | null>(() => activeGraph.value?.edges.find((edge) => edge.id === session.value.selectedEdgeId) ?? null)

watch(identity, (next) => {
  branchDraftCache.clear(); updateBranchDraftDirty(); branchCreation.value = null
  if (next) void store.load(next.journeyId, next.agentId, repository)
  else store.dispose()
}, { immediate: true })
const unsavedChangesGuard = useUnsavedChangesGuard(hasUnappliedWork, async () => {
  if (dsl.dirty.value || branchDraftDirty.value) return false
  return store.save(repository)
})
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
  if (workflowExportToastTimer) globalThis.clearTimeout(workflowExportToastTimer)
  workflowImportInventoryController?.abort()
})
watch(() => session.value.focusMode, (enabled) => appShellPresentation?.setFocusMode(enabled), { immediate: true })
appShellPresentation?.setProductHeaderVisible(false)
onUnmounted(() => {
  appShellPresentation?.setFocusMode(false)
  appShellPresentation?.setProductHeaderVisible(true)
})

function keyboardDelete(event: globalThis.KeyboardEvent) {
  if (event.target instanceof globalThis.HTMLElement && event.target.closest('.branch-panel, .branch-confirmation')) return
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
  if (nodeType === 'branch' && branchCreation.value) return
  const graph = activeGraph.value
  if (!graph) return
  const createdNodeCount = Math.max(0, graph.nodes.length - 2)
  const fallback = { x: 190 + (createdNodeCount % 2) * 190, y: 260 + Math.floor(createdNodeCount / 2) * 130 }
  const placement = point ?? fallback
  if (nodeType === 'loop') {
    const candidate = createDefaultLoop(current.variables, cryptoWorkflowIdFactory)
    if (!candidate.ok) {
      draftError.value = draftErrorMessages[candidate.error.code]
      return
    }
    store.createWorkflowNode(candidate.value, placement)
    draftError.value = null
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
  if (node.type === 'branch') {
    branchCreation.value = { node, context: { ...session.value.context }, point: placement }
    branchError.value = null
    store.setResourceBrowserCollapsed(true)
    return
  }
  if (!activeLoop.value) { store.createWorkflowNode(node, placement); return }
  const result = store.createWorkflowLoopBodyNode(activeLoop.value.id, node as AddableLoopBodyNode, placement)
  if (!result?.ok) return
  store.selectNode(node.id)
  store.selectEdge(null)
  store.setResourceBrowserCollapsed(true)
  store.setPanel(null)
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
        store.setPanel(node ? { type: 'node-inspector', nodeId: intent.nodeId } : { type: session.value.resourceBrowser.category })
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

function handleCanvasIntent(context: WorkflowCanvasContext, intent: WorkflowCanvasIntent) {
  if (session.value.context.kind !== context.kind || (context.kind === 'loop-body' && session.value.context.kind === 'loop-body' && session.value.context.loopNodeId !== context.loopNodeId)) {
    store.switchCanvasContext(context)
  }
  handleIntent(intent)
}

function handleCanvasConnect(context: WorkflowCanvasContext, connection: Connection) {
  if (session.value.context.kind !== context.kind || (context.kind === 'loop-body' && session.value.context.kind === 'loop-body' && session.value.context.loopNodeId !== context.loopNodeId)) {
    store.switchCanvasContext(context)
  }
  handleConnect(connection)
}

function createNodeInContext(context: WorkflowCanvasContext, nodeType: WorkflowPaletteNodeType, point: { x: number; y: number }) {
  if (session.value.context.kind !== context.kind || (context.kind === 'loop-body' && session.value.context.kind === 'loop-body' && session.value.context.loopNodeId !== context.loopNodeId)) {
    store.switchCanvasContext(context)
  }
  createNode(nodeType, point)
}


function applyBranch(intent: BranchEditIntent) {
  branchError.value = null
  if (session.value.mode !== 'configure' || persistence.value.saveStatus === 'conflict') { branchError.value = 'Resolve the conflict or switch to Configure before applying.'; return }
  const creation = branchCreation.value
  if (creation) {
    if (intent.node.id !== creation.node.id) return
    store.switchCanvasContext(creation.context)
    const result = creation.context.kind === 'root'
      ? store.createWorkflowNode(intent.node, creation.point)
      : store.createWorkflowLoopBodyNode(creation.context.loopNodeId, intent.node, creation.point)
    if (!result?.ok) { branchError.value = 'Branch could not be created. Review the configuration.'; return }
    branchCreation.value = null
    store.selectNode(intent.node.id)
    store.setPanel({ type: 'node-inspector', nodeId: intent.node.id })
    return
  }
  if (!store.applyWorkflowBranchEdit(session.value.context, intent)) branchError.value = 'Branch could not be applied. It may have changed; reload its settings and try again.'
}
watch(() => session.value.selectedNodeId, () => { branchError.value = null })
watch(document, current => {
  if (!current) return
  const creation = branchCreation.value
  const creationLoopId = creation?.context.kind === 'loop-body' ? creation.context.loopNodeId : null
  if (creationLoopId && !current.workflow.nodes.some(n => n.type === 'loop' && n.id === creationLoopId)) branchCreation.value = null
  const ids = new Set(current.workflow.nodes.flatMap(n => n.type === 'loop' ? [n.id, ...n.config.body.graph.nodes.map(c => c.id)] : [n.id]))
  for (const id of branchDraftCache.keys()) if (!ids.has(id) && id !== branchCreation.value?.node.id) branchDraftCache.delete(id)
  updateBranchDraftDirty()
})

function closeInspector() {
  branchCreation.value = null
  branchError.value = null
  store.closeInspector()
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
function updateAgentActionKnowledgeSpaces(knowledgeSpaceId: KnowledgeSpaceReference, bind: boolean) {
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
  const loop = document.value?.workflow.nodes.find(n => n.type === 'loop' && n.config.body.graph.nodes.some(child => child.id === action.nodeId))
  const context: WorkflowCanvasContext = loop ? { kind: 'loop-body', loopNodeId: loop.id } : { kind: 'root' }
  switch (action.type) {
    case 'configure-system-tool':
      store.openSystemTool(context, action.nodeId, action.toolDefinitionId)
      return
    case 'bind-reusable-tool':
      store.bindWorkflowAgentActionReusableTool(context, action.nodeId, action.reusableToolId)
      return
    case 'unbind-reusable-tool':
      store.unbindWorkflowAgentActionReusableTool(context, action.nodeId, action.reusableToolId)
      return
    case 'append-task-tool-step':
      store.appendWorkflowTaskToolStep(context, action.nodeId, action.reusableToolId)
      return
    case 'bind-knowledge-space':
      store.bindWorkflowAgentActionKnowledgeSpace(context, action.nodeId, action.knowledgeSpaceId)
      return
    case 'unbind-knowledge-space':
      store.unbindWorkflowAgentActionKnowledgeSpace(context, action.nodeId, action.knowledgeSpaceId)
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
function updateLoop(details: Pick<LoopNode, 'name'> & Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>) {
  if (session.value.mode !== 'configure') return
  const loop = activeLoop.value ?? (selectedNode.value?.type === 'loop' ? selectedNode.value : null)
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
        <span class="workflow-focus-context">{{ document.agent.name }} · Canvas focus</span>
      </div>
      <WorkflowResourceNav :category="session.resourceBrowser.category" :panel-collapsed="session.resourceBrowser.collapsed" :focus-mode="session.focusMode" :compact="focusResourceNavCompact" @select="selectResourceCategory" @toggle-compact="focusResourceNavCompact = !focusResourceNavCompact" />
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
    <Transition name="save-toast">
      <div v-if="workflowTransferToast" class="workflow-save-toast" :class="{ 'is-success': workflowTransferToast.endsWith('success') }" :role="workflowTransferToast.endsWith('error') ? 'alert' : 'status'" :aria-live="workflowTransferToast.endsWith('error') ? 'assertive' : 'polite'">
        <span v-if="workflowTransferToast === 'export-success'"><strong>Workflow exported</strong><small>JSON backup downloaded.</small></span>
        <span v-else-if="workflowTransferToast === 'import-success'"><strong>Workflow imported</strong><small>The replacement is being saved.</small></span>
        <span v-else-if="workflowTransferToast === 'import-error'"><strong>Import unavailable</strong><small>Knowledge Space inventory could not be loaded.</small></span>
        <span v-else><strong>Export failed</strong><small>Your workflow was not changed.</small></span>
      </div>
    </Transition>
    <Transition name="workflow-toast">
      <p v-if="store.lastDomainError" class="workflow-interaction-toast" role="alert">Action rejected: {{ store.lastDomainError.code.replaceAll('_', ' ').toLowerCase() }}.</p>
      <p v-else-if="store.lastCanvasError" class="workflow-interaction-toast" role="alert">{{ canvasErrorMessage(store.lastCanvasError) }}</p>
    </Transition>
    <div class="workflow-editor-layout" :class="{ 'is-palette-collapsed': session.paletteCollapsed }">
      <WorkflowNodePalette :collapsed="session.paletteCollapsed" :disabled="session.mode !== 'configure'" :can-create-loop="session.context.kind === 'root' && document.variables.length > 0" :loop-disabled-reason="session.context.kind === 'loop-body' ? 'Nested Loops are not supported' : 'Create an Agent Variable first'" @collapse="store.setPaletteCollapsed" @create="createNode" @drop="dropPaletteNode" />
      <main class="workflow-canvas-panel">
        <div class="workflow-canvas-controls">
          <div class="mode-toggle"><button type="button" :class="{ 'is-active': session.mode === 'flow' }" @click="store.setMode('flow')">Flow</button><button type="button" :class="{ 'is-active': session.mode === 'configure' }" @click="store.setMode('configure')">Configure</button></div>
          <WorkflowToolsMenu @import="openWorkflowImport" @export="exportWorkflow" />
          <button type="button" class="focus-button" :aria-label="session.focusMode ? 'Exit focus mode' : 'Enter focus mode'" :title="session.focusMode ? 'Exit focus mode' : 'Enter focus mode'" @click="setFocusMode(!session.focusMode)"><img :src="enterFocusModeIcon" alt="" /></button>
        </div>
        <WorkflowExitNotice :status="exitStatus" :agent-id="document.agent.id" />
        <WorkflowCanvas v-if="document" key="workflow-root" ref="workflowCanvas" :routing-journey="routingJourney" canvas-id="workflow-root" :graph="document.workflow" :layout="document.layout" :mode="session.mode" :selected-node-id="session.selectedNodeId" :variables="document.variables" :system-tools="systemTools" :available-reusable-tool-ids="document.reusableTools.map((tool) => tool.id)" :reusable-tools="document.reusableTools" :knowledge-spaces="knowledgeSpaces" :active-resource-drag="activeResourceDrag" @edit-tool="editTool" @edit-reusable-tool="(nodeId, toolId) => store.editAgentReusableTool(session.context, nodeId, toolId)" @change-tool="changeTool" @reorder-tool="reorderTool" @tool-step-context-menu="(nodeId, stepId, point) => openTaskToolStepContextMenu(nodeId, stepId, session.context, point)" @intent="handleCanvasIntent" @connect="handleCanvasConnect" @create="createNodeInContext" @resize="store.resizeWorkflowNode" @loop-bounds="store.reconcileLoopBounds" @clear-error="store.clearWorkflowErrors" @reject="store.rejectCanvasInteraction" @resource-drop="handleResourceDrop" @update-agent-action="updateAgentActionDetails" @update-node-name="updateNodeName" @node-context-menu="(context, nodeId, point) => openNodeContextMenu(nodeId, context, point)" @edge-context-menu="(context, edgeId, point) => openEdgeContextMenu(edgeId, context, point)" />
      </main>
      <div v-if="rightPanelVisible" class="workflow-right-panel-host">
        <WorkflowSidePanelHost v-if="!systemToolDraft && (branchCreation || session.panel?.type === 'node-inspector' || session.panel?.type === 'loop-inspector')" :node="selectedNode" :branch-draft-cache="branchDraftCache" :branch-edges="activeGraph?.edges ?? []" :branch-target-names="branchTargetNames" :branch-error="branchError" :branch-blocked="persistence.saveStatus === 'conflict'" :branch-creating="Boolean(branchCreation)" :edge="selectedEdge" :tools="document.reusableTools" :variables="document.variables" :knowledge-spaces="knowledgeSpaces" :knowledge-status="knowledgeInventory.status" :loop-expanded="false" :read-only="session.mode === 'flow'" @branch-dirty-change="updateBranchDraftDirty" @apply-branch="applyBranch" @close="closeInspector" @update-loop="updateLoop" @bind-tool="updateAgentActionTools($event, true)" @unbind-tool="updateAgentActionTools($event, false)" @bind-knowledge-space="updateAgentActionKnowledgeSpaces($event, true)" @unbind-knowledge-space="updateAgentActionKnowledgeSpaces($event, false)" @reject-resource="store.rejectCanvasInteraction" />
        <SystemToolPanel v-else-if="taskToolDraft && toolTask" :key="`${taskToolDraft.nodeId}-${taskToolDraft.step?.id ?? taskToolDraft.kind}`" :draft="taskToolDraft" :task="toolTask" :variables="document.variables" :knowledge-spaces="toolKnowledgeSpaces" :knowledge-status="toolKnowledgeStatus" :error="toolError" @save="store.saveSystemTool" @cancel="store.cancelSystemTool" />
        <AgentReusableToolPanel v-else-if="reusableToolDraft" :key="`${reusableToolDraft.host}-${reusableToolDraft.tool?.id ?? reusableToolDraft.kind}`" :draft="reusableToolDraft" :variables="document.variables" :knowledge-spaces="toolKnowledgeSpaces" :knowledge-status="toolKnowledgeStatus" @save="store.saveAgentReusableTool" @cancel="store.cancelSystemTool" />
        <AgentVariablesPanel v-else-if="session.resourceBrowser.category === 'agent-variables' && !session.resourceBrowser.collapsed" :variables="document.variables" :read-only="session.mode === 'flow'" :error="variableError" :reference-count="store.variableReferenceCount" @save="store.saveAgentVariable" @delete="store.deleteAgentVariable" @collapse="store.setResourceBrowserCollapsed(true)" />
        <ReusableToolsPanel v-else-if="session.resourceBrowser.category === 'reusable-tools' && !session.resourceBrowser.collapsed" :agent-name="document.agent.name" :tools="document.reusableTools" :read-only="session.mode === 'flow'" :reference-count="store.reusableToolReferenceCount" @collapse="store.setResourceBrowserCollapsed(true)" @edit="store.editLibraryReusableTool" @delete="store.deleteLibraryReusableTool" @browse-system-tools="selectResourceCategory('tools')" @resource-drag-start="activeResourceDrag = $event" @resource-drag-end="activeResourceDrag = null" />
        <WorkflowDslEditor v-else-if="session.resourceBrowser.category === 'dsl-edit' && !session.resourceBrowser.collapsed" :source="dsl.source.value" :phase="dsl.state.value.type" :diagnostics="dsl.diagnostics.value" :dirty="dsl.dirty.value" :read-only="session.mode === 'flow'" :blocked="persistence.saveStatus === 'saving' || persistence.saveStatus === 'conflict'" :apply-error="dsl.applyError.value" @edit="dsl.edit" @review-replacement="dsl.reviewReplacement" @apply="dsl.apply" @format="dsl.format" @upgrade="dsl.upgrade" @revert="dsl.revert" @close="store.setResourceBrowserCollapsed(true)" />
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
    <WorkflowImportDialog v-if="workflowImportOpen" :target-ends="importTargetEnds" :available-knowledge-space-ids="workflowImportKnowledgeSpaceIds" :save-status="persistence.saveStatus" :apply-error="workflowImportApplyError" @close="closeWorkflowImport" @apply="applyWorkflowImport" />
  </section>
</template>
