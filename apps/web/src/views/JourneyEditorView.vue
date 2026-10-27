<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { getHubSpokeDirection, uuidSchema, type GuardrailSide, type UUID } from '@odyssey/schemas'

import { useEditorRepository } from '@/app/editorRepository'
import RouteBoundary from '@/app/RouteBoundary.vue'
import { createSystemCanvasViewModel, SYSTEM_PATTERN_BOUNDS, type CanvasBounds } from '@/canvas/system'
import { cryptoPatternIdFactory, nextDefaultSlotLabel } from '@/domain/pattern'
import { routeLocations, journeyTabs, parseJourneyRoute, type JourneyTab } from '@/router/routeContracts'
import { useJourneyEditorStore } from '@/stores/journeyEditor'
import { ODYSSEY_DRAG_MIME, parseOdysseyDragPayload, type OdysseyDragPayloadV1, type PatternDragPayload } from '@/canvas/interaction'
import AgentLibrary from '@/features/journey-editor/AgentLibrary.vue'
import AgentSlotContextMenu from '@/features/journey-editor/AgentSlotContextMenu.vue'
import ExecutionTemplateLibrary from '@/features/journey-editor/ExecutionTemplateLibrary.vue'
import SystemCanvas from '@/features/journey-editor/SystemCanvas.vue'
import TemplateExitMappingDialog from '@/features/journey-editor/TemplateExitMappingDialog.vue'
import RoutingImpactDialog from '@/features/journey-editor/RoutingImpactDialog.vue'
import SaveAgentTemplateDialog from '@/features/journey-editor/SaveAgentTemplateDialog.vue'
import GuardrailContextMenu from '@/features/journey-editor/GuardrailContextMenu.vue'
import WorkflowPreview from '@/features/journey-editor/WorkflowPreview.vue'
import { usePreviewKnowledgeSpaces } from '@/features/journey-editor/usePreviewKnowledgeSpaces'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import RevisionConflictDialog from '@/features/editor-persistence/RevisionConflictDialog.vue'
import UnsavedChangesDialog from '@/features/editor-persistence/UnsavedChangesDialog.vue'

const route = useRoute()
const router = useRouter()
const repository = useEditorRepository()
const readOnly = repository.readOnly === true
const store = useJourneyEditorStore()
const { templateExitMapping, routingImpact, agentTemplates, document, guardrailOperation, lifecycle, persistence, hasUnsavedChanges, previewDocument, previewState, session } = storeToRefs(store)
const { state: previewKnowledge, retry: retryPreviewKnowledge } = usePreviewKnowledgeSpaces(previewDocument, repository)
const patternStageBounds = ref<CanvasBounds>(SYSTEM_PATTERN_BOUNDS)
const identity = computed(() => parseJourneyRoute(route.params.journeyId, route.query.tab))
const canvasModel = computed(() => document.value
  ? createSystemCanvasViewModel(document.value, session.value.selectedSlotId, patternStageBounds.value)
  : null)
const templateMappingTargets = computed(() => templateExitMapping.value?.bindings.map(binding => {
  const target = binding.target
  return { id: target.type === 'slot' ? target.slotId : binding.sourceSlotId,
    name: target.type === 'slot' ? (document.value?.pattern.slots.find(slot => slot.id === target.slotId)?.label ?? 'Unavailable Slot') : 'Complete Journey' }
}) ?? [])
const selectedHubSpoke = computed(() => document.value?.pattern.kind === 'hub_and_spoke'
  ? document.value.pattern.slots.find((slot) => slot.id === session.value.selectedSlotId && slot.topologyRole === 'spoke') : undefined)
const selectedSlot = computed(() => canvasModel.value?.slots.find((slot) => slot.id === session.value.selectedSlotId) ?? null)
const interactionFeedback = computed(() => session.value.interaction.type === 'dragging' ? session.value.interaction.feedback : null)
const isDropForbidden = computed(() => interactionFeedback.value?.tone === 'invalid')
const overSlotId = computed(() => session.value.interaction.type === 'dragging' && session.value.interaction.over?.kind === 'agent-slot'
  ? session.value.interaction.over.slotId : null)
