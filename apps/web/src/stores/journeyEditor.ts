import { computed, reactive, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type {
  AgentTemplate,
  JourneyEditorDocument,
  RepositoryError,
  SaveJourneyInput,
  UUID,
} from '@odyssey/schemas'

import type { AgentLifecycleRepository, EditorRepository } from '@/repositories'
import type { JourneyTab } from '@/router/routeContracts'
import {
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
import type { LoadStatus, SaveStatus } from './editorStatus'

export type { LoadStatus, SaveStatus } from './editorStatus'

export const useJourneyEditorStore = defineStore('journeyEditor', () => {
  const document = ref<JourneyEditorDocument | null>(null)
  const session = reactive({
    activeTab: 'pattern' as JourneyTab,
    selectedSlotId: null as UUID | null,
    previewAgentId: null as UUID | null,
    lastPatternError: null as PatternDomainError | null,
    lastDropError: null as PatternDropReason | null,
    lastDragBoundaryError: null as DragPayloadParseErrorCode | null,
    interaction: { type: 'idle' } as PatternInteractionState,
  })
  const agentTemplates = ref<AgentTemplate[]>([])
  const lifecycle = reactive({
    templateStatus: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    operationStatus: 'idle' as 'idle' | 'loading' | 'success' | 'error',
    error: null as RepositoryError | null,
  })
  const persistence = reactive({
    loadStatus: 'idle' as LoadStatus,
    saveStatus: 'idle' as SaveStatus,
    error: null as RepositoryError | null,
    mutationSeq: 0,
  })
  let activeRequest = 0
  let loadController: AbortController | null = null
  let lifecycleRequest = 0
  let lifecycleController: AbortController | null = null
  let templateRequest = 0
  let templateController: AbortController | null = null

  const isReady = computed(() => persistence.loadStatus === 'ready' && document.value !== null)

  function resetSession(tab: JourneyTab = 'pattern') {
    session.activeTab = tab
    session.selectedSlotId = null
    session.previewAgentId = null
    session.lastPatternError = null
    session.lastDropError = null
    session.lastDragBoundaryError = null
    session.interaction = { type: 'idle' }
  }

  function invalidateLifecycleRequests() {
    lifecycleRequest += 1
    templateRequest += 1
    lifecycleController?.abort()
    templateController?.abort()
    lifecycleController = null
    templateController = null
  }

  function resetLifecycle() {
    lifecycle.templateStatus = 'idle'
    lifecycle.operationStatus = 'idle'
    lifecycle.error = null
  }

  async function load(journeyId: UUID, tab: JourneyTab, repository: EditorRepository) {
    loadController?.abort()
    invalidateLifecycleRequests()
    const controller = new AbortController()
    loadController = controller
    const request = ++activeRequest
    document.value = null
    agentTemplates.value = []
    resetSession(tab)
    resetLifecycle()
    persistence.loadStatus = 'loading'
    persistence.error = null
    persistence.mutationSeq = 0

    const result = await repository.loadJourney(journeyId, { signal: controller.signal })
    if (request !== activeRequest || controller.signal.aborted) return
    if (result.ok) {
      document.value = result.value
      persistence.loadStatus = 'ready'
      return
    }
    persistence.error = result.error
    persistence.loadStatus = result.error.code === 'NOT_FOUND' ? 'not-found' : 'error'
  }

  function setActiveTab(tab: JourneyTab) {
    session.activeTab = tab
  }

  function selectSlot(slotId: UUID | null) {
    session.selectedSlotId = slotId && document.value?.pattern.slots.some((slot) => slot.id === slotId)
      ? slotId
      : null
  }

  function openMenu(slotId: UUID, anchor: MenuAnchor) {
    if (!document.value?.pattern.slots.some((slot) => slot.id === slotId)) return
    session.selectedSlotId = slotId
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'open-menu', slotId, anchor })
  }

  function cancelInteraction() {
    session.interaction = transitionPatternInteraction(session.interaction, { type: 'cancel' })
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

  function endDrag() { cancelInteraction() }

  function evaluateDrag(target: PatternDropTarget) {
    if (session.interaction.type !== 'dragging' || !document.value) return null
    const evaluation = evaluatePatternDrop(session.interaction.payload, target, document.value.pattern)
    session.interaction = transitionPatternInteraction(session.interaction, {
      type: 'evaluate-drag', target, feedback: evaluation.feedback,
    })
    session.lastDropError = evaluation.status === 'valid' ? null : evaluation.reason
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
  }

  function applyPatternCommand(command: (pattern: JourneyEditorDocument['pattern']) => PatternCommandResult): PatternCommandResult | null {
    const current = document.value
    if (!current) return null
    const result = command(structuredClone(toRaw(current.pattern)))
    if (!result.ok) {
      session.lastPatternError = result.error
      return result
    }
    current.pattern = structuredClone(result.value)
    session.lastPatternError = null
    persistence.mutationSeq += 1
    reconcileSession()
    return result
  }

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
    document.value = structuredClone(result.value.journey)
    session.selectedSlotId = slotId
    cancelInteraction()
    persistence.mutationSeq += 1
    lifecycle.operationStatus = 'success'
    return result.value.agent.agent.id
  }

  async function instantiateTemplate(templateId: UUID, slotId: UUID, repository: AgentLifecycleRepository) {
    const current = document.value
    if (!current || lifecycle.operationStatus === 'loading') return false
    const controller = new AbortController()
    lifecycleController = controller
    const request = ++lifecycleRequest
    const journeyId = current.journey.id
    lifecycle.operationStatus = 'loading'
    lifecycle.error = null
    cancelInteraction()
    const result = await repository.instantiateAgentTemplate({
      journeyId, slotId, templateId, expectedRevision: current.journey.revision,
    }, { signal: controller.signal })
    if (request !== lifecycleRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      lifecycle.operationStatus = 'error'; lifecycle.error = result.error; return false
    }
    document.value = structuredClone(result.value.journey)
    session.selectedSlotId = slotId
    cancelInteraction()
    persistence.mutationSeq += 1
    lifecycle.operationStatus = 'success'
    return true
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
    const updatedTemplates: AgentTemplate[] = [
      ...agentTemplates.value.filter((template) => template.id !== result.value.id),
      structuredClone(result.value),
    ]
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
  ) {
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
    }, { signal: controller.signal })
    if (request !== lifecycleRequest || controller.signal.aborted || document.value?.journey.id !== journeyId) return false
    if (!result.ok) {
      lifecycle.operationStatus = 'error'
      lifecycle.error = result.error
      return false
    }
    document.value = structuredClone(result.value.journey)
    if (result.value.template) {
      agentTemplates.value = [
        ...agentTemplates.value.filter((template) => template.id !== result.value.template?.id),
        structuredClone(result.value.template),
      ]
    }
    session.selectedSlotId = null
    persistence.mutationSeq += 1
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

  function dispose() {
    activeRequest += 1
    invalidateLifecycleRequests()
    loadController?.abort()
    loadController = null
    document.value = null
    resetSession()
    agentTemplates.value = []
    resetLifecycle()
    persistence.loadStatus = 'idle'
    persistence.error = null
    persistence.mutationSeq = 0
  }

  return {
    document,
    agentTemplates,
    session,
    persistence,
    lifecycle,
    isReady,
    load,
    setActiveTab,
    selectSlot,
    openMenu,
    stageTemplateName,
    stageSlotRemoval,
    requestSlotRemoval,
    cancelInteraction,
    chooseAgent,
    beginDrag,
    rejectDragBoundary,
    rejectDrop,
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
    addSlot,
    removeSlot,
    reorderSlot,
    toSaveInput,
    dispose,
  }
})
