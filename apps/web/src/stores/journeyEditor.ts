import { computed, reactive, ref, shallowRef, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type {
  TemplateEndAssignment,
  EndBinding,
  HubSpokeDirection,
  RoutingConfirmation,
  RoutingImpact,
  AgentTemplate,
  AgentWorkflowEditorDocument,
  GuardrailSide,
  JourneyEditorDocument,
  RepositoryError,
  SaveJourneyInput,
  UUID,
} from '@odyssey/schemas'

import { deriveEndBindings } from '@odyssey/schemas'
import type { AgentLifecycleRepository, JourneyEditorRepository, GuardrailLifecycleRepository } from '@/repositories'
import type { JourneyTab } from '@/router/routeContracts'
import {
  setHubSpokeDirection as setPatternDirection,
  addSlot as addPatternSlot,
  assignAgent as assignPatternAgent,
  exchangeAgents as exchangePatternAgents,
  moveAgent as movePatternAgent,
  removeSlot as removePatternSlot,
  reorderSlot as reorderPatternSlot,
  unassignAgent as unassignPatternAgent,
} from '@/domain/pattern/patternCommands'
import type { PatternCommandResult, PatternDomainError } from '@/domain/pattern/patternErrors'
import type { PatternIdFactory } from '@/domain/pattern/patternIdFactory'
import {
  evaluatePatternDrop,
  transitionPatternInteraction,
  type MenuAnchor,
  type DragPayloadParseErrorCode,
  type PatternDragPayload,
  type PatternDropReason,
  type PatternDropTarget,
  type PatternInteractionState,
} from '@/canvas/interaction'
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

export type { LoadStatus, SaveStatus } from './editorStatus'
export const JOURNEY_AUTOSAVE_DELAY_MS = 800

export type GuardrailOperationState =
  | { type: 'idle' }
  | { type: 'adding'; side: GuardrailSide; requestSeq: number }
  | { type: 'removing'; side: GuardrailSide; requestSeq: number }
  | { type: 'failed'; side: GuardrailSide; operation: 'add' | 'remove'; error: RepositoryError }
  | { type: 'conflict'; side: GuardrailSide; operation: 'add' | 'remove'; error: Extract<RepositoryError, { code: 'REVISION_CONFLICT' | 'STATE_CONFLICT' }> }

export type GuardrailInteractionState =
  | { type: 'idle' }
  | { type: 'menu-open'; side: GuardrailSide; agentId: UUID; anchor: MenuAnchor }
  | { type: 'confirming-removal'; side: GuardrailSide; agentId: UUID }

export type WorkflowPreviewState =
  | { type: 'closed' }
  | { type: 'loading'; agentId: UUID; requestSeq: number }
  | { type: 'ready'; agentId: UUID }
  | { type: 'error'; agentId: UUID; error: RepositoryError }

export const useJourneyEditorStore = defineStore('journeyEditor', () => {
  const document = ref<JourneyEditorDocument | null>(null)
  const routingImpact = shallowRef<RoutingImpact[]>([])
  const templateExitMapping = shallowRef<{ templateId: UUID; slotId: UUID; sources: { id: UUID; name: string }[]; bindings: EndBinding[] } | null>(null)
  let templateMappingRepository: AgentLifecycleRepository | null = null
  const session = reactive({
    activeTab: 'execution' as JourneyTab,
    selectedSlotId: null as UUID | null,
    previewAgentId: null as UUID | null,
    lastPatternError: null as PatternDomainError | null,
    lastDropError: null as PatternDropReason | null,
    lastDragBoundaryError: null as DragPayloadParseErrorCode | null,
    interaction: { type: 'idle' } as PatternInteractionState,
    guardrailInteraction: { type: 'idle' } as GuardrailInteractionState,
  })
  // Templates are replaced as validated repository snapshots; deep Vue proxy
  // unwrapping is unnecessary and causes pathological type expansion here.
  const agentTemplates = shallowRef<AgentTemplate[]>([])
  const previewDocument = shallowRef<AgentWorkflowEditorDocument | null>(null)
  const previewState = ref<WorkflowPreviewState>({ type: 'closed' })
  const lifecycle = reactive({
    templateStatus: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    operationStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    error: null as RepositoryError | null,
  })
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
  const guardrailOperation = ref<GuardrailOperationState>({ type: 'idle' })
  let activeRequest = 0
  let loadController: AbortController | null = null
  let lifecycleRequest = 0
  let lifecycleController: AbortController | null = null
  let templateRequest = 0
  let templateController: AbortController | null = null
  let guardrailRequest = 0
  let guardrailController: AbortController | null = null
  let previewRequest = 0
  let previewController: AbortController | null = null
  let pendingRoutingRemoval: ((confirmation: RoutingConfirmation) => Promise<boolean>) | null = null
  let activeRepository: JourneyEditorRepository | null = null
  let saveController: AbortController | null = null
  let saveRequestSeq = 0
  const autosaveCoordinator = new AutosaveCoordinator()

  const isReady = computed(() => loadState.status === 'ready' && document.value !== null)
  const hasUnsavedChanges = computed(() => hasUnsavedPersistenceChanges(persistenceState.value))

  function clearAutosaveTimer() {
    autosaveCoordinator.cancelScheduled()
  }

  function scheduleAutosave(delay = JOURNEY_AUTOSAVE_DELAY_MS) {
    clearAutosaveTimer()
    if (!activeRepository || persistenceState.value?.type !== 'dirty') return
    autosaveCoordinator.schedule(() => save(), delay)
  }

  function markDirty() {
    const state = persistenceState.value
    if (!state) return
    persistenceState.value = markPersistenceDirty(state, Date.now() + JOURNEY_AUTOSAVE_DELAY_MS)
    if (persistenceState.value.type === 'dirty') scheduleAutosave()
  }

  function acceptServerAggregate(next: JourneyEditorDocument, recordMutation = true) {
    const preview = previewDocument.value
    if (preview && next.agents.find((agent) => agent.id === preview.agent.id)?.revision !== preview.agent.revision) closeWorkflowPreview()
    document.value = structuredClone(next)
    const mutationSeq = recordMutation ? (persistenceState.value?.mutationSeq ?? 0) + 1 : 0
    persistenceState.value = {
      ...createCleanPersistenceState(next.journey.revision),
      mutationSeq,
      savedMutationSeq: mutationSeq,
    }
    clearAutosaveTimer()
  }

  function resetSession(tab: JourneyTab = 'execution') {
    routingImpact.value = []
    pendingRoutingRemoval = null
    templateExitMapping.value = null
    templateMappingRepository = null
    session.activeTab = tab
    session.selectedSlotId = null
    session.previewAgentId = null
    session.lastPatternError = null
    session.lastDropError = null
    session.lastDragBoundaryError = null
    session.interaction = { type: 'idle' }
    session.guardrailInteraction = { type: 'idle' }
    previewRequest += 1
    previewController?.abort()
    previewController = null
    previewDocument.value = null
    previewState.value = { type: 'closed' }
  }

  function invalidateLifecycleRequests() {
    lifecycleRequest += 1
    templateRequest += 1
    lifecycleController?.abort()
    templateController?.abort()
    lifecycleController = null
    templateController = null
    guardrailRequest += 1
    guardrailController?.abort()
    guardrailController = null
  }

  function resetLifecycle() {
    lifecycle.templateStatus = 'idle'
    lifecycle.operationStatus = 'idle'
    lifecycle.error = null
    guardrailOperation.value = { type: 'idle' }
  }

  async function load(journeyId: UUID, tab: JourneyTab, repository: JourneyEditorRepository) {
    clearAutosaveTimer()
    saveRequestSeq += 1
    saveController?.abort()
    autosaveCoordinator.dispose()
    activeRepository = repository
    loadController?.abort()
    invalidateLifecycleRequests()
    const controller = new AbortController()
    loadController = controller
    const request = ++activeRequest
    document.value = null
    agentTemplates.value = []
    resetSession(tab)
    resetLifecycle()
    loadState.status = 'loading'
    loadState.error = null
    persistenceState.value = null

    const result = await repository.loadJourney(journeyId, { signal: controller.signal })
    if (request !== activeRequest || controller.signal.aborted) return
    if (result.ok) {
      acceptServerAggregate(result.value, false)
      loadState.status = 'ready'
      return
    }
    loadState.error = result.error
    loadState.status = result.error.code === 'NOT_FOUND' ? 'not-found' : 'error'
  }

  function setActiveTab(tab: JourneyTab) {
    session.activeTab = tab
  }

  function selectSlot(slotId: UUID | null) {
    session.selectedSlotId = slotId && document.value?.pattern.slots.some((slot) => slot.id === slotId)
      ? slotId
      : null
  }

  function closeWorkflowPreview() {
    previewRequest += 1
    previewController?.abort()
    previewController = null
    previewDocument.value = null
    previewState.value = { type: 'closed' }
    session.previewAgentId = null
  }

  async function openWorkflowPreview(agentId: UUID, repository: JourneyEditorRepository): Promise<boolean> {
    const current = document.value
    if (!current || !current.agents.some((agent) => agent.id === agentId)) return false
    if (previewState.value.type === 'ready' && previewDocument.value?.agent.id === agentId) return true
    previewController?.abort()
    const controller = new AbortController()
    previewController = controller
    const requestSeq = ++previewRequest
    const journeyId = current.journey.id
    session.previewAgentId = agentId
    previewDocument.value = null
    previewState.value = { type: 'loading', agentId, requestSeq }
    const result = await repository.loadAgentWorkflow(journeyId, agentId, { signal: controller.signal })
    if (requestSeq !== previewRequest || controller.signal.aborted || document.value?.journey.id !== journeyId || session.previewAgentId !== agentId) return false
    if (!result.ok) {
      if (result.error.code === 'ABORTED') {
        closeWorkflowPreview()
        return false
      }
      previewState.value = { type: 'error', agentId, error: result.error }
      return false
    }
    if (result.value.agent.id !== agentId || result.value.agent.journeyId !== journeyId) {
      previewState.value = { type: 'error', agentId, error: { code: 'RESPONSE_INVALID' } }
      return false
    }
    previewDocument.value = structuredClone(result.value)
    previewState.value = { type: 'ready', agentId }
    return true
  }

  async function selectSlotForPreview(slotId: UUID, repository: JourneyEditorRepository): Promise<boolean> {
    const slot = document.value?.pattern.slots.find((candidate) => candidate.id === slotId)
    if (!slot) return false
    session.selectedSlotId = slotId
    session.guardrailInteraction = { type: 'idle' }
    if (!slot.agentId) {
      closeWorkflowPreview()
      return true
    }
    return openWorkflowPreview(slot.agentId, repository)
  }

  async function selectGuardrailForPreview(side: GuardrailSide, repository: JourneyEditorRepository): Promise<boolean> {
    const guardrail = side === 'input' ? document.value?.inputGuardrail : document.value?.outputGuardrail
    if (guardrail?.state !== 'active') return false
    session.selectedSlotId = null
    return openWorkflowPreview(guardrail.agentId, repository)
  }

  async function retryWorkflowPreview(repository: JourneyEditorRepository): Promise<boolean> {
    const agentId = session.previewAgentId
    return agentId ? openWorkflowPreview(agentId, repository) : false
  }

  function openMenu(slotId: UUID, anchor: MenuAnchor) {
    if (!document.value?.pattern.slots.some((slot) => slot.id === slotId)) return
    session.selectedSlotId = slotId
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'open-menu', slotId, anchor })
  }

  function cancelInteraction() {
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'cancel' })
    session.guardrailInteraction = { type: 'idle' }
  }

  function openGuardrailMenu(side: GuardrailSide, anchor: MenuAnchor) {
    const guardrail = side === 'input' ? document.value?.inputGuardrail : document.value?.outputGuardrail
    if (guardrail?.state !== 'active') return
    session.selectedSlotId = null
    session.interaction = { type: 'idle' }
    session.guardrailInteraction = { type: 'menu-open', side, agentId: guardrail.agentId, anchor }
  }

  function stageGuardrailRemoval(side: GuardrailSide, agentId: UUID) {
    const guardrail = side === 'input' ? document.value?.inputGuardrail : document.value?.outputGuardrail
    if (guardrail?.state !== 'active' || guardrail.agentId !== agentId) return
    session.guardrailInteraction = { type: 'confirming-removal', side, agentId }
  }

  function guardrailFailure(side: GuardrailSide, operation: 'add' | 'remove', error: RepositoryError): GuardrailOperationState {
    return error.code === 'REVISION_CONFLICT' || error.code === 'STATE_CONFLICT'
      ? { type: 'conflict', side, operation, error }
      : { type: 'failed', side, operation, error }
  }

  async function addGuardrail(side: GuardrailSide, repository: GuardrailLifecycleRepository): Promise<UUID | false> {
    if (!(await flushLocalChanges())) return false
    const current = document.value
    const projection = side === 'input' ? current?.inputGuardrail : current?.outputGuardrail
    if (!current || projection?.state !== 'inactive' || guardrailOperation.value.type === 'adding' || guardrailOperation.value.type === 'removing') return false
    guardrailController?.abort()
    const controller = new AbortController()
    guardrailController = controller
    const requestSeq = ++guardrailRequest
    const journeyId = current.journey.id
    guardrailOperation.value = { type: 'adding', side, requestSeq }
    const result = await repository.addGuardrail({ journeyId, side, expectedRevision: current.journey.revision }, { signal: controller.signal })
    if (requestSeq !== guardrailRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      guardrailOperation.value = guardrailFailure(side, 'add', result.error)
      return false
    }
    acceptServerAggregate(result.value.journey)
    session.selectedSlotId = null
    closeWorkflowPreview()
    session.previewAgentId = result.value.agent.agent.id
    previewDocument.value = structuredClone(result.value.agent)
    previewState.value = { type: 'ready', agentId: result.value.agent.agent.id }
    session.guardrailInteraction = { type: 'idle' }
    guardrailOperation.value = { type: 'idle' }
    return result.value.agent.agent.id
  }

  async function removeGuardrail(side: GuardrailSide, expectedAgentId: UUID, repository: GuardrailLifecycleRepository): Promise<boolean> {
    if (!(await flushLocalChanges())) return false
    const current = document.value
    const projection = side === 'input' ? current?.inputGuardrail : current?.outputGuardrail
    if (!current || projection?.state !== 'active' || projection.agentId !== expectedAgentId || guardrailOperation.value.type === 'adding' || guardrailOperation.value.type === 'removing') return false
    guardrailController?.abort()
    const controller = new AbortController()
    guardrailController = controller
    const requestSeq = ++guardrailRequest
    const journeyId = current.journey.id
    guardrailOperation.value = { type: 'removing', side, requestSeq }
    const result = await repository.removeGuardrail({ journeyId, side, expectedRevision: current.journey.revision, expectedAgentId }, { signal: controller.signal })
    if (requestSeq !== guardrailRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      guardrailOperation.value = guardrailFailure(side, 'remove', result.error)
      return false
    }
    acceptServerAggregate(result.value)
    if (session.previewAgentId === expectedAgentId) closeWorkflowPreview()
    session.selectedSlotId = null
    session.guardrailInteraction = { type: 'idle' }
    guardrailOperation.value = { type: 'idle' }
    return true
  }

  function stageTemplateName(slotId: UUID) {
    const slot = document.value?.pattern.slots.find((candidate) => candidate.id === slotId)
    if (!slot?.agentId) return
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'name-template', slotId })
  }

  function stageSlotRemoval(slotId: UUID) {
    const agentId = document.value?.pattern.slots.find((slot) => slot.id === slotId)?.agentId
    if (!agentId) return
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'confirm-slot-removal', slotId, agentId })
  }

  function requestSlotRemoval() {
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'request-slot-removal' })
  }

  function chooseAgent(slotId: UUID, mode: 'assign' | 'replace') {
    if (!document.value?.pattern.slots.some((slot) => slot.id === slotId)) return
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'choose-agent', slotId, mode })
  }

  function beginDrag(payload: PatternDragPayload) {
    if (lifecycle.operationStatus === 'loading') return
    session.lastDropError = null
    session.lastDragBoundaryError = null
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'begin-drag', payload })
  }

  function rejectDragBoundary(error: DragPayloadParseErrorCode) {
    session.lastDragBoundaryError = error
    session.lastDropError = null
    cancelInteraction()
  }

  function rejectDrop(reason: PatternDropReason) {
    session.lastDropError = reason
    session.lastDragBoundaryError = null
    cancelInteraction()
  }

  function clearInteractionFeedback() {
    session.lastDropError = null
    session.lastDragBoundaryError = null
  }

  function endDrag() { cancelInteraction() }

  function evaluateDrag(target: PatternDropTarget) {
    if (session.interaction.type !== 'dragging' || !document.value) return null
    const evaluation = evaluatePatternDrop(session.interaction.payload, target, document.value.pattern)
    session.interaction = transitionPatternInteraction(session.interaction, {
      type: 'evaluate-drag', target, feedback: evaluation.feedback,
    })
    return evaluation
  }

  function reconcileSession() {
    const slotIds = new Set(document.value?.pattern.slots.map((slot) => slot.id) ?? [])
    if (session.selectedSlotId && !slotIds.has(session.selectedSlotId)) session.selectedSlotId = null
    const interactionSlotId = session.interaction.type === 'menu-open' || session.interaction.type === 'naming-template' || session.interaction.type === 'confirming-slot-removal' || session.interaction.type === 'slot-removal-requested' || session.interaction.type === 'choosing-agent'
      || session.interaction.type === 'confirming-agent-replacement' || session.interaction.type === 'agent-replacement-requested'
      ? session.interaction.slotId
      : session.interaction.type === 'naming-duplicate' || session.interaction.type === 'duplicate-requested'
        ? session.interaction.sourceSlotId : null
    if (interactionSlotId && !slotIds.has(interactionSlotId)) cancelInteraction()
    const activeAgentIds = new Set(document.value?.pattern.slots.flatMap((slot) => slot.agentId ? [slot.agentId] : []) ?? [])
    const input = document.value?.inputGuardrail
    const output = document.value?.outputGuardrail
    if (input?.state === 'active') activeAgentIds.add(input.agentId)
    if (output?.state === 'active') activeAgentIds.add(output.agentId)
    if (session.previewAgentId && !activeAgentIds.has(session.previewAgentId)) closeWorkflowPreview()
  }

  function applyPatternCommand(command: (pattern: JourneyEditorDocument['pattern']) => PatternCommandResult): PatternCommandResult | null {
    const current = document.value
    if (!current || templateExitMapping.value || routingImpact.value.length || lifecycle.operationStatus === 'loading' || guardrailOperation.value.type === 'adding' || guardrailOperation.value.type === 'removing') return null
    const result = command(structuredClone(toRaw(current.pattern)))
    if (!result.ok) {
      session.lastPatternError = result.error
      return result
    }
    current.pattern = structuredClone(result.value)
    session.lastPatternError = null
    markDirty()
    reconcileSession()
    return result
  }

  const setHubSpokeDirection = (slotId: UUID, direction: HubSpokeDirection, ids: Pick<PatternIdFactory, 'routeId'>) =>
    applyPatternCommand((pattern) => setPatternDirection(pattern, slotId, direction, ids))

  const assignAgent = (slotId: UUID, agentId: UUID) =>
    applyPatternCommand((pattern) => assignPatternAgent(pattern, slotId, agentId))
  const moveAgent = (sourceSlotId: UUID, targetSlotId: UUID) =>
    applyPatternCommand((pattern) => movePatternAgent(pattern, sourceSlotId, targetSlotId))
  const exchangeAgents = (firstSlotId: UUID, secondSlotId: UUID) =>
    applyPatternCommand((pattern) => exchangePatternAgents(pattern, firstSlotId, secondSlotId))
  const unassignAgent = (slotId: UUID) =>
    applyPatternCommand((pattern) => unassignPatternAgent(pattern, slotId))
  const addSlot = (label: string, idFactory: Pick<PatternIdFactory, 'slotId' | 'routeId'>, anchor?: { readonly slotId: UUID; readonly placement: 'before' | 'after' }) =>
    applyPatternCommand((pattern) => addPatternSlot(pattern, label, idFactory, anchor))
  const removeSlot = (slotId: UUID, idFactory: Pick<PatternIdFactory, 'routeId'>) =>
    applyPatternCommand((pattern) => removePatternSlot(pattern, slotId, idFactory))
  const reorderSlot = (slotId: UUID, targetOrder: number, idFactory: Pick<PatternIdFactory, 'routeId'>) =>
    applyPatternCommand((pattern) => reorderPatternSlot(pattern, slotId, targetOrder, idFactory))

  function stageDuplicate(sourceSlotId: UUID, draftName = '') {
    if (!document.value?.pattern.slots.some((slot) => slot.id === sourceSlotId)) return
    session.interaction = transitionPatternInteraction(session.interaction, {
      type: 'name-duplicate', sourceSlotId, targetSlotId: null, draftName,
    })
  }

  function stageAgentReplacement(slotId: UUID, templateId: UUID) {
    const slot = document.value?.pattern.slots.find((candidate) => candidate.id === slotId)
    if (!slot?.agentId || !agentTemplates.value.some((template) => template.id === templateId)) return
    session.interaction = transitionPatternInteraction(session.interaction, {
      type: 'confirm-agent-replacement', slotId, templateId,
    })
  }

  function requestAgentReplacement() {
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'request-agent-replacement' })
  }

  function updateDuplicateName(draftName: string) {
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'update-duplicate-name', draftName })
  }

  function updateDuplicateTarget(targetSlotId: UUID) {
    const target = document.value?.pattern.slots.find((slot) => slot.id === targetSlotId)
    if (!target || target.agentId) return
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'update-duplicate-target', targetSlotId })
  }

  function requestDuplicate() {
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'request-duplicate' })
  }

  async function loadAgentTemplates(repository: AgentLifecycleRepository) {
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return
    templateController?.abort()
    const controller = new AbortController()
    templateController = controller
    const request = ++templateRequest
    lifecycle.templateStatus = 'loading'
    lifecycle.error = null
    const result = await repository.listAgentTemplates({ signal: controller.signal })
    if (request !== templateRequest || controller.signal.aborted || document.value?.journey.id !== current.journey.id) return
    if (!result.ok) {
      lifecycle.templateStatus = 'error'
      lifecycle.error = result.error
      return
    }
    agentTemplates.value = structuredClone(result.value)
    lifecycle.templateStatus = 'ready'
  }

  async function createAgent(slotId: UUID, repository: AgentLifecycleRepository): Promise<UUID | false> {
    if (!(await flushLocalChanges())) return false
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return false
    const controller = new AbortController()
    lifecycleController = controller
    const request = ++lifecycleRequest
    const journeyId = current.journey.id
    lifecycle.operationStatus = 'loading'
    lifecycle.error = null
    cancelInteraction()
    const result = await repository.createJourneyAgent({
      journeyId, slotId, expectedRevision: current.journey.revision,
    }, { signal: controller.signal })
    if (request !== lifecycleRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      lifecycle.operationStatus = 'error'; lifecycle.error = result.error; return false
    }
    acceptServerAggregate(result.value.journey)
    session.selectedSlotId = slotId
    cancelInteraction()
    lifecycle.operationStatus = 'success'
    return result.value.agent.agent.id
  }

  async function instantiateTemplate(templateId: UUID, slotId: UUID, repository: AgentLifecycleRepository, endAssignments?: TemplateEndAssignment[]) {
    if (!(await flushLocalChanges())) return false
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return false
    const bindings = deriveEndBindings(toRaw(current.pattern), slotId)
    if (!endAssignments && bindings.length > 1) {
      const template = agentTemplates.value.find((item) => item.id === templateId)
      if (!template) return false
      templateExitMapping.value = { templateId, slotId, bindings, sources: template.snapshot.workflow.nodes
        .filter((node) => node.type === 'end').map((node) => ({ id: node.id, name: `${node.name} · ${node.id.slice(-6)}` })) }
      templateMappingRepository = repository
      return false
    }
    const controller = new AbortController()
    lifecycleController = controller
    const request = ++lifecycleRequest
    const journeyId = current.journey.id
    lifecycle.operationStatus = 'loading'
    lifecycle.error = null
    cancelInteraction()
    const result = await repository.instantiateAgentTemplate({
      journeyId, slotId, templateId, ...(endAssignments ? { endAssignments } : {}), expectedRevision: current.journey.revision,
    }, { signal: controller.signal })
    if (request !== lifecycleRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      lifecycle.operationStatus = 'error'; lifecycle.error = result.error; return false
    }
    acceptServerAggregate(result.value.journey)
    session.selectedSlotId = slotId
    cancelInteraction()
    lifecycle.operationStatus = 'success'
    return true
  }

  async function unassignAgentAndSave(slotId: UUID, repository: JourneyEditorRepository): Promise<boolean> {
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return false
    const candidate = unassignPatternAgent(structuredClone(toRaw(current.pattern)), slotId)
    if (!candidate.ok) {
      session.lastPatternError = candidate.error
      return false
    }
    lifecycle.operationStatus = 'loading'
    lifecycle.error = null
    cancelInteraction()
    activeRepository = repository
    const previousPattern = structuredClone(toRaw(current.pattern))
    current.pattern = structuredClone(toRaw(candidate.value))
    markDirty()
    const saved = await save(repository)
    if (!saved) {
      const saveError = persistence.error
      if (document.value?.journey.id === current.journey.id) document.value.pattern = previousPattern
      lifecycle.operationStatus = 'error'
      lifecycle.error = saveError ?? { code: 'NETWORK_FAILED' }
      return false
    }
    session.selectedSlotId = slotId
    session.lastPatternError = null
    lifecycle.operationStatus = 'success'
    reconcileSession()
    return true
  }

  function cancelTemplateExitMapping() { templateExitMapping.value = null; templateMappingRepository = null }

  async function confirmTemplateExitMapping(mapping: { sourceEndId: UUID; targetEndId: UUID }[]) {
    const pending = templateExitMapping.value
    const repository = templateMappingRepository
    if (!pending || !repository) return false
    const assignments: TemplateEndAssignment[] = []
    for (const entry of mapping) {
      const binding = pending.bindings.find((item) => (item.target.type === 'slot' ? item.target.slotId : item.sourceSlotId) === entry.targetEndId)
      if (!binding) return false
      assignments.push({ endNodeId: entry.sourceEndId, target: binding.target })
    }
    const ok = await instantiateTemplate(pending.templateId, pending.slotId, repository, assignments)
    if (ok) cancelTemplateExitMapping()
    return ok
  }

  async function saveAsTemplate(agentId: UUID, name: string, description: string | null, repository: AgentLifecycleRepository) {
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return false
    const controller = new AbortController()
    templateRequest += 1
    templateController?.abort()
    templateController = null
    lifecycleController = controller
    const request = ++lifecycleRequest
    const journeyId = current.journey.id
    lifecycle.operationStatus = 'loading'
    lifecycle.error = null
    const result = await repository.saveAgentAsTemplate({
      journeyId, agentId, name, description,
    }, { signal: controller.signal })
    if (request !== lifecycleRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      lifecycle.operationStatus = 'error'; lifecycle.error = result.error; return false
    }
    const savedTemplate: AgentTemplate = structuredClone(result.value)
    const retainedTemplates: AgentTemplate[] = agentTemplates.value
      .filter((template: AgentTemplate) => template.id !== savedTemplate.id)
    const updatedTemplates: AgentTemplate[] = [...retainedTemplates, savedTemplate]
    agentTemplates.value = updatedTemplates
    lifecycle.operationStatus = 'success'
    cancelInteraction()
    return true
  }

  async function removeOccupiedSlot(
    slotId: UUID,
    expectedAgentId: UUID,
    agentAction: { type: 'discard' } | { type: 'save_as_template_and_discard'; template: { name: string; description: string | null } },
    repository: AgentLifecycleRepository,
    confirmation?: RoutingConfirmation,
  ) {
    if (!(await flushLocalChanges())) return false
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return false
    const controller = new AbortController()
    lifecycleController = controller
    const request = ++lifecycleRequest
    const journeyId = current.journey.id
    lifecycle.operationStatus = 'loading'
    lifecycle.error = null
    const result = await repository.removeOccupiedSlot({
      journeyId,
      slotId,
      expectedRevision: current.journey.revision,
      expectedAgentId,
      agentAction,
      ...(confirmation ? { routingConfirmation: confirmation } : {}),
    }, { signal: controller.signal })
    if (request !== lifecycleRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      if (result.error.code === 'STATE_CONFLICT' && result.error.reason === 'END_ROUTING_CONFIRMATION_REQUIRED') {
        routingImpact.value = result.error.routingImpact ?? []
        pendingRoutingRemoval = (confirmed) => removeOccupiedSlot(slotId, expectedAgentId, agentAction, repository, confirmed)
      }
      lifecycle.operationStatus = 'error'
      lifecycle.error = result.error
      return false
    }
    routingImpact.value = []
    pendingRoutingRemoval = null
    acceptServerAggregate(result.value.journey)
    if (result.value.template) {
      agentTemplates.value = [
        ...agentTemplates.value.filter((template) => template.id !== result.value.template?.id),
        structuredClone(result.value.template),
      ]
    }
    session.selectedSlotId = null
    reconcileSession()
    lifecycle.operationStatus = 'success'
    cancelInteraction()
    return true
  }

  async function dispatchDrop(repository: AgentLifecycleRepository, idFactory: Pick<PatternIdFactory, 'routeId'>) {
    if (lifecycle.operationStatus === 'loading' || session.interaction.type !== 'dragging' || !session.interaction.over || !document.value) return false
    const evaluation = evaluatePatternDrop(session.interaction.payload, session.interaction.over, document.value.pattern)
    if (evaluation.status !== 'valid') {
      session.lastDropError = evaluation.reason
      cancelInteraction()
      return false
    }
    const action = evaluation.action
    switch (action.type) {
      case 'instantiate-agent-template': return instantiateTemplate(action.templateId, action.targetSlotId, repository)
      case 'move-agent': {
        const ok = moveAgent(action.sourceSlotId, action.targetSlotId)?.ok ?? false
        cancelInteraction(); return ok
      }
      case 'exchange-agents': {
        const ok = exchangeAgents(action.sourceSlotId, action.targetSlotId)?.ok ?? false
        cancelInteraction(); return ok
      }
      case 'reorder-slot': {
        const ok = reorderSlot(action.slotId, action.targetOrder, idFactory)?.ok ?? false
        cancelInteraction(); return ok
      }
    }
  }

  function toSaveInput(): SaveJourneyInput | null {
    const current = document.value
    return current ? {
      journeyId: current.journey.id,
      expectedRevision: current.journey.revision,
      pattern: structuredClone(toRaw(current.pattern)),
    } : null
  }

  async function save(repository?: JourneyEditorRepository, confirmation?: RoutingConfirmation): Promise<boolean> {
    if (repository) activeRepository = repository
    return autosaveCoordinator.run(async () => {
      const current = document.value
      const state = persistenceState.value
      const targetRepository = activeRepository
      if (!current || !state || !targetRepository) return false
      const request = ++saveRequestSeq
      const savingState = beginPersistenceSave(state, request)
      if (!savingState) return false
      const snapshot: SaveJourneyInput = {
        journeyId: current.journey.id,
        expectedRevision: state.serverRevision,
        pattern: structuredClone(toRaw(current.pattern)),
        ...(confirmation ? { routingConfirmation: confirmation } : {}),
      }
      const controller = new AbortController()
      saveController = controller
      persistenceState.value = savingState
      const result = await targetRepository.saveJourney(snapshot, { signal: controller.signal })
      const latestState = persistenceState.value
      if (controller.signal.aborted || !latestState || !document.value) return false
      if (!result.ok) {
        if (result.error.code === 'STATE_CONFLICT' && result.error.reason === 'END_ROUTING_CONFIRMATION_REQUIRED') {
          routingImpact.value = result.error.routingImpact ?? []
        }
        persistenceState.value = applyPersistenceFailure(latestState, request, result.error)
        return false
      }
      routingImpact.value = []
      if (result.value.document) {
        document.value.agents = structuredClone(result.value.document.agents)
        closeWorkflowPreview()
      }
      document.value.journey.revision = result.value.revision
      document.value.journey.updatedAt = result.value.updatedAt
      persistenceState.value = applyPersistenceSuccess(latestState, request, result.value.revision, Date.now())
      if (persistenceState.value.type === 'dirty') scheduleAutosave(0)
      if (saveController === controller) saveController = null
      return true
    })
  }

  async function flushLocalChanges(): Promise<boolean> {
    const state = persistenceState.value
    if (!state || state.type === 'clean') return true
    if (state.type === 'conflict') return false
    if (state.type === 'saving') return autosaveCoordinator.inFlight ?? false
    return save()
  }

  async function confirmRoutingChanges(): Promise<boolean> {
    if (!routingImpact.value.length) return false
    const confirmation = routingImpact.value.map(({ agentId, revision, removedEndIds, removedEdgeIds }) => ({ agentId, revision, removedEndIds, removedEdgeIds }))
    return pendingRoutingRemoval ? pendingRoutingRemoval(confirmation) : save(undefined, confirmation)
  }

  async function cancelRoutingChanges(): Promise<void> {
    const current = document.value
    if (!current || !activeRepository) return
    await load(current.journey.id, session.activeTab, activeRepository)
  }

  async function retrySave(): Promise<boolean> { return save() }

  async function reloadAfterConflict(): Promise<boolean> {
    const current = document.value
    const repository = activeRepository
    if (!current || !repository || persistenceState.value?.type !== 'conflict') return false
    await load(current.journey.id, session.activeTab, repository)
    return loadState.status === 'ready'
  }

  async function overwriteAfterConflict(): Promise<boolean> {
    const current = document.value
    const repository = activeRepository
    const state = persistenceState.value
    if (!current || !repository || state?.type !== 'conflict') return false
    const result = await repository.loadJourney(current.journey.id)
    if (!result.ok || !document.value || persistenceState.value?.type !== 'conflict') return false
    const prepared = preparePersistenceConflictOverwrite(persistenceState.value, result.value.journey.revision, Date.now())
    if (!prepared) return false
    document.value.journey.revision = result.value.journey.revision
    document.value.journey.updatedAt = result.value.journey.updatedAt
    persistenceState.value = prepared
    return save()
  }

  function dispose() {
    activeRequest += 1
    saveRequestSeq += 1
    autosaveCoordinator.dispose()
    invalidateLifecycleRequests()
    loadController?.abort()
    saveController?.abort()
    loadController = null
    saveController = null
    activeRepository = null
    document.value = null
    resetSession()
    agentTemplates.value = []
    resetLifecycle()
    loadState.status = 'idle'
    loadState.error = null
    persistenceState.value = null
  }

  return {
    document,
    agentTemplates,
    previewDocument,
    previewState,
    session,
    persistence,
    persistenceState,
    templateExitMapping, confirmTemplateExitMapping, cancelTemplateExitMapping,
    routingImpact, confirmRoutingChanges, cancelRoutingChanges, setHubSpokeDirection,
    lifecycle,
    guardrailOperation,
    isReady,
    hasUnsavedChanges,
    load,
    setActiveTab,
    selectSlot,
    selectSlotForPreview,
    selectGuardrailForPreview,
    openWorkflowPreview,
    closeWorkflowPreview,
    retryWorkflowPreview,
    openMenu,
    openGuardrailMenu,
    stageGuardrailRemoval,
    addGuardrail,
    removeGuardrail,
    stageTemplateName,
    stageSlotRemoval,
    requestSlotRemoval,
    cancelInteraction,
    chooseAgent,
    beginDrag,
    rejectDragBoundary,
    rejectDrop,
    clearInteractionFeedback,
    endDrag,
    evaluateDrag,
    stageDuplicate,
    stageAgentReplacement,
    requestAgentReplacement,
    updateDuplicateName,
    updateDuplicateTarget,
    requestDuplicate,
    loadAgentTemplates,
    createAgent,
    instantiateTemplate,
    saveAsTemplate,
    removeOccupiedSlot,
    dispatchDrop,
    assignAgent,
    moveAgent,
    exchangeAgents,
    unassignAgent,
    unassignAgentAndSave,
    addSlot,
    removeSlot,
    reorderSlot,
    save,
    flushLocalChanges,
    retrySave,
    reloadAfterConflict,
    overwriteAfterConflict,
    toSaveInput,
    dispose,
  }
})