const overOrder = computed(() => session.value.interaction.type === 'dragging' && session.value.interaction.over?.kind === 'linear-order'
  ? session.value.interaction.over.targetOrder : null)
const templateDraft = reactive({ name: '', description: '' })
const duplicateDraft = reactive({ name: '', targetSlotId: '' })
const removalTemplateDraft = reactive({ name: '', description: '' })
const conflictDialogOpen = ref(false)
let interactionToastTimer: ReturnType<typeof globalThis.setTimeout> | null = null
const guardrailPendingSide = computed(() => guardrailOperation.value.type === 'adding' || guardrailOperation.value.type === 'removing'
  ? guardrailOperation.value.side
  : null)
const saveLabel = computed(() => {
  if (readOnly) return 'Read only'
  if (routingImpact.value.length) return 'Review exit changes'
  if (persistence.value.saveStatus === 'saving') return 'Saving…'
  if (persistence.value.saveStatus === 'saved') return 'Saved'
  if (persistence.value.saveStatus === 'error') return 'Save failed'
  if (persistence.value.saveStatus === 'conflict') return 'Conflict'
  return persistence.value.mutationSeq > persistence.value.savedMutationSeq ? 'Unsaved changes' : 'Ready'
})
watch(() => persistence.value.saveStatus, (status) => {
  if (status === 'conflict') conflictDialogOpen.value = true
  else conflictDialogOpen.value = false
})

const interactionToastMessage = computed(() => {
  const error = session.value.lastDropError ?? session.value.lastDragBoundaryError
  if (!error) return null
  if (error === 'SAME_SLOT') return 'This Agent is already in that Slot.'
  return error.replaceAll('_', ' ').toLowerCase().replace(/^./, (character) => character.toUpperCase()) + '.'
})

watch(interactionToastMessage, (message) => {
  if (interactionToastTimer !== null) globalThis.clearTimeout(interactionToastTimer)
  if (!message) return
  interactionToastTimer = globalThis.setTimeout(() => {
    store.clearInteractionFeedback()
    interactionToastTimer = null
  }, 3200)
})

