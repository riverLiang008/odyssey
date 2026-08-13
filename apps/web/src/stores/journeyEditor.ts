import { computed, reactive, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type {
  JourneyEditorDocument,
  RepositoryError,
  SaveJourneyInput,
  UUID,
} from '@odyssey/schemas'

import type { EditorRepository } from '@/repositories'
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
import type { LoadStatus, SaveStatus } from './editorStatus'

export type { LoadStatus, SaveStatus } from './editorStatus'

export const useJourneyEditorStore = defineStore('journeyEditor', () => {
  const document = ref<JourneyEditorDocument | null>(null)
  const session = reactive({
    activeTab: 'pattern' as JourneyTab,
    selectedSlotId: null as UUID | null,
    previewAgentId: null as UUID | null,
    lastPatternError: null as PatternDomainError | null,
  })
  const persistence = reactive({
    loadStatus: 'idle' as LoadStatus,
    saveStatus: 'idle' as SaveStatus,
    error: null as RepositoryError | null,
    mutationSeq: 0,
  })
  let activeRequest = 0
  let loadController: AbortController | null = null

  const isReady = computed(() => persistence.loadStatus === 'ready' && document.value !== null)

  function resetSession(tab: JourneyTab = 'pattern') {
    session.activeTab = tab
    session.selectedSlotId = null
    session.previewAgentId = null
    session.lastPatternError = null
  }

  async function load(journeyId: UUID, tab: JourneyTab, repository: EditorRepository) {
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    const request = ++activeRequest
    document.value = null
    resetSession(tab)
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
  const addSlot = (label: string, idFactory: Pick<PatternIdFactory, 'slotId' | 'routeId'>) =>
    applyPatternCommand((pattern) => addPatternSlot(pattern, label, idFactory))
  const removeSlot = (slotId: UUID, idFactory: Pick<PatternIdFactory, 'routeId'>) =>
    applyPatternCommand((pattern) => removePatternSlot(pattern, slotId, idFactory))
  const reorderSlot = (slotId: UUID, targetOrder: number, idFactory: Pick<PatternIdFactory, 'routeId'>) =>
    applyPatternCommand((pattern) => reorderPatternSlot(pattern, slotId, targetOrder, idFactory))

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
    loadController?.abort()
    loadController = null
    document.value = null
    resetSession()
    persistence.loadStatus = 'idle'
    persistence.error = null
    persistence.mutationSeq = 0
  }

  return {
    document,
    session,
    persistence,
    isReady,
    load,
    setActiveTab,
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
