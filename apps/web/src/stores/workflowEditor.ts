import { applyBranchEdit } from '@/domain/workflow/branchCommands'
import type { BranchEditIntent } from '@/domain/workflow/branchDrafts'
import { computed, reactive, shallowRef, toRaw } from 'vue'
import { defineStore } from 'pinia'
import {
  agentWorkflowEditorDocumentSchema,
  agentWorkflowExportDocumentSchema,
  uuidSchema,
  type JourneyEditorDocument,
  type AgentWorkflowExportDocument,
  type SystemToolDefinition,
  type AgentVariable,
  type AgentReusableTool,
  type ToolKind,
  type ToolStep,
  type AgentWorkflowEditorDocument,
  type LoopNode,
  type KnowledgeSpaceSummary,
  type RepositoryError,
  type SaveAgentWorkflowInput,
  type UUID,
} from '@odyssey/schemas'

import { bindImportedEnds, type ImportEndMapping } from '@/domain/workflow-import/importEndBindings'
import { changeTaskTool, type TaskToolSaveDraft, type ToolEditIntent } from '@/domain/workflow/systemToolCommands'
import { agentVariableReferenceCount, changeAgentVariable as changeAgentVariableCommand } from '@/domain/workflow/agentVariableCommands'
import type { WorkflowEditorRepository } from '@/repositories'
import {
  connectLoopBodyDocumentNodes,
  createWorkflowNodeAt,
  createLoopBodyNodeAt,
  moveLoopBodyNode,
  moveNodePlacement,
  resizeNodePlacement,
  removeLoopBodyDocumentEdge,
  removeLoopBodyNodeAndPlacement,
  removeWorkflowNodeAndPlacement,
  updateLoopBodyViewport,
  updateCanvasViewport,
  type LoopBodyApplicationResult,
  type WorkflowApplicationResult,
  type WorkflowPoint,
  type WorkflowCanvasUiErrorCode,
} from '@/canvas/workflow'
import {
  bindAgentActionReusableTool as bindAgentActionReusableToolCommand,
  bindAgentActionKnowledgeSpace as bindAgentActionKnowledgeSpaceCommand,
  appendReusableToolToTask as appendReusableToolToTaskCommand,
  addNode as addWorkflowNodeCommand,
  connectNodes as connectWorkflowNodesCommand,
  removeEdge as removeWorkflowEdgeCommand,
  removeNode as removeWorkflowNodeCommand,
  renameNode as renameWorkflowNodeCommand,
  updateLoopBodyDocument as updateWorkflowLoopBodyDocumentCommand,
  updateLoopSettings as updateWorkflowLoopSettingsCommand,
  updateLoopDetails as updateWorkflowLoopDetailsCommand,
  updateNodeConfig as updateWorkflowNodeConfigCommand,
  unbindAgentActionReusableTool as unbindAgentActionReusableToolCommand,
  unbindAgentActionKnowledgeSpace as unbindAgentActionKnowledgeSpaceCommand,
  updateLoopBodyNodeConfig,
  updateLoopBodyAgentActionDetails,
  renameLoopBodyNode,
  updateAgentActionDetails as updateAgentActionDetailsCommand,
  type AddableLoopBodyNode,
  type AddableWorkflowNode,
  type ConnectNodesIntent,
  type UpdateNodeConfigIntent,
  type WorkflowCommandResult,
  type WorkflowDomainError,
  createAgentActionFromDraft,
  createLoopFromDraft,
  instantiateAndBindAgentReusableTool,
  agentReusableToolReferenceCount,
  deleteAgentReusableTool,
  createAgentReusableToolFromTaskStep,
  updateAgentReusableTool,
  type AgentActionDraftValues,
  type LoopDraftValues,
  type WorkflowDraftResult,
  type WorkflowIdFactory,
  validateWorkflowGraph,
} from '@/domain/workflow'
import {
  applyPersistenceFailure,
  applyPersistenceSuccess,
  beginPersistenceSave,
  createCleanPersistenceState,
  hasUnsavedPersistenceChanges,
  markPersistenceDirty,
  preparePersistenceConflictOverwrite,
  type EditorPersistenceState,
} from '@/domain/persistence/editorPersistenceState'
import type { LoadStatus, SaveStatus } from './editorStatus'
import { AutosaveCoordinator } from './persistence/autosaveCoordinator'

export const WORKFLOW_AUTOSAVE_DELAY_MS = 800

export type SystemToolDraft =
  | { host: 'task'; context: WorkflowCanvasContext; nodeId: UUID; kind: ToolKind; step: ToolStep | null }
  | { host: 'agent-action'; context: WorkflowCanvasContext; nodeId: UUID; definitionId: UUID | null; kind: ToolKind; tool: AgentReusableTool | null }
  | { host: 'reusable-tool-library'; kind: ToolKind; tool: AgentReusableTool }
  | null
export type WorkflowMode = 'flow' | 'configure'
export type KnowledgeInventoryStatus = 'idle' | 'loading' | 'ready' | 'error'
export type WorkflowResourceCategory = 'tools' | 'knowledge-spaces' | 'agent-variables' | 'dsl-edit' | 'reusable-tools'
export type WorkflowCanvasContext = { kind: 'root' } | { kind: 'loop-body'; loopNodeId: UUID }
export type LoopPresentationState = { type: 'collapsed' } | { type: 'expanded-inline'; loopNodeId: UUID }
export type WorkflowCreationDraft =
  | { type: 'closed' }
  | { type: 'agent-action'; context: WorkflowCanvasContext; point: WorkflowPoint }
  | { type: 'loop'; context: { kind: 'root' }; point: WorkflowPoint }
export type WorkflowPanel =
  | { type: 'tools' }
  | { type: 'knowledge-spaces' }
  | { type: 'agent-variables' }
  | { type: 'dsl-edit' }
  | { type: 'reusable-tools' }
  | { type: 'node-inspector'; nodeId: UUID }
  | { type: 'edge-inspector'; edgeId: UUID }
  | { type: 'loop-inspector'; loopNodeId: UUID }
  | null

export type WorkflowInteractionState =
  | { type: 'idle' }
  | { type: 'dragging-node'; nodeId: UUID }
  | { type: 'connecting'; sourceNodeId: UUID; sourceHandleId?: UUID }
  | { type: 'creating-node'; nodeType: 'branch' | 'loop' | 'agent_action' | 'task' }

export type WorkflowImportApplyResult =
  | { readonly ok: true; readonly value: null }
  | {
      readonly ok: false
      readonly error: {
        readonly code: 'IMPORT_NOT_READY' | 'IMPORT_BLOCKED_BY_SAVE' | 'IMPORT_BLOCKED_BY_CONFLICT' | 'IMPORT_DOCUMENT_INVALID' | 'IMPORT_END_MAPPING_REQUIRED'
      }
    }

function createSaveInput(document: AgentWorkflowEditorDocument): SaveAgentWorkflowInput {
  return {
    journeyId: document.agent.journeyId,
    agentId: document.agent.id,
    expectedRevision: document.agent.revision,
    workflow: structuredClone(document.workflow),
    layout: structuredClone(document.layout),
    variables: structuredClone(document.variables),
    reusableTools: structuredClone(document.reusableTools),
  }
}