watch(identity, (next) => {
  if (!next) {
    store.dispose()
  } else if (store.document?.journey.id === next.journeyId && store.persistence.loadStatus === 'ready') {
    store.setActiveTab(next.tab)
  } else {
    void store.load(next.journeyId, next.tab, repository).then(() => store.loadAgentTemplates(repository))
  }
}, { immediate: true })
const unsavedChangesGuard = useUnsavedChangesGuard(hasUnsavedChanges, () => store.save(repository))
function keydown(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') store.cancelInteraction() }
onMounted(() => globalThis.document?.addEventListener('keydown', keydown))
onUnmounted(() => {
  globalThis.document?.removeEventListener('keydown', keydown)
  if (interactionToastTimer !== null) globalThis.clearTimeout(interactionToastTimer)
  store.dispose()
})

function selectTab(tab: JourneyTab) {
  const current = identity.value
  if (!current) return
  store.setActiveTab(tab)
  void router.push(routeLocations.journey(current.journeyId, tab))
}

function retry() {
  const current = identity.value
  if (current) void store.load(current.journeyId, current.tab, repository).then(() => store.loadAgentTemplates(repository))
}
function retrySave() { void store.retrySave() }
function reloadServerVersion() {
  conflictDialogOpen.value = false
  void store.reloadAfterConflict()
}
function overwriteServerVersion() {
  conflictDialogOpen.value = false
  void store.overwriteAfterConflict()
}

function beginDrag(payload: PatternDragPayload) {
  if (readOnly) return
 store.beginDrag(payload) }
function dragOverSlot(slotId: UUID) { store.evaluateDrag({ kind: 'agent-slot', slotId }) }
function dragOverOrder(targetOrder: number) {
  if (session.value.interaction.type !== 'dragging') return
  if (session.value.interaction.payload.kind === 'pattern-slot') {
    store.evaluateDrag({ kind: 'linear-order', targetOrder })
    return
  }
  const target = canvasModel.value?.slots.find((slot) => slot.order === targetOrder)
  if (target) dragOverSlot(target.id)
}
function dropOnSlot(payload: PatternDragPayload, slotId: UUID) {
  store.beginDrag(payload)
  store.evaluateDrag({ kind: 'agent-slot', slotId })
  void store.dispatchDrop(repository, cryptoPatternIdFactory)
}

function isPatternPayload(payload: OdysseyDragPayloadV1): payload is PatternDragPayload {
  return payload.kind === 'agent-template'
    || payload.kind === 'assigned-agent' || payload.kind === 'pattern-slot'
}

function dropOnCanvas(event: globalThis.DragEvent) {
  if (readOnly) return

  if (lifecycle.value.operationStatus === 'loading') return
  const parsed = parseOdysseyDragPayload(event.dataTransfer?.getData(ODYSSEY_DRAG_MIME) ?? '')
  if (!parsed.ok) { store.rejectDragBoundary(parsed.error.code); return }
  if (!isPatternPayload(parsed.value)) { store.rejectDrop('TARGET_KIND_UNSUPPORTED'); return }
  store.beginDrag(parsed.value)
  store.evaluateDrag({ kind: 'system-canvas' })
  void store.dispatchDrop(repository, cryptoPatternIdFactory)
}

function dragOverCanvas(event: globalThis.DragEvent) {
  const evaluation = store.evaluateDrag({ kind: 'system-canvas' })
  if (event.dataTransfer) event.dataTransfer.dropEffect = evaluation?.status === 'valid' ? 'move' : 'none'
}

function reorder(slotId: UUID, targetOrder: number) {
  store.beginDrag({ version: 1, kind: 'pattern-slot', slotId })
  store.evaluateDrag({ kind: 'linear-order', targetOrder })
  void store.dispatchDrop(repository, cryptoPatternIdFactory)
}

function dropOrder(payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>, targetOrder: number) {
  store.beginDrag(payload)
  store.evaluateDrag({ kind: 'linear-order', targetOrder })
  void store.dispatchDrop(repository, cryptoPatternIdFactory)
}

function chooseTemplate(templateId: UUID) {
  if (readOnly) return

  if (lifecycle.value.operationStatus === 'loading') return
  if (session.value.interaction.type === 'choosing-agent' && session.value.interaction.mode === 'replace') {
    store.stageAgentReplacement(session.value.interaction.slotId, templateId)
    return
  }
  const slot = selectedSlot.value
  if (slot?.assignment === 'empty') void store.instantiateTemplate(templateId, slot.id, repository)
}

function openMenu(slotId: UUID, anchor: { x: number; y: number }) { store.openMenu(slotId, anchor) }

function resizePatternStage(bounds: CanvasBounds): void {
  if (patternStageBounds.value.width === bounds.width && patternStageBounds.value.height === bounds.height) return
  patternStageBounds.value = bounds
}

function addGuardrail(side: GuardrailSide) {
  if (readOnly) return

  void store.addGuardrail(side, repository)
}

function openGuardrailMenu(side: GuardrailSide, anchor: { x: number; y: number }) {
  store.openGuardrailMenu(side, anchor)
}

async function openGuardrailWorkflow(agentId: UUID) {
  if (!identity.value) return
  store.cancelInteraction()
  await router.push(routeLocations.agentWorkflow(identity.value.journeyId, agentId))
}

function confirmGuardrailRemoval(side: GuardrailSide, agentId: UUID) {
  store.stageGuardrailRemoval(side, agentId)
}

function removeGuardrail() {
  const interaction = session.value.guardrailInteraction
  if (interaction.type !== 'confirming-removal') return
  void store.removeGuardrail(interaction.side, interaction.agentId, repository)
}

async function menuAction(action: 'open' | 'save-template' | 'replace' | 'duplicate' | 'add-before' | 'add-after' | 'move-earlier' | 'move-later' | 'remove-slot' | 'remove', slotId: UUID) {
  if (readOnly && action !== 'open') return
  if (lifecycle.value.operationStatus === 'loading') return
  const agentId = document.value?.pattern.slots.find((slot) => slot.id === slotId)?.agentId
  if (action === 'open' && identity.value) {
    const workflowAgentId = agentId ?? await store.createAgent(slotId, repository)
    if (workflowAgentId) await router.push(routeLocations.agentWorkflow(identity.value.journeyId, workflowAgentId))
  }
  if (action === 'remove') await store.unassignAgentAndSave(slotId, repository)
  if (action === 'save-template') {
    templateDraft.name = ''
    templateDraft.description = ''
    store.stageTemplateName(slotId)
  }
  const slot = canvasModel.value?.slots.find((candidate) => candidate.id === slotId)
  if (action === 'move-earlier' && slot?.order !== null && slot?.order !== undefined) reorder(slotId, slot.order - 1)
  if (action === 'move-later' && slot?.order !== null && slot?.order !== undefined) reorder(slotId, slot.order + 1)
  if ((action === 'add-before' || action === 'add-after') && document.value) {
    const label = nextDefaultSlotLabel(document.value.pattern.slots)
    store.addSlot(label, cryptoPatternIdFactory, { slotId, placement: action === 'add-before' ? 'before' : 'after' })
    store.cancelInteraction()
  }
  if (action === 'remove-slot' && slot) {
    if (slot.assignment === 'configured') {
      removalTemplateDraft.name = ''
      removalTemplateDraft.description = ''
      store.stageSlotRemoval(slotId)
    }
    else { store.removeSlot(slotId, cryptoPatternIdFactory); store.cancelInteraction() }
  }
  if (action === 'replace') {
    store.chooseAgent(slotId, 'replace')
    selectTab('agent')
  }
  if (action === 'duplicate') {
    duplicateDraft.name = ''
    duplicateDraft.targetSlotId = ''
    store.stageDuplicate(slotId)
  }
  if (action === 'remove' || (action === 'open' && agentId)) store.cancelInteraction()
}

function selectSlot(slotId: UUID) {
  const slot = canvasModel.value?.slots.find((candidate) => candidate.id === slotId)
  if (!slot || lifecycle.value.operationStatus === 'loading') return
  void store.selectSlotForPreview(slotId, repository)
}

function selectGuardrail(side: GuardrailSide) {
  void store.selectGuardrailForPreview(side, repository)
}

function retryWorkflowPreview() {
  void store.retryWorkflowPreview(repository)
}

async function openPreviewCanvas() {
  const journeyId = document.value?.journey.id
  const agentId = session.value.previewAgentId
  if (!journeyId || !agentId) return
  store.closeWorkflowPreview()
  await router.push(routeLocations.agentWorkflow(journeyId, agentId))
}

function requestDuplicate() {
  if (!duplicateDraft.name.trim() || !duplicateDraft.targetSlotId) return
  const targetSlotId = uuidSchema.safeParse(duplicateDraft.targetSlotId)
  if (!targetSlotId.success) return
  store.updateDuplicateName(duplicateDraft.name)
  store.updateDuplicateTarget(targetSlotId.data)
  store.requestDuplicate()
}

function removeOccupiedSlot(saveAsTemplate: boolean) {
  if (session.value.interaction.type !== 'confirming-slot-removal') return
  if (saveAsTemplate && !removalTemplateDraft.name.trim()) return
  const { slotId, agentId } = session.value.interaction
  const action = saveAsTemplate
    ? { type: 'save_as_template_and_discard' as const, template: { name: removalTemplateDraft.name.trim(), description: removalTemplateDraft.description.trim() || null } }
    : { type: 'discard' as const }
  void store.removeOccupiedSlot(slotId, agentId, action, repository)
}

async function saveTemplate() {
  const slotId = session.value.interaction.type === 'naming-template' ? session.value.interaction.slotId : null
  const agent = canvasModel.value?.slots.find((slot) => slot.id === slotId)?.agent
  if (!agent || !templateDraft.name.trim()) return
  if (await store.saveAsTemplate(agent.id, templateDraft.name, templateDraft.description.trim() || null, repository)) {
    templateDraft.name = ''; templateDraft.description = ''
  }
}
</script>

<template>
  <section v-if="!identity" class="proof-page"><h1>Invalid Journey</h1><RouterLink to="/journeys">Return to Journeys</RouterLink></section>
  <RouteBoundary v-else-if="persistence.loadStatus !== 'ready'" :status="persistence.loadStatus" subject="Journey" :error="persistence.error" :back-to="routeLocations.journeys()" back-label="Return to Journeys" @retry="retry" />
  <section v-else-if="document && canvasModel" class="editor-page journey-editor-page">
    <nav class="editor-tabs" aria-label="Journey sections">
      <button v-for="tab in journeyTabs" :key="tab" type="button" :class="{ 'is-active': session.activeTab === tab }" @click="selectTab(tab)">{{ tab }}</button>
    </nav>
    <header class="editor-page__heading"><h1>OdyJourney · {{ document.journey.name }}</h1><span role="status">{{ saveLabel }} · Revision {{ document.journey.revision }}</span><button v-if="persistence.saveStatus === 'conflict'" type="button" @click="conflictDialogOpen = true">Resolve conflict</button></header>
    <div v-if="persistence.error && !routingImpact.length && persistence.error.code !== 'REVISION_CONFLICT'" class="journey-feedback" role="alert">
      <span>The Journey could not be saved. Your local pattern is preserved.</span>
      <button type="button" @click="retrySave">Retry save</button>
    </div>
    <div class="journey-editor-layout">
      <AgentLibrary v-if="session.activeTab === 'agent'" :templates="agentTemplates" :loading="lifecycle.templateStatus === 'loading'" :disabled="readOnly || lifecycle.operationStatus === 'loading'" :error="lifecycle.templateStatus === 'error' ? lifecycle.error?.code : null" @choose="chooseTemplate" @drag-start="beginDrag" />
      <ExecutionTemplateLibrary v-else-if="session.activeTab === 'execution'" />
      <aside v-else class="journey-library behavior-coming-soon"><h2>Behavior templates</h2><p>Reusable policy components for your Journey.</p><div class="library-empty"><strong>Coming soon</strong><span>Behavior templates will let you reuse policies and observability rules.</span><small>Planned</small></div></aside>
      <div class="journey-canvas-stack" :class="{ 'is-drop-forbidden': isDropForbidden }" @dragover.prevent="dragOverCanvas" @drop.prevent="dropOnCanvas">
        <SystemCanvas :read-only="readOnly" :model="canvasModel" :input-guardrail="document.inputGuardrail" :output-guardrail="document.outputGuardrail" :agents="document.agents" :guardrail-pending-side="guardrailPendingSide" :disabled="lifecycle.operationStatus === 'loading'" :over-slot-id="overSlotId" :over-order="overOrder" :feedback="interactionFeedback" @select-slot="selectSlot" @open-menu="openMenu" @add-guardrail="addGuardrail" @select-guardrail="selectGuardrail" @open-guardrail-menu="openGuardrailMenu" @resize-pattern-stage="resizePatternStage" @drag-start="beginDrag" @reorder-drag-start="beginDrag" @drag-over-slot="dragOverSlot" @drag-over-order="dragOverOrder" @drop-payload="dropOnSlot" @drop-order-payload="dropOrder" @drop-rejected="store.rejectDragBoundary" @drop-unsupported="store.rejectDrop('TARGET_KIND_UNSUPPORTED')" @drag-end="store.endDrag" @reorder="reorder" />
        <WorkflowPreview
          v-if="previewState.type !== 'closed' && session.previewAgentId"
          :journey="document"
          :agent-id="session.previewAgentId"
          :agent-name="previewDocument?.agent.name ?? document.agents.find((agent) => agent.id === session.previewAgentId)?.name ?? 'Agent'"
          :status="previewState.type"
          :document="previewDocument"
          :knowledge-space-labels="previewKnowledge.labels"
          :knowledge-status="previewKnowledge.type"
          :error="previewState.type === 'error' ? previewState.error : null"
          @close="store.closeWorkflowPreview"
          @retry="retryWorkflowPreview"
          @retry-knowledge="retryPreviewKnowledge"
          @open="openPreviewCanvas"
        />
        <p v-if="lifecycle.operationStatus === 'error'" class="journey-feedback" role="alert">{{ lifecycle.error?.code }}</p>
        <p v-if="guardrailOperation.type === 'failed' || guardrailOperation.type === 'conflict'" class="journey-feedback" role="alert">Guardrail {{ guardrailOperation.operation }} failed: {{ guardrailOperation.error.code }}</p>
      </div>
    </div>
    <Teleport to="body">
      <Transition name="journey-toast">
        <p v-if="interactionToastMessage" class="journey-interaction-toast" role="alert" aria-live="assertive">{{ interactionToastMessage }}</p>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <AgentSlotContextMenu v-if="session.interaction.type === 'menu-open' && lifecycle.operationStatus !== 'loading'" :read-only="readOnly" class="journey-context-menu" :style="{ left: `${session.interaction.anchor.x}px`, top: `${session.interaction.anchor.y}px` }" :hub-direction="selectedHubSpoke ? getHubSpokeDirection(selectedHubSpoke) : undefined" :slot-id="session.interaction.slotId" :configured="selectedSlot?.assignment === 'configured'" :can-add-sibling="selectedSlot?.canAddSibling" :can-remove-slot="selectedSlot?.canRemove" :can-reorder="selectedSlot?.canReorder" :can-move-earlier="(selectedSlot?.order ?? 0) > 0" :can-move-later="selectedSlot?.order !== null && selectedSlot?.order !== undefined && selectedSlot.order < canvasModel.slots.length - 1" @direction="(slotId, direction) => { store.setHubSpokeDirection(slotId, direction, cryptoPatternIdFactory); store.cancelInteraction() }" @action="menuAction" @close="store.cancelInteraction" />
      <GuardrailContextMenu v-if="session.guardrailInteraction.type === 'menu-open'" class="journey-context-menu" :style="{ position: 'fixed', left: `${session.guardrailInteraction.anchor.x}px`, top: `${session.guardrailInteraction.anchor.y}px` }" :side="session.guardrailInteraction.side" :agent-id="session.guardrailInteraction.agentId" @open="openGuardrailWorkflow" @remove="confirmGuardrailRemoval" @close="store.cancelInteraction" />
    </Teleport>
    <SaveAgentTemplateDialog v-if="session.interaction.type === 'naming-template'" :loading="lifecycle.operationStatus === 'loading'" :error="lifecycle.operationStatus === 'error' ? lifecycle.error?.code : null" @submit="(name, description) => { templateDraft.name = name; templateDraft.description = description ?? ''; void saveTemplate() }" @close="store.cancelInteraction" />
    <div v-if="session.interaction.type === 'confirming-slot-removal'" class="journey-dialog-backdrop">
      <section class="journey-staged-dialog journey-slot-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-slot-title">
        <header class="journey-slot-removal-dialog__header">
          <span class="journey-slot-removal-dialog__icon" aria-hidden="true">!</span>
          <div><h2 id="remove-slot-title">Remove occupied Slot?</h2><p>The Slot and its Agent will be removed atomically.</p></div>
        </header>
        <div class="journey-slot-removal-dialog__template">
          <strong>Save Agent as a Template first</strong>
          <span>Optional · preserve this Agent for reuse before removing the Slot.</span>
          <label>Template name<input v-model="removalTemplateDraft.name" aria-label="Template name before removal" placeholder="e.g. Research reviewer"></label>
          <label>Description <small>Optional</small><textarea v-model="removalTemplateDraft.description" aria-label="Template description before removal" placeholder="Describe when this Agent should be reused" /></label>
        </div>
        <footer class="journey-slot-removal-dialog__actions">
          <button class="is-quiet" :disabled="lifecycle.operationStatus === 'loading'" @click="store.cancelInteraction">Cancel</button>
          <button class="is-secondary" :disabled="!removalTemplateDraft.name.trim() || lifecycle.operationStatus === 'loading'" @click="removeOccupiedSlot(true)">Save Template and remove</button>
          <button class="is-danger" :disabled="lifecycle.operationStatus === 'loading'" @click="removeOccupiedSlot(false)">Discard Agent and Slot</button>
        </footer>
      </section>
    </div>
    <div v-if="session.guardrailInteraction.type === 'confirming-removal'" class="journey-dialog-backdrop">
      <section class="journey-staged-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-guardrail-title">
        <h2 id="remove-guardrail-title">Remove {{ session.guardrailInteraction.side }} Guardrail?</h2>
        <p>This permanently deletes its Agent and Workflow. The Guardrail will return to its optional inactive state.</p>
        <button :disabled="guardrailOperation.type === 'removing'" @click="removeGuardrail">Remove guardrail</button>
        <button :disabled="guardrailOperation.type === 'removing'" @click="store.cancelInteraction">Cancel</button>
      </section>
    </div>
    <section v-if="session.interaction.type === 'confirming-agent-replacement'" class="journey-staged-dialog" role="dialog" aria-modal="true" aria-labelledby="agent-replace-title">
      <h2 id="agent-replace-title">Replace Agent?</h2><p>Confirmation stages the selected Template and occupied Slot for an atomic replacement transaction.</p><button @click="store.requestAgentReplacement">Continue</button><button @click="store.cancelInteraction">Cancel</button>
    </section>
    <section v-if="session.interaction.type === 'naming-duplicate'" class="journey-staged-dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
      <h2 id="duplicate-title">Duplicate Agent</h2><p>Choose a destination and name for the typed atomic duplication request.</p>
      <input v-model="duplicateDraft.name" aria-label="Duplicate Agent name" placeholder="Agent name">
      <select v-model="duplicateDraft.targetSlotId" aria-label="Duplicate destination Slot"><option value="">Choose empty Slot</option><option v-for="slot in canvasModel.slots.filter((candidate) => candidate.assignment === 'empty')" :key="slot.id" :value="slot.id">{{ slot.label }}</option></select>
      <button :disabled="!duplicateDraft.name.trim() || !duplicateDraft.targetSlotId" @click="requestDuplicate">Continue</button><button @click="store.cancelInteraction">Cancel</button>
    </section>
    <section v-if="session.interaction.type === 'agent-replacement-requested' || session.interaction.type === 'duplicate-requested' || session.interaction.type === 'slot-removal-requested'" class="journey-staged-dialog" role="status">
      <h2>Transaction request ready</h2><p>The canonical document is unchanged. A future trusted transaction boundary can consume this typed request.</p><button @click="store.cancelInteraction">Close</button>
    </section>
    <TemplateExitMappingDialog v-if="templateExitMapping" :sources="templateExitMapping.sources" :targets="templateMappingTargets" :busy="lifecycle.operationStatus === 'loading'" :error="lifecycle.error?.code" @confirm="store.confirmTemplateExitMapping" @cancel="store.cancelTemplateExitMapping" />
    <RoutingImpactDialog v-if="routingImpact.length" :impact="routingImpact" :agents="document.agents" :busy="persistence.saveStatus === 'saving' || lifecycle.operationStatus === 'loading'" @confirm="store.confirmRoutingChanges" @cancel="store.cancelRoutingChanges" />
    <RevisionConflictDialog v-if="conflictDialogOpen" subject="Journey" @stay="conflictDialogOpen = false" @reload="reloadServerVersion" @overwrite="overwriteServerVersion" />
    <UnsavedChangesDialog v-if="unsavedChangesGuard.confirmationOpen.value" @stay="unsavedChangesGuard.stay" @leave="unsavedChangesGuard.leave" />
  </section>
</template>
