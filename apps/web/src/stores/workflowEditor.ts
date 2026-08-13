import { computed, reactive, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type {
  AgentWorkflowEditorDocument,
  RepositoryError,
  SaveAgentWorkflowInput,
  UUID,
} from '@odyssey/schemas'

import type { EditorRepository } from '@/repositories'
import type { LoadStatus, SaveStatus } from './editorStatus'

export type WorkflowMode = 'flow' | 'configure'
export type WorkflowPanel =
  | { type: 'tools' }
  | { type: 'knowledge-spaces' }
  | { type: 'agent-variables' }
  | { type: 'dsl-edit' }
  | { type: 'reusable-tools' }
  | null

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
  const document = ref<AgentWorkflowEditorDocument | null>(null)
  const session = reactive({
    selectedNodeId: null as UUID | null,
    panel: { type: 'tools' } as WorkflowPanel,
    mode: 'flow' as WorkflowMode,
    focusMode: false,
  })
  const persistence = reactive({
    loadStatus: 'idle' as LoadStatus,
    saveStatus: 'idle' as SaveStatus,
    error: null as RepositoryError | null,
  })
  let activeRequest = 0
  let loadController: AbortController | null = null

  const isReady = computed(() => persistence.loadStatus === 'ready' && document.value !== null)

  function resetSession() {
    session.selectedNodeId = null
    session.panel = { type: 'tools' }
    session.mode = 'flow'
    session.focusMode = false
  }

  async function load(journeyId: UUID, agentId: UUID, repository: EditorRepository) {
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    const request = ++activeRequest
    document.value = null
    resetSession()
    persistence.loadStatus = 'loading'
    persistence.error = null

    const journeyResult = await repository.loadJourney(journeyId, { signal: controller.signal })
    if (request !== activeRequest || controller.signal.aborted) return
    if (!journeyResult.ok) {
      persistence.error = journeyResult.error
      persistence.loadStatus = journeyResult.error.code === 'NOT_FOUND' ? 'not-found' : 'error'
      return
    }
    if (!journeyResult.value.agents.some((agent) => agent.id === agentId)) {
      persistence.error = { code: 'NOT_FOUND' }
      persistence.loadStatus = 'not-found'
      return
    }

    const agentResult = await repository.loadAgentWorkflow(journeyId, agentId, { signal: controller.signal })
    if (request !== activeRequest || controller.signal.aborted) return
    if (
      agentResult.ok
      && agentResult.value.agent.journeyId === journeyId
      && agentResult.value.agent.id === agentId
    ) {
      document.value = agentResult.value
      persistence.loadStatus = 'ready'
      return
    }
    persistence.error = agentResult.ok ? { code: 'RESPONSE_INVALID' } : agentResult.error
    persistence.loadStatus = persistence.error.code === 'NOT_FOUND' ? 'not-found' : 'error'
  }

  function setMode(mode: WorkflowMode) { session.mode = mode }
  function setPanel(panel: WorkflowPanel) { session.panel = panel }
  function setFocusMode(enabled: boolean) { session.focusMode = enabled }
  function selectNode(nodeId: UUID | null) { session.selectedNodeId = nodeId }

  function toSaveInput(): SaveAgentWorkflowInput | null {
    const current = document.value
    if (!current) return null
    return createSaveInput(toRaw<AgentWorkflowEditorDocument>(current))
  }

  function dispose() {
    activeRequest += 1
    loadController?.abort()
    loadController = null
    document.value = null
    resetSession()
    persistence.loadStatus = 'idle'
    persistence.error = null
  }

  return {
    document, session, persistence, isReady, load, setMode, setPanel, setFocusMode,
    selectNode, toSaveInput, dispose,
  }
})