export const useWorkflowEditorStore = defineStore('workflowEditor', () => {
  // The repository returns a validated aggregate snapshot. Store actions
  // replace it as a unit, so deep proxy unwrapping adds no useful behavior and
  // makes the recursive Workflow JSON types exceed TypeScript's depth limit.
  const routingJourney = shallowRef<JourneyEditorDocument | null>(null)
  const document = shallowRef<AgentWorkflowEditorDocument | null>(null)
  const session = reactive({
    selectedNodeId: null as UUID | null,
    selectedEdgeId: null as UUID | null,
    panel: { type: 'tools' } as WorkflowPanel,
    mode: 'configure' as WorkflowMode,
    focusMode: false,
    paletteCollapsed: false,
    interaction: { type: 'idle' } as WorkflowInteractionState,
    context: { kind: 'root' } as WorkflowCanvasContext,
    loopPresentation: { type: 'collapsed' } as LoopPresentationState,
    creationDraft: { type: 'closed' } as WorkflowCreationDraft,
    resourceBrowser: { collapsed: false, category: 'tools' as WorkflowResourceCategory, query: '', page: 1, pageSize: 6 },
  })
  const contextSessions = new Map<string, { selectedNodeId: UUID | null; selectedEdgeId: UUID | null; panel: WorkflowPanel }>()
  const loadState = reactive({ status: 'idle' as LoadStatus, error: null as RepositoryError | null })
  const persistenceState = shallowRef<EditorPersistenceState | null>(null)
  const persistence = reactive({
    get loadStatus(): LoadStatus { return loadState.status },
    get saveStatus(): SaveStatus {
      const state = persistenceState.value
      if (!state || state.type === 'dirty') return 'idle'
      if (state.type === 'saving') return 'saving'
      if (state.type === 'failed') return 'error'
      if (state.type === 'conflict') return 'conflict'
      return 'saved'
    },
    get error(): RepositoryError | null {
      const state = persistenceState.value
      return state?.type === 'failed' || state?.type === 'conflict' ? state.error : loadState.error
    },
    get mutationSeq(): number { return persistenceState.value?.mutationSeq ?? 0 },
    get savedMutationSeq(): number { return persistenceState.value?.savedMutationSeq ?? 0 },
  })
  const lastDomainError = shallowRef<WorkflowDomainError | null>(null)
  const lastCanvasError = shallowRef<WorkflowCanvasUiErrorCode | null>(null)
  const toolKnowledgeSpaces = shallowRef<KnowledgeSpaceSummary[]>([])
  const toolKnowledgeStatus = shallowRef<'loading' | 'ready' | 'error'>('loading')
  const systemTools = shallowRef<SystemToolDefinition[]>([])
  const systemToolStatus = shallowRef<'loading' | 'empty' | 'error' | 'loaded'>('loading')
  const systemToolDraft = shallowRef<SystemToolDraft>(null)
  const variableError = shallowRef<string | null>(null)
  const toolError = shallowRef<string | null>(null)
  const knowledgeSpaces = shallowRef<KnowledgeSpaceSummary[]>([])
  const knowledgeInventory = reactive({ status: 'idle' as KnowledgeInventoryStatus, error: null as RepositoryError | null, page: 1, pageSize: 6, total: 0 })
  let activeRequest = 0
  let loadController: AbortController | null = null
  let saveController: AbortController | null = null
  let activeRepository: WorkflowEditorRepository | null = null
  let saveRequestSeq = 0
  const autosaveCoordinator = new AutosaveCoordinator()
  let knowledgeController: AbortController | null = null
  let knowledgeRequest = 0

  const isReady = computed(() => loadState.status === 'ready' && document.value !== null)
  const hasUnsavedChanges = computed(() => hasUnsavedPersistenceChanges(persistenceState.value))

  function clearAutosaveTimer() {
    autosaveCoordinator.cancelScheduled()
  }

  function scheduleAutosave(delay = WORKFLOW_AUTOSAVE_DELAY_MS) {
    clearAutosaveTimer()
    const state = persistenceState.value
    if (!activeRepository || !state || state.type !== 'dirty') return
    autosaveCoordinator.schedule(() => save(), delay)
  }

  function resetSession() {
    systemToolDraft.value = null
    toolError.value = null
    variableError.value = null
    session.selectedNodeId = null
    session.selectedEdgeId = null
    session.panel = { type: 'tools' }
    session.mode = 'configure'
    session.focusMode = false
    session.paletteCollapsed = false
    session.interaction = { type: 'idle' }
    session.context = { kind: 'root' }
    session.loopPresentation = { type: 'collapsed' }
    session.creationDraft = { type: 'closed' }
    session.resourceBrowser = { collapsed: false, category: 'tools', query: '', page: 1, pageSize: 6 }
    contextSessions.clear()
  }

  function contextKey(context: WorkflowCanvasContext) {
    return context.kind === 'root' ? 'root' : `loop:${context.loopNodeId}`
  }

  function switchCanvasContext(context: WorkflowCanvasContext) {
    systemToolDraft.value = null
    session.creationDraft = { type: 'closed' }
    contextSessions.set(contextKey(session.context), {
      selectedNodeId: session.selectedNodeId,
      selectedEdgeId: session.selectedEdgeId,
      panel: session.panel,
    })
    const restored = contextSessions.get(contextKey(context))
    session.context = context
    session.selectedNodeId = restored?.selectedNodeId ?? null
    session.selectedEdgeId = restored?.selectedEdgeId ?? null
    session.panel = restored?.panel ?? (context.kind === 'root' ? { type: 'tools' } : null)
    session.interaction = { type: 'idle' }
  }

  function expandLoopInline(loopNodeId: UUID) {
    if (!findLoop(loopNodeId)) return false
    session.loopPresentation = { type: 'expanded-inline', loopNodeId }
    switchCanvasContext({ kind: 'loop-body', loopNodeId })
    return true
  }

  function collapseInlineLoop() {
    if (session.loopPresentation.type === 'collapsed') return
    switchCanvasContext({ kind: 'root' })
    session.loopPresentation = { type: 'collapsed' }
  }

  async function load(journeyId: UUID, agentId: UUID, repository: WorkflowEditorRepository) {
    clearAutosaveTimer()
    saveRequestSeq += 1
    saveController?.abort()
    autosaveCoordinator.dispose()
    activeRepository = repository
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    const request = ++activeRequest
    document.value = null
    lastDomainError.value = null
    lastCanvasError.value = null
    resetSession()
    loadState.status = 'loading'
    loadState.error = null
    persistenceState.value = null
    knowledgeSpaces.value = []
    knowledgeInventory.status = 'loading'
    knowledgeInventory.error = null

    toolKnowledgeSpaces.value = []
    toolKnowledgeStatus.value = 'loading'
    void (async () => {
      const spaces: KnowledgeSpaceSummary[] = []
      let page = 1
      while (!controller.signal.aborted && request === activeRequest) {
        const result = await repository.listKnowledgeSpaces({ page, pageSize: 100 }, { signal: controller.signal })
        if (request !== activeRequest || controller.signal.aborted) return
        if (!result.ok) { toolKnowledgeStatus.value = 'error'; return }
        spaces.push(...result.value.items)
        if (page * result.value.pageSize >= result.value.total) {
          toolKnowledgeSpaces.value = spaces
          toolKnowledgeStatus.value = 'ready'
          return
        }
        page += 1
      }
    })()
    systemTools.value = []
    systemToolStatus.value = 'loading'
    void repository.listSystemToolDefinitions({ signal: controller.signal }).then((result) => {
      if (request !== activeRequest || controller.signal.aborted) return
      systemTools.value = result.ok ? result.value : []
      systemToolStatus.value = result.ok ? (result.value.length ? 'loaded' : 'empty') : 'error'
    })
    const knowledgeResultPromise = repository.listKnowledgeSpaces({ page: 1, pageSize: session.resourceBrowser.pageSize }, { signal: controller.signal })

    routingJourney.value = null
    const journeyResult = await repository.loadJourney(journeyId, { signal: controller.signal })
    if (request !== activeRequest || controller.signal.aborted) return
    if (!journeyResult.ok) {
      loadState.error = journeyResult.error
      loadState.status = journeyResult.error.code === 'NOT_FOUND' ? 'not-found' : 'error'
      return
    }
    if (!journeyResult.value.agents.some((agent) => agent.id === agentId)) {
      loadState.error = { code: 'NOT_FOUND' }
      loadState.status = 'not-found'
      return
    }

    const agentResult = await repository.loadAgentWorkflow(journeyId, agentId, { signal: controller.signal })
    if (request !== activeRequest || controller.signal.aborted) return
    if (
      agentResult.ok
      && agentResult.value.agent.journeyId === journeyId
      && agentResult.value.agent.id === agentId
    ) {
      routingJourney.value = journeyResult.value
      document.value = agentResult.value
      if (agentResult.value.workflow.nodes.every((node) => node.type === 'start' || node.type === 'end')
          && agentResult.value.workflow.nodes.filter((node) => node.type === 'end').length > 1) {
        session.resourceBrowser.collapsed = true
      }
      persistenceState.value = createCleanPersistenceState(agentResult.value.agent.revision)
      loadState.status = 'ready'
      const knowledgeResult = await knowledgeResultPromise
      if (request !== activeRequest || controller.signal.aborted) return
      if (knowledgeResult.ok) {
        knowledgeSpaces.value = knowledgeResult.value.items
        knowledgeInventory.page = knowledgeResult.value.page
        knowledgeInventory.pageSize = knowledgeResult.value.pageSize
        knowledgeInventory.total = knowledgeResult.value.total
        knowledgeInventory.status = 'ready'
      } else {
        knowledgeInventory.error = knowledgeResult.error
        knowledgeInventory.status = 'error'
      }
      return
    }
    loadState.error = agentResult.ok ? { code: 'RESPONSE_INVALID' } : agentResult.error
    loadState.status = loadState.error.code === 'NOT_FOUND' ? 'not-found' : 'error'
  }

  function setMode(mode: WorkflowMode) { session.mode = mode; if (mode === 'flow') systemToolDraft.value = null }
  function setPanel(panel: WorkflowPanel) {
    if (panel?.type === 'node-inspector') {
      const context = session.context
      const graph = context.kind === 'root' ? document.value?.workflow : findLoop(context.loopNodeId)?.config.body.graph
      const node = graph?.nodes.find((candidate) => candidate.id === panel.nodeId)
      if (node && (node.type === 'start' || node.type === 'end' || node.type === 'loop_start' || node.type === 'loop_end')) {
        if (session.panel?.type === 'node-inspector' || session.panel?.type === 'loop-inspector') {
          session.panel = null
          session.resourceBrowser.collapsed = true
        }
        return
      }
    }
    session.panel = panel
    if (panel?.type === 'node-inspector' || panel?.type === 'edge-inspector' || panel?.type === 'loop-inspector') {
      session.resourceBrowser.collapsed = false
    }
  }
  function setFocusMode(enabled: boolean) { session.focusMode = enabled }
  function setPaletteCollapsed(collapsed: boolean) { session.paletteCollapsed = collapsed }
  function selectNode(nodeId: UUID | null) { session.selectedNodeId = nodeId }
  function selectEdge(edgeId: UUID | null) { session.selectedEdgeId = edgeId }
  function closeInspector() {
    session.selectedNodeId = null
    session.selectedEdgeId = null
    session.panel = null
    session.resourceBrowser.collapsed = true
  }
  function setInteraction(interaction: WorkflowInteractionState) { session.interaction = interaction }
  function stageCreationDraft(nodeType: 'agent_action' | 'loop', point: WorkflowPoint) {
    if (session.mode !== 'configure') return false
    if (nodeType === 'loop') {
      if (session.context.kind !== 'root' || !document.value?.variables.length) return false
      session.creationDraft = { type: 'loop', context: { kind: 'root' }, point }
      return true
    }
    const context: WorkflowCanvasContext = session.context.kind === 'root'
      ? { kind: 'root' }
      : { kind: 'loop-body', loopNodeId: session.context.loopNodeId }
    session.creationDraft = { type: 'agent-action', context, point: { x: point.x, y: point.y } }
    return true
  }
  function closeCreationDraft() { session.creationDraft = { type: 'closed' } }
  function setResourceBrowserCollapsed(collapsed: boolean) { session.resourceBrowser.collapsed = collapsed }
  function setResourceBrowserCategory(category: WorkflowResourceCategory) {
    systemToolDraft.value = null
    toolError.value = null
    session.resourceBrowser.category = category
    session.resourceBrowser.page = 1
    session.resourceBrowser.collapsed = false
    variableError.value = null
    session.panel = { type: category }
  }
  function variableReferenceCount(variableId: UUID) {
    return document.value ? agentVariableReferenceCount(document.value, variableId) : 0
  }
  function saveAgentVariable(variable: AgentVariable) {
    const current = document.value
    if (!current) return false
    const intent = current.variables.some((candidate) => candidate.id === variable.id)
      ? { type: 'update' as const, variable }
      : { type: 'create' as const, variable }
    const result = changeAgentVariableCommand(current, intent, session.mode)
    if (!result.ok) { variableError.value = result.error; return false }
    document.value = { ...current, variables: result.value }
    variableError.value = null
    markDirty()
    return true
  }
  function deleteAgentVariable(variableId: UUID) {
    const current = document.value
    if (!current) return false
    const result = changeAgentVariableCommand(current, { type: 'delete', variableId }, session.mode)
    if (!result.ok) { variableError.value = result.error; return false }
    document.value = { ...current, variables: result.value }
    variableError.value = null
    markDirty()
    return true
  }
  function setResourceBrowserQuery(query: string) { session.resourceBrowser.query = query; session.resourceBrowser.page = 1 }
  function setResourceBrowserPage(page: number) { session.resourceBrowser.page = Math.max(1, page) }
  async function loadKnowledgeSpaces(repository: WorkflowEditorRepository) {
    knowledgeController?.abort()
    const controller = new AbortController()
    knowledgeController = controller
    const request = ++knowledgeRequest
    knowledgeInventory.status = 'loading'
    knowledgeInventory.error = null
    const result = await repository.listKnowledgeSpaces({
      query: session.resourceBrowser.query || undefined,
      page: session.resourceBrowser.page,
      pageSize: session.resourceBrowser.pageSize,
    }, { signal: controller.signal })
    if (request !== knowledgeRequest || controller.signal.aborted) return
    if (!result.ok) {
      knowledgeInventory.status = 'error'
      knowledgeInventory.error = result.error
      return
    }
    knowledgeSpaces.value = result.value.items
    knowledgeInventory.page = result.value.page
    knowledgeInventory.pageSize = result.value.pageSize
    knowledgeInventory.total = result.value.total
    knowledgeInventory.status = 'ready'
  }
  function clearWorkflowErrors() {
    lastDomainError.value = null
    lastCanvasError.value = null
  }
  function rejectCanvasInteraction(error: WorkflowCanvasUiErrorCode) {
    lastDomainError.value = null
    lastCanvasError.value = error
  }

  function markDirty() {
    const state = persistenceState.value
    if (!state) return
    persistenceState.value = markPersistenceDirty(state, Date.now() + WORKFLOW_AUTOSAVE_DELAY_MS)
    if (persistenceState.value.type === 'dirty') scheduleAutosave()
  }

  function resetSessionAfterWorkflowImport() {
    systemToolDraft.value = null
    toolError.value = null
    variableError.value = null
    lastDomainError.value = null
    lastCanvasError.value = null
    session.selectedNodeId = null
    session.selectedEdgeId = null
    session.panel = { type: 'tools' }
    session.interaction = { type: 'idle' }
    session.context = { kind: 'root' }
    session.loopPresentation = { type: 'collapsed' }
    session.creationDraft = { type: 'closed' }
    contextSessions.clear()
  }

  function replaceWorkflowFromImport(candidate: AgentWorkflowExportDocument, mapping?: readonly ImportEndMapping[]): WorkflowImportApplyResult {
    const current = document.value
    const state = persistenceState.value
    if (!current || !state || loadState.status !== 'ready') return { ok: false, error: { code: 'IMPORT_NOT_READY' } }
    if (state.type === 'saving') return { ok: false, error: { code: 'IMPORT_BLOCKED_BY_SAVE' } }
    if (state.type === 'conflict') return { ok: false, error: { code: 'IMPORT_BLOCKED_BY_CONFLICT' } }

    const parsed = agentWorkflowExportDocumentSchema.safeParse(candidate)
    if (!parsed.success) return { ok: false, error: { code: 'IMPORT_DOCUMENT_INVALID' } }
    const adapted = bindImportedEnds(parsed.data, toRaw(current), mapping)
    if (!adapted) return { ok: false, error: { code: 'IMPORT_END_MAPPING_REQUIRED' } }
    const aggregate = agentWorkflowEditorDocumentSchema.safeParse({ agent: current.agent, ...adapted })
    if (!aggregate.success) return { ok: false, error: { code: 'IMPORT_DOCUMENT_INVALID' } }
    const validation = validateWorkflowGraph(parsed.data.workflow)
    if (!validation.isStructurallyValid) return { ok: false, error: { code: 'IMPORT_DOCUMENT_INVALID' } }

    clearAutosaveTimer()
    document.value = {
      ...current,
      workflow: structuredClone(aggregate.data.workflow),
      layout: structuredClone(aggregate.data.layout),
      variables: structuredClone(aggregate.data.variables),
      reusableTools: structuredClone(aggregate.data.reusableTools),
    }
    resetSessionAfterWorkflowImport()
    markDirty()
    scheduleAutosave(0)
    return { ok: true, value: null }
  }

  /** Same-document DSL transaction: retain identity and editor UI, never use import remapping. */
  function applyCompiledWorkflow(candidate: AgentWorkflowExportDocument, expectedMutationSeq: number): { ok: true } | { ok: false; error: { code: string } } {
    const current = document.value
    if (!current || !isReady.value) return { ok: false, error: { code: 'DSL_NOT_READY' } }
    if (session.mode !== 'configure') return { ok: false, error: { code: 'DSL_READ_ONLY' } }
    if (persistence.mutationSeq !== expectedMutationSeq) return { ok: false, error: { code: 'DSL_STALE' } }
    if (persistenceState.value?.type === 'saving' || persistenceState.value?.type === 'conflict') return { ok: false, error: { code: 'DSL_SAVE_BLOCKED' } }
    const parsed = agentWorkflowEditorDocumentSchema.safeParse({ agent: current.agent, ...candidate })
    if (!parsed.success || !validateWorkflowGraph(candidate.workflow).isStructurallyValid) return { ok: false, error: { code: 'DSL_INVALID' } }
    const ends = current.workflow.nodes.filter((node) => node.type === 'end')
    const nextEnds = parsed.data.workflow.nodes.filter((node) => node.type === 'end')
    if (ends.length !== nextEnds.length || ends.some((end) => !nextEnds.some((next) => next.id === end.id && JSON.stringify(next.config) === JSON.stringify(end.config)))) return { ok: false, error: { code: 'DSL_ENDS_IMMUTABLE' } }
    clearAutosaveTimer()
    document.value = parsed.data
    if (session.context.kind === 'loop-body') {
      const loopId = session.context.loopNodeId
      if (!parsed.data.workflow.nodes.some((node) => node.id === loopId && node.type === 'loop')) { session.context = { kind: 'root' }; session.loopPresentation = { type: 'collapsed' } }
    }
    if (session.loopPresentation.type === 'expanded-inline') {
      const loopId = session.loopPresentation.loopNodeId
      if (!parsed.data.workflow.nodes.some((node) => node.id === loopId && node.type === 'loop')) session.loopPresentation = { type: 'collapsed' }
    }
    const contextLoopId = session.context.kind === 'loop-body' ? session.context.loopNodeId : null
    const contextLoop = parsed.data.workflow.nodes.find((node) => node.type === 'loop' && node.id === contextLoopId)
    const selectionGraph = contextLoop?.type === 'loop' ? contextLoop.config.body.graph : parsed.data.workflow
    if (session.selectedNodeId && !selectionGraph.nodes.some((node) => node.id === session.selectedNodeId)) session.selectedNodeId = null
    if (session.selectedEdgeId && !selectionGraph.edges.some((edge) => edge.id === session.selectedEdgeId)) session.selectedEdgeId = null
    session.panel = { type: 'dsl-edit' }
    session.resourceBrowser.category = 'dsl-edit'
    session.resourceBrowser.collapsed = false
    session.interaction = { type: 'idle' }
    markDirty()
    scheduleAutosave()
    return { ok: true }
  }

  function applyGraphResult(result: WorkflowCommandResult<AgentWorkflowEditorDocument['workflow']>) {
    if (!result.ok) {
      lastDomainError.value = result.error
      lastCanvasError.value = null
      return result
    }
    const current = document.value
    if (!current) return result
    document.value = { ...current, workflow: result.value }
    markDirty()
    lastDomainError.value = null
    lastCanvasError.value = null
    if (session.selectedNodeId && !result.value.nodes.some((node) => node.id === session.selectedNodeId)) {
      session.selectedNodeId = null
      session.panel = null
    }
    return result
  }

  function addWorkflowNode(node: AddableWorkflowNode) {
    const current = document.value
    if (!current) return null
    return applyGraphResult(addWorkflowNodeCommand(current.workflow, node))
  }

  function removeWorkflowNode(nodeId: UUID) {
    const current = document.value
    if (!current) return null
    return applyGraphResult(removeWorkflowNodeCommand(current.workflow, nodeId))
  }

  function connectWorkflowNodes(intent: ConnectNodesIntent) {
    const current = document.value
    if (!current) return null
    return applyGraphResult(connectWorkflowNodesCommand(current.workflow, intent))
  }

  function removeWorkflowEdge(edgeId: UUID) {
    const current = document.value
    if (!current) return null
    const result = applyGraphResult(removeWorkflowEdgeCommand(current.workflow, edgeId))
    if (result?.ok && session.selectedEdgeId === edgeId) {
      session.selectedEdgeId = null
      session.panel = null
    }
    return result
  }

  function updateWorkflowNodeConfig(intent: UpdateNodeConfigIntent) {
    const current = document.value
    if (!current) return null
    return applyGraphResult(updateWorkflowNodeConfigCommand(current.workflow, intent))
  }

  function applyWorkflowBranchEdit(context: WorkflowCanvasContext, intent: BranchEditIntent) {
    const current = document.value
    if (!current || session.mode !== 'configure' || persistenceState.value?.type === 'conflict') return false
    const loop = context.kind === 'loop-body' ? findLoop(context.loopNodeId) : null
    if (context.kind === 'loop-body' && !loop) return false
    if (!loop) return applyGraphResult(applyBranchEdit(current.workflow, { kind: 'agent-workflow' }, intent, current.variables)).ok
    const result = applyBranchEdit(loop.config.body.graph, { kind: 'loop-body', loopNodeId: loop.id }, intent, current.variables)
    if (!result.ok) { lastDomainError.value = result.error; return false }
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: result.value, layout: structuredClone(loop.config.body.layout) } }).ok
  }

  function updateWorkflowAgentActionDetails(
    context: WorkflowCanvasContext,
    nodeId: UUID,
    details: { readonly name: string; readonly model: string; readonly goal: string },
  ) {
    const current = document.value
    if (!current) return null
    const loop = context.kind === 'loop-body' ? findLoop(context.loopNodeId) : null
    if (context.kind === 'loop-body' && !loop) return null
    if (!loop) return applyGraphResult(updateAgentActionDetailsCommand(current.workflow, { nodeId, ...details }))
    const graphResult = updateLoopBodyAgentActionDetails(loop.config.body.graph, loop.id, { nodeId, ...details })
    if (!graphResult.ok) return graphResult
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: graphResult.value, layout: structuredClone(loop.config.body.layout) } })
  }

  function renameWorkflowNode(context: WorkflowCanvasContext, nodeId: UUID, name: string) {
    const current = document.value
    if (!current) return null
    const loop = context.kind === 'loop-body' ? findLoop(context.loopNodeId) : null
    if (context.kind === 'loop-body' && !loop) return null
    if (!loop) return applyGraphResult(renameWorkflowNodeCommand(current.workflow, nodeId, name))
    const graphResult = renameLoopBodyNode(loop.config.body.graph, loop.id, nodeId, name)
    if (!graphResult.ok) return graphResult
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: graphResult.value, layout: structuredClone(loop.config.body.layout) } })
  }

  function updateWorkflowLoopSettings(
    loopNodeId: UUID,
    settings: Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>,
  ) {
    const current = document.value
    if (!current) return null
    return applyGraphResult(updateWorkflowLoopSettingsCommand(current.workflow, loopNodeId, settings))
  }

  function updateWorkflowLoopDetails(
    loopNodeId: UUID,
    details: Pick<LoopNode, 'name'> & Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>,
  ) {
    const current = document.value
    if (!current) return null
    return applyGraphResult(updateWorkflowLoopDetailsCommand(current.workflow, loopNodeId, details))
  }

  function toSaveInput(): SaveAgentWorkflowInput | null {
    const current = document.value
    if (!current) return null
    return createSaveInput(toRaw<AgentWorkflowEditorDocument>(current))
  }

  function applyApplicationResult(result: WorkflowApplicationResult) {
    if (!result.ok) {
      if (result.error.kind === 'graph') lastDomainError.value = result.error.error
      lastCanvasError.value = null
      return result
    }
    const current = document.value
    if (!current) return result
    document.value = { ...current, workflow: result.value.graph, layout: result.value.layout }
    lastDomainError.value = null
    lastCanvasError.value = null
    markDirty()
    return result
  }

  function applyLoopApplicationResult(loopNodeId: UUID, result: LoopBodyApplicationResult) {
    if (!result.ok) {
      if (result.error.kind === 'graph') lastDomainError.value = result.error.error
      lastCanvasError.value = null
      return result
    }
    const current = document.value
    if (!current) return result
    const graphResult = updateWorkflowLoopBodyDocumentCommand(current.workflow, loopNodeId, result.value)
    return applyGraphResult(graphResult)
  }

  function findLoop(loopNodeId: UUID) {
    const node = document.value?.workflow.nodes.find((candidate) => candidate.id === loopNodeId)
    return node?.type === 'loop' ? node : null
  }

  function createWorkflowLoopBodyNode(loopNodeId: UUID, node: AddableLoopBodyNode, point: WorkflowPoint) {
    const loop = findLoop(loopNodeId)
    if (!loop) return null
    return applyLoopApplicationResult(loopNodeId, createLoopBodyNodeAt(loop.config.body, loopNodeId, node, point))
  }

  function removeWorkflowLoopBodyNode(loopNodeId: UUID, nodeId: UUID) {
    const loop = findLoop(loopNodeId)
    if (!loop) return null
    return applyLoopApplicationResult(loopNodeId, removeLoopBodyNodeAndPlacement(loop.config.body, loopNodeId, nodeId))
  }

  function moveWorkflowLoopBodyNode(loopNodeId: UUID, nodeId: UUID, point: WorkflowPoint) {
    const loop = findLoop(loopNodeId)
    if (!loop) return null
    return applyLoopApplicationResult(loopNodeId, moveLoopBodyNode(loop.config.body, nodeId, point))
  }

  function connectWorkflowLoopBodyNodes(loopNodeId: UUID, intent: ConnectNodesIntent) {
    const loop = findLoop(loopNodeId)
    if (!loop) return null
    return applyLoopApplicationResult(loopNodeId, connectLoopBodyDocumentNodes(loop.config.body, loopNodeId, intent))
  }

  function removeWorkflowLoopBodyEdge(loopNodeId: UUID, edgeId: UUID) {
    const loop = findLoop(loopNodeId)
    if (!loop) return null
    return applyLoopApplicationResult(loopNodeId, removeLoopBodyDocumentEdge(loop.config.body, loopNodeId, edgeId))
  }

  function setWorkflowLoopBodyViewport(loopNodeId: UUID, viewport: LoopNode['config']['body']['layout']['viewport']) {
    const loop = findLoop(loopNodeId)
    if (!loop) return null
    return applyLoopApplicationResult(loopNodeId, updateLoopBodyViewport(loop.config.body, viewport))
  }

  function changeAgentActionReusableTool(
    context: WorkflowCanvasContext,
    nodeId: UUID,
    reusableToolId: UUID,
    operation: 'bind' | 'unbind',
  ) {
    const current = document.value
    if (!current) return null
    const loop = context.kind === 'loop-body' ? findLoop(context.loopNodeId) : null
    if (context.kind === 'loop-body' && !loop) return null
    const graph = loop?.config.body.graph ?? current.workflow
    const availableIds = new Set(current.reusableTools.map((tool) => tool.id))
    const command = operation === 'bind' ? bindAgentActionReusableToolCommand : unbindAgentActionReusableToolCommand
    const resourceResult = command(graph.nodes, availableIds, { nodeId, reusableToolId })
    if (!resourceResult.ok) {
      lastDomainError.value = resourceResult.error
      lastCanvasError.value = null
      return resourceResult
    }
    if (!loop) return applyGraphResult(updateWorkflowNodeConfigCommand(current.workflow, { nodeId, nodeType: 'agent_action', config: resourceResult.value }))
    const graphResult = updateLoopBodyNodeConfig(loop.config.body.graph, loop.id, { nodeId, nodeType: 'agent_action', config: resourceResult.value })
    if (!graphResult.ok) {
      lastDomainError.value = graphResult.error
      lastCanvasError.value = null
      return graphResult
    }
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: graphResult.value, layout: structuredClone(loop.config.body.layout) } })
  }

  function bindWorkflowAgentActionReusableTool(context: WorkflowCanvasContext, nodeId: UUID, reusableToolId: UUID) {
    return changeAgentActionReusableTool(context, nodeId, reusableToolId, 'bind')
  }

  function toolTask(context: WorkflowCanvasContext, nodeId: UUID) {
    const graph = context.kind === 'root' ? document.value?.workflow : findLoop(context.loopNodeId)?.config.body.graph
    const node = graph?.nodes.find((n) => n.id === nodeId)
    return node?.type === 'task' ? node : null
  }
  function openSystemTool(context: WorkflowCanvasContext, nodeId: UUID, definitionId: UUID) {
    const definition = systemTools.value.find((t) => t.id === definitionId)
    const graph = context.kind === 'root' ? document.value?.workflow : findLoop(context.loopNodeId)?.config.body.graph
    const node = graph?.nodes.find((candidate) => candidate.id === nodeId)
    if (session.mode !== 'configure' || !definition || (node?.type !== 'task' && node?.type !== 'agent_action')) return false
    session.resourceBrowser.collapsed = false
    systemToolDraft.value = node.type === 'task'
      ? { host: 'task', context: { ...context }, nodeId, kind: definition.kind, step: null }
      : { host: 'agent-action', context: { ...context }, nodeId, definitionId: definition.id, kind: definition.kind, tool: null }
    toolError.value = null
    return true
  }
  function editSystemTool(context: WorkflowCanvasContext, nodeId: UUID, stepId: UUID) {
    const step = toolTask(context, nodeId)?.config.steps.find((s) => s.id === stepId)
    if (session.mode !== 'configure' || !step) return false
    session.resourceBrowser.collapsed = false
    systemToolDraft.value = { host: 'task', context: { ...context }, nodeId, kind: step.kind, step: structuredClone(step) }
    toolError.value = null
    return true
  }
  function cancelSystemTool() { systemToolDraft.value = null; toolError.value = null }
  function changeSystemTool(context: WorkflowCanvasContext, nodeId: UUID, intent: ToolEditIntent) {
    const task = toolTask(context, nodeId)
    if (!task || !document.value) return false
    const result = changeTaskTool(task, intent, {
      mode: session.mode, variables: document.value.variables,
      knowledgeSpaceIds: new Set(toolKnowledgeSpaces.value.filter((s) => ['ready', 'syncing'].includes(s.lifecycleStatus) && ['healthy', 'needs_review'].includes(s.graphStatus)).map((s) => s.id)),
    })
    if (!result.ok) { toolError.value = result.error; return false }
    if (context.kind === 'root') {
      const applied = applyGraphResult(updateWorkflowNodeConfigCommand(document.value.workflow, { nodeId, nodeType: 'task', config: result.value }))
      return applied.ok
    }
    const loop = findLoop(context.loopNodeId)
    if (!loop) return false
    const graph = updateLoopBodyNodeConfig(loop.config.body.graph, loop.id, { nodeId, nodeType: 'task', config: result.value })
    if (!graph.ok) return false
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: graph.value, layout: loop.config.body.layout } })?.ok ?? false
  }
  function saveSystemTool(input: TaskToolSaveDraft) {
    const { step, newVariable } = input
    const draft = systemToolDraft.value
    if (!draft || draft.host !== 'task' || draft.kind !== step.kind || (draft.step && draft.step.id !== step.id)) return false
    if (!changeSystemTool(draft.context, draft.nodeId, { type: draft.step ? 'edit' : 'add', step, ...(newVariable ? { newVariable } : {}) })) return false
    cancelSystemTool()
    return true
  }

  function saveAgentReusableTool(tool: AgentReusableTool) {
    const draft = systemToolDraft.value
    const current = document.value
    if (!draft || (draft.host !== 'agent-action' && draft.host !== 'reusable-tool-library') || !current || draft.kind !== tool.kind || (draft.tool && draft.tool.id !== tool.id)) return false
    if (draft.tool) {
      const result = updateAgentReusableTool(current.reusableTools, tool)
      if (!result.ok) {
        lastDomainError.value = result.error
        lastCanvasError.value = null
        return false
      }
      document.value = { ...current, reusableTools: result.value }
      lastDomainError.value = null
      lastCanvasError.value = null
      markDirty()
      cancelSystemTool()
      return true
    }
    if (draft.host === 'reusable-tool-library') return false
    const loop = draft.context.kind === 'loop-body' ? findLoop(draft.context.loopNodeId) : null
    if (draft.context.kind === 'loop-body' && !loop) return false
    if (!loop) {
      const result = instantiateAndBindAgentReusableTool(current.workflow.nodes, current.reusableTools, { nodeId: draft.nodeId, tool })
      if (!result.ok) {
        lastDomainError.value = result.error
        lastCanvasError.value = null
        return false
      }
      document.value = {
        ...current,
        workflow: { ...current.workflow, nodes: result.value.nodes },
        reusableTools: result.value.reusableTools,
      }
    } else {
      const result = instantiateAndBindAgentReusableTool(loop.config.body.graph.nodes, current.reusableTools, { nodeId: draft.nodeId, tool })
      if (!result.ok) {
        lastDomainError.value = result.error
        lastCanvasError.value = null
        return false
      }
      const graphResult = updateWorkflowLoopBodyDocumentCommand(current.workflow, loop.id, {
        graph: { ...loop.config.body.graph, nodes: result.value.nodes },
        layout: structuredClone(loop.config.body.layout),
      })
      if (!graphResult.ok) {
        lastDomainError.value = graphResult.error
        lastCanvasError.value = null
        return false
      }
      document.value = { ...current, workflow: graphResult.value, reusableTools: result.value.reusableTools }
    }
    lastDomainError.value = null
    lastCanvasError.value = null
    markDirty()
    cancelSystemTool()
    return true
  }

  function reusableToolReferenceCount(reusableToolId: UUID) {
    return document.value ? agentReusableToolReferenceCount(document.value, reusableToolId) : 0
  }

  function editLibraryReusableTool(reusableToolId: UUID) {
    const tool = document.value?.reusableTools.find((candidate) => candidate.id === reusableToolId)
    if (!tool || session.mode !== 'configure') return false
    session.resourceBrowser.collapsed = false
    systemToolDraft.value = { host: 'reusable-tool-library', kind: tool.kind, tool: structuredClone(tool) }
    toolError.value = null
    return true
  }

  function deleteLibraryReusableTool(reusableToolId: UUID) {
    const current = document.value
    if (!current || session.mode !== 'configure') return false
    const result = deleteAgentReusableTool(current, reusableToolId)
    if (!result.ok) {
      lastDomainError.value = result.error
      lastCanvasError.value = null
      return false
    }
    document.value = { ...current, reusableTools: result.value }
    lastDomainError.value = null
    lastCanvasError.value = null
    markDirty()
    return true
  }

  function editAgentReusableTool(context: WorkflowCanvasContext, nodeId: UUID, reusableToolId: UUID) {
    const current = document.value
    if (!current || session.mode !== 'configure') return false
    const graph = context.kind === 'root' ? current.workflow : findLoop(context.loopNodeId)?.config.body.graph
    const node = graph?.nodes.find((candidate) => candidate.id === nodeId)
    const tool = current.reusableTools.find((candidate) => candidate.id === reusableToolId)
    if (node?.type !== 'agent_action' || !node.config.reusableToolIds.includes(reusableToolId) || !tool) return false
    session.resourceBrowser.collapsed = false
    systemToolDraft.value = { host: 'agent-action', context: { ...context }, nodeId, definitionId: null, kind: tool.kind, tool: structuredClone(tool) }
    return true
  }

  function appendWorkflowTaskToolStep(context: WorkflowCanvasContext, nodeId: UUID, reusableToolId: UUID) {
    const current = document.value
    if (!current) return null
    const loop = context.kind === 'loop-body' ? findLoop(context.loopNodeId) : null
    if (context.kind === 'loop-body' && !loop) return null
    const graph = loop?.config.body.graph ?? current.workflow
    const result = appendReusableToolToTaskCommand(graph.nodes, current.reusableTools, {
      nodeId,
      reusableToolId,
      stepId: uuidSchema.parse(globalThis.crypto.randomUUID()),
      outputVariableId: uuidSchema.parse(globalThis.crypto.randomUUID()),
    })
    if (!result.ok) {
      lastDomainError.value = result.error
      lastCanvasError.value = null
      return result
    }
    if (!loop) return applyGraphResult(updateWorkflowNodeConfigCommand(current.workflow, { nodeId, nodeType: 'task', config: result.value }))
    const graphResult = updateLoopBodyNodeConfig(loop.config.body.graph, loop.id, { nodeId, nodeType: 'task', config: result.value })
    if (!graphResult.ok) {
      lastDomainError.value = graphResult.error
      lastCanvasError.value = null
      return graphResult
    }
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: graphResult.value, layout: structuredClone(loop.config.body.layout) } })
  }

  function saveTaskToolStepToReusableTools(context: WorkflowCanvasContext, nodeId: UUID, stepId: UUID) {
    const current = document.value
    if (!current || session.mode !== 'configure') return false
    const task = toolTask(context, nodeId)
    const step = task?.config.steps.find((candidate) => candidate.id === stepId)
    if (!step) return false
    const result = createAgentReusableToolFromTaskStep(
      current.reusableTools,
      step,
      uuidSchema.parse(globalThis.crypto.randomUUID()),
    )
    if (!result.ok) {
      lastDomainError.value = result.error
      lastCanvasError.value = null
      return false
    }
    document.value = { ...current, reusableTools: result.value.tools }
    lastDomainError.value = null
    lastCanvasError.value = null
    markDirty()
    return true
  }

  function unbindWorkflowAgentActionReusableTool(context: WorkflowCanvasContext, nodeId: UUID, reusableToolId: UUID) {
    return changeAgentActionReusableTool(context, nodeId, reusableToolId, 'unbind')
  }

  function changeAgentActionKnowledgeSpace(context: WorkflowCanvasContext, nodeId: UUID, knowledgeSpaceId: UUID, operation: 'bind' | 'unbind') {
    const current = document.value
    if (!current) return null
    const loop = context.kind === 'loop-body' ? findLoop(context.loopNodeId) : null
    if (context.kind === 'loop-body' && !loop) return null
    const graph = loop?.config.body.graph ?? current.workflow
    const availableIds = new Set(knowledgeSpaces.value
      .filter((space) => ['ready', 'syncing'].includes(space.lifecycleStatus)
        && ['healthy', 'needs_review'].includes(space.graphStatus))
      .map((space) => space.id))
    const command = operation === 'bind' ? bindAgentActionKnowledgeSpaceCommand : unbindAgentActionKnowledgeSpaceCommand
    const resourceResult = command(graph.nodes, availableIds, { nodeId, knowledgeSpaceId })
    if (!resourceResult.ok) {
      lastDomainError.value = resourceResult.error
      lastCanvasError.value = null
      return resourceResult
    }
    if (!loop) return applyGraphResult(updateWorkflowNodeConfigCommand(current.workflow, { nodeId, nodeType: 'agent_action', config: resourceResult.value }))
    const graphResult = updateLoopBodyNodeConfig(loop.config.body.graph, loop.id, { nodeId, nodeType: 'agent_action', config: resourceResult.value })
    if (!graphResult.ok) {
      lastDomainError.value = graphResult.error
      lastCanvasError.value = null
      return graphResult
    }
    return applyLoopApplicationResult(loop.id, { ok: true, value: { graph: graphResult.value, layout: structuredClone(loop.config.body.layout) } })
  }

  function bindWorkflowAgentActionKnowledgeSpace(context: WorkflowCanvasContext, nodeId: UUID, knowledgeSpaceId: UUID) {
    return changeAgentActionKnowledgeSpace(context, nodeId, knowledgeSpaceId, 'bind')
  }
  function unbindWorkflowAgentActionKnowledgeSpace(context: WorkflowCanvasContext, nodeId: UUID, knowledgeSpaceId: UUID) {
    return changeAgentActionKnowledgeSpace(context, nodeId, knowledgeSpaceId, 'unbind')
  }

  function createWorkflowNode(node: AddableWorkflowNode, point: WorkflowPoint) {
    const current = document.value
    if (!current) return null
    const result = applyApplicationResult(createWorkflowNodeAt({ graph: current.workflow, layout: current.layout }, node, point))
    if (result?.ok) {
      session.selectedNodeId = node.id
      session.selectedEdgeId = null
      session.panel = null
      session.resourceBrowser.collapsed = true
    }
    return result
  }

  function submitAgentActionDraft(values: AgentActionDraftValues, idFactory: Pick<WorkflowIdFactory, 'nodeId'>): WorkflowDraftResult<null> {
    const draft = session.creationDraft
    if (draft.type !== 'agent-action') return { ok: false, error: { code: 'DRAFT_SCHEMA_INVALID' } }
    const candidate = createAgentActionFromDraft(values, idFactory)
    if (!candidate.ok) return candidate
    const result = draft.context.kind === 'root'
      ? createWorkflowNode(candidate.value, draft.point)
      : createWorkflowLoopBodyNode(draft.context.loopNodeId, candidate.value, draft.point)
    if (!result?.ok) return { ok: false, error: { code: 'DRAFT_SCHEMA_INVALID' } }
    if (draft.context.kind === 'loop-body') {
      session.selectedNodeId = candidate.value.id
      session.selectedEdgeId = null
      session.panel = null
      session.resourceBrowser.collapsed = true
    }
    closeCreationDraft()
    return { ok: true, value: null }
  }

  function submitLoopDraft(values: LoopDraftValues, idFactory: Pick<WorkflowIdFactory, 'nodeId' | 'edgeId'>): WorkflowDraftResult<null> {
    const draft = session.creationDraft
    const current = document.value
    if (draft.type !== 'loop' || !current) return { ok: false, error: { code: 'DRAFT_SCHEMA_INVALID' } }
    const candidate = createLoopFromDraft(values, current.variables, idFactory)
    if (!candidate.ok) return candidate
    const result = createWorkflowNode(candidate.value, draft.point)
    if (!result?.ok) return { ok: false, error: { code: 'DRAFT_SCHEMA_INVALID' } }
    closeCreationDraft()
    return { ok: true, value: null }
  }

  function removeWorkflowNodeWithLayout(nodeId: UUID) {
    const current = document.value
    if (!current) return null
    const result = applyApplicationResult(removeWorkflowNodeAndPlacement({ graph: current.workflow, layout: current.layout }, nodeId))
    if (result?.ok && session.selectedNodeId === nodeId) {
      session.selectedNodeId = null
      session.panel = null
    }
    return result
  }

  function moveWorkflowNode(nodeId: UUID, point: WorkflowPoint) {
    const current = document.value
    if (!current) return null
    const result = moveNodePlacement(current.layout, nodeId, point)
    if (result.ok) {
      document.value = { ...current, layout: result.value }
      markDirty()
    }
    return result
  }

  function resizeWorkflowNode(nodeId: UUID, size: { width: number; height: number }) {
    const current = document.value
    if (!current) return null
    const result = resizeNodePlacement(current.layout, nodeId, size)
    if (result.ok) {
      document.value = { ...current, layout: result.value }
      markDirty()
    }
    return result
  }

  function setViewport(viewport: AgentWorkflowEditorDocument['layout']['viewport']) {
    const current = document.value
    if (!current) return null
    const result = updateCanvasViewport(current.layout, viewport)
    if (result.ok) {
      document.value = { ...current, layout: result.value }
      markDirty()
    }
    return result
  }

  async function save(repository?: WorkflowEditorRepository): Promise<boolean> {
    if (repository) activeRepository = repository
    return autosaveCoordinator.run(async () => {
      const current = document.value
      const state = persistenceState.value
      const targetRepository = activeRepository
      if (!current || !state || !targetRepository) return false
      const request = ++saveRequestSeq
      const savingState = beginPersistenceSave(state, request)
      if (!savingState) return false
      const snapshot = createSaveInput(toRaw<AgentWorkflowEditorDocument>(current))
      const controller = new AbortController()
      saveController = controller
      persistenceState.value = savingState
      const result = await targetRepository.saveAgentWorkflow(snapshot, { signal: controller.signal })
      const latestState = persistenceState.value
      if (controller.signal.aborted || !latestState || !document.value) return false
      if (!result.ok) {
        persistenceState.value = applyPersistenceFailure(latestState, request, result.error)
        return false
      }
      document.value = {
        ...document.value,
        agent: { ...document.value.agent, revision: result.value.revision, updatedAt: result.value.updatedAt },
      }
      persistenceState.value = applyPersistenceSuccess(latestState, request, result.value.revision, Date.now())
      if (persistenceState.value.type === 'dirty') scheduleAutosave(0)
      if (saveController === controller) saveController = null
      return true
    })
  }

  async function retrySave(): Promise<boolean> {
    return save()
  }

  async function reloadAfterConflict(): Promise<boolean> {
    const current = document.value
    const repository = activeRepository
    if (!current || !repository || persistenceState.value?.type !== 'conflict') return false
    await load(current.agent.journeyId, current.agent.id, repository)
    return loadState.status === 'ready'
  }

  async function overwriteAfterConflict(): Promise<boolean> {
    const current = document.value
    const repository = activeRepository
    const state = persistenceState.value
    if (!current || !repository || state?.type !== 'conflict') return false
    const result = await repository.loadAgentWorkflow(current.agent.journeyId, current.agent.id)
    if (!result.ok || !document.value || persistenceState.value?.type !== 'conflict') return false
    const prepared = preparePersistenceConflictOverwrite(persistenceState.value, result.value.agent.revision, Date.now())
    if (!prepared) return false
    document.value = {
      ...document.value,
      agent: {
        ...document.value.agent,
        revision: result.value.agent.revision,
        updatedAt: result.value.agent.updatedAt,
      },
    }
    persistenceState.value = prepared
    return save()
  }

  function dispose() {
    activeRequest += 1
    saveRequestSeq += 1
    autosaveCoordinator.dispose()
    loadController?.abort()
    saveController?.abort()
    knowledgeController?.abort()
    loadController = null
    saveController = null
    activeRepository = null
    knowledgeController = null
    document.value = null
    knowledgeSpaces.value = []
    knowledgeInventory.status = 'idle'
    knowledgeInventory.error = null
    knowledgeInventory.page = 1
    knowledgeInventory.pageSize = 6
    knowledgeInventory.total = 0
    lastDomainError.value = null
    lastCanvasError.value = null
    resetSession()
    loadState.status = 'idle'
    loadState.error = null
    persistenceState.value = null
  }

  return {
    toolKnowledgeSpaces, toolKnowledgeStatus, systemTools, systemToolStatus, systemToolDraft, toolError, toolTask, openSystemTool, editSystemTool, cancelSystemTool, changeSystemTool, saveSystemTool, saveAgentReusableTool, editAgentReusableTool, editLibraryReusableTool, deleteLibraryReusableTool, reusableToolReferenceCount,
    variableError, variableReferenceCount, saveAgentVariable, deleteAgentVariable,
    routingJourney, document, session, persistence, persistenceState, hasUnsavedChanges, knowledgeSpaces, knowledgeInventory, lastDomainError, lastCanvasError, isReady, load, setMode, setPanel, setFocusMode, setPaletteCollapsed,
    selectNode, selectEdge, closeInspector, setInteraction, stageCreationDraft, closeCreationDraft, submitAgentActionDraft, submitLoopDraft, clearWorkflowErrors, rejectCanvasInteraction,
    setResourceBrowserCollapsed, setResourceBrowserCategory, setResourceBrowserQuery, setResourceBrowserPage, loadKnowledgeSpaces,
    addWorkflowNode, removeWorkflowNode, connectWorkflowNodes, removeWorkflowEdge,
    applyWorkflowBranchEdit, updateWorkflowNodeConfig, updateWorkflowAgentActionDetails, renameWorkflowNode, updateWorkflowLoopSettings, updateWorkflowLoopDetails, createWorkflowNode,
    removeWorkflowNodeWithLayout, moveWorkflowNode, resizeWorkflowNode, setViewport, replaceWorkflowFromImport, applyCompiledWorkflow, save, retrySave, reloadAfterConflict, overwriteAfterConflict, toSaveInput, dispose,
    switchCanvasContext, expandLoopInline, collapseInlineLoop,
    createWorkflowLoopBodyNode, removeWorkflowLoopBodyNode, moveWorkflowLoopBodyNode,
    connectWorkflowLoopBodyNodes, removeWorkflowLoopBodyEdge, setWorkflowLoopBodyViewport,
    bindWorkflowAgentActionReusableTool, unbindWorkflowAgentActionReusableTool,
    appendWorkflowTaskToolStep, saveTaskToolStepToReusableTools,
    bindWorkflowAgentActionKnowledgeSpace, unbindWorkflowAgentActionKnowledgeSpace,
  }
})
