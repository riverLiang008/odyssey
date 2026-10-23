<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, toRaw, watch } from 'vue'
import { NModal } from 'naive-ui'
import { uuidSchema, type AgentVariable, type BranchNode, type UUID, type WorkflowEdge } from '@odyssey/schemas'
import { branchDraftFromNode, branchSnapshot, branchOperators, emptyBranchCondition, newBranchDraft, parseBranchDraft, unaryBranchOperator, type BranchDraftIssue, type BranchEditIntent, type BranchOperandDraft } from '@/domain/workflow/branchDrafts'
import AppSelect from '@/components/AppSelect.vue'
import BranchOperandField from './BranchOperandField.vue'
import type { BranchPanelSession } from './branchPanelSession'

const props = defineProps<{ node: BranchNode; edges: readonly WorkflowEdge[]; targetNames?: Readonly<Record<string, string>>; variables: readonly AgentVariable[]; readOnly?: boolean; blocked?: boolean; error?: string | null; creating?: boolean; draftCache?: Map<UUID, BranchPanelSession> }>()
const emit = defineEmits<{ dirtyChange: []; close: []; apply: [intent: BranchEditIntent] }>()
const cached = props.draftCache?.get(props.node.id)
const baseline = shallowRef<BranchNode>(cached?.baseline ?? globalThis.structuredClone(toRaw(props.node)))
const baselineEdges = shallowRef<WorkflowEdge[]>(cached?.baselineEdges ?? props.edges.filter(e => e.sourceNodeId === props.node.id).map(e => ({ ...e })))
const draft = ref(cached?.draft ?? (props.creating ? newBranchDraft(props.node, () => globalThis.crypto.randomUUID()) : branchDraftFromNode(props.node)))
const initial = ref(cached?.initial ?? JSON.stringify(draft.value))
const dirty = computed(() => JSON.stringify(draft.value) !== initial.value || Boolean(props.creating))
const issues = ref<BranchDraftIssue[]>([])
const stale = ref(branchSnapshot(baseline.value) !== branchSnapshot(props.node))
const pending = shallowRef<BranchNode | null>(null)
const confirmed = ref<UUID[]>(cached?.confirmed ?? [])
const query = ref('')
// Presentation state follows stable case IDs and never enters the Branch draft.
const collapsedCases = ref(new Set<UUID>())
function toggleCase(caseId: UUID) {
  if (collapsedCases.value.has(caseId)) collapsedCases.value.delete(caseId)
  else collapsedCases.value.add(caseId)
}
const dialog = ref<{ type: 'closed' } | { type: 'discard' } | { type: 'delete'; caseId: UUID }>({ type: 'closed' })
const returnFocus = ref<globalThis.HTMLElement | null>(null)
const addCaseButton = ref<globalThis.HTMLButtonElement | null>(null)
const dragged = ref<UUID | null>(null)
watch(() => [JSON.stringify(draft.value), confirmed.value.length, initial.value], () => {
  if (dirty.value) props.draftCache?.set(props.node.id, { baseline: baseline.value, baselineEdges: baselineEdges.value, draft: draft.value, initial: initial.value, confirmed: confirmed.value })
  else props.draftCache?.delete(props.node.id)
  emit('dirtyChange')
}, { immediate: true, flush: 'sync' })
function discardCache() { props.draftCache?.delete(props.node.id); emit('dirtyChange') }
const disabled = computed(() => Boolean(props.readOnly || props.blocked))
const deletion = computed(() => dialog.value.type === 'delete' ? draft.value.cases.find(c => dialog.value.type === 'delete' && c.id === dialog.value.caseId) : null)
const deletionEdges = computed(() => props.edges.filter(e => e.sourceNodeId === props.node.id && e.sourceHandleId === deletion.value?.id))
const messages = { NAME_REQUIRED: 'Enter a node name.', CASE_NAME_REQUIRED: 'Enter a case name.', CASE_NAME_DUPLICATE: 'Use a unique case name within this Branch.', CONDITION_REQUIRED: 'Add at least one condition.', VARIABLE_UNAVAILABLE: 'Choose an available variable.', VALUE_INVALID: 'Enter a valid value of the selected type.', TYPE_MISMATCH: 'The operands and operator must use compatible types.', CONFIG_INVALID: 'Review the Branch configuration.' }
watch(() => props.node, node => {
  const same = branchSnapshot(node) === branchSnapshot(baseline.value)
  if (same) return
  if (pending.value && branchSnapshot(node) === branchSnapshot(pending.value)) { reset(); return }
  if (dirty.value) stale.value = true
  else reset()
})
function reset() {
  baseline.value = globalThis.structuredClone(toRaw(props.node))
  baselineEdges.value = props.edges.filter(e => e.sourceNodeId === props.node.id).map(e => ({ ...e }))
  draft.value = props.creating ? newBranchDraft(props.node, () => globalThis.crypto.randomUUID()) : branchDraftFromNode(props.node)
  initial.value = JSON.stringify(draft.value)
  confirmed.value = []; issues.value = []; stale.value = false; pending.value = null
}
function addCase() { if (!disabled.value) draft.value.cases.push({ id: uuidSchema.parse(globalThis.crypto.randomUUID()), label: `Case ${draft.value.cases.length + 1}`, conditions: [emptyBranchCondition(uuidSchema.parse(globalThis.crypto.randomUUID()))] }) }
function addCondition(caseId: UUID) { if (!disabled.value) draft.value.cases.find(c => c.id === caseId)?.conditions.push(emptyBranchCondition(uuidSchema.parse(globalThis.crypto.randomUUID()))) }
function move(caseId: UUID, index: number) {
  if (disabled.value || index < 0 || index >= draft.value.cases.length) return
  const current = draft.value.cases.findIndex(c => c.id === caseId)
  if (current < 0) return
  const c = draft.value.cases.splice(current, 1)[0]
  if (c) draft.value.cases.splice(index, 0, c)
}
function updateLeft(caseId: UUID, conditionId: UUID, operand: BranchOperandDraft) {
  const c = draft.value.cases.find(c => c.id === caseId)?.conditions.find(c => c.id === conditionId)
  if (!c || disabled.value) return
  c.left = operand
  const type = operand.kind === 'variable' ? props.variables.find(v => v.id === operand.variableId)?.dataType : operand.kind === 'literal' ? operand.dataType : 'string'
  if (type && c.right.kind === 'literal') c.right = { ...c.right, dataType: type }
}
function requestDialog(value: typeof dialog.value) { returnFocus.value = globalThis.document.activeElement instanceof globalThis.HTMLElement ? globalThis.document.activeElement : null; dialog.value = value }
async function cancelDialog() { dialog.value = { type: 'closed' }; await nextTick(); if (returnFocus.value?.isConnected) returnFocus.value.focus(); else addCaseButton.value?.focus() }
function confirmDialog() {
  if (dialog.value.type === 'discard') { discardCache(); emit('close'); return }
  if (dialog.value.type === 'delete' && !disabled.value) {
    const id = dialog.value.caseId
    draft.value.cases = draft.value.cases.filter(c => c.id !== id)
    confirmed.value.push(id)
  }
  void cancelDialog()
}
function close() { if (dirty.value) requestDialog({ type: 'discard' }); else emit('close') }
function submit() {
  if (disabled.value || stale.value) return
  const parsed = parseBranchDraft(toRaw(draft.value), props.variables)
  if (!parsed.ok) {
    issues.value = parsed.issues
    for (const issue of parsed.issues) if (issue.caseId) collapsedCases.value.delete(issue.caseId)
    return
  }
  issues.value = []; pending.value = parsed.node
  emit('apply', { node: parsed.node, baseline: baseline.value, baselineEdges: baselineEdges.value, confirmedRemovedCaseIds: [...confirmed.value] })
}
function isConnected(id: UUID) { return props.edges.some(e => e.sourceNodeId === props.node.id && e.sourceHandleId === id) }
function conditionIssues(caseId: UUID, conditionId?: UUID) { return issues.value.filter(i => i.caseId === caseId && i.conditionId === conditionId) }
</script>

<template>
  <aside class="workflow-side-panel branch-panel" aria-label="Branch configuration" @keydown.escape.stop.prevent="dialog.type === 'closed' && close()">
    <div class="branch-panel-heading"><h2>Branch</h2><button type="button" aria-label="Close Branch configuration" @click="close">×</button></div>
    <p>Evaluate cases in order. Follow the first match.</p>
    <p v-if="creating" role="status">New Branch draft · Not added to the workflow yet.</p>
    <p v-if="readOnly" role="status">Read-only · Switch to Configure to edit.</p>
    <p v-if="blocked" class="branch-error" role="alert">Resolve the revision conflict before applying changes.</p>
    <p v-if="stale" class="branch-error" role="alert">This Branch changed while you were editing. Your draft is preserved. Reload the latest settings before applying.</p>
    <p v-if="error" class="branch-error" role="alert">{{ error }}</p>
    <form @submit.prevent="submit" @keydown.stop @pointerdown.stop>
      <fieldset :disabled="disabled">
        <label>Name<input v-model="draft.name" aria-label="Branch name" /></label>
        <p v-for="i in issues.filter(i => !i.caseId)" :key="i.code" class="branch-error" role="alert">{{ messages[i.code] }}</p>
        <div class="branch-callout"><strong>One path per run</strong><p>All conditions in a case must match. If none match, follow Default.</p></div>
        <label>Find a variable<input v-model="query" type="search" aria-label="Search Branch variables" placeholder="Search variables by name or type" /></label>
        <p v-if="!variables.length" role="status">No Agent Variables available. Use literal values or create a variable in Agent Variables.</p>
        <p class="branch-section-label">CASES · EVALUATED TOP TO BOTTOM</p>
        <section v-for="(c, index) in draft.cases" :key="c.id" class="branch-case" :data-case-id="c.id" @dragover.prevent.stop @drop.prevent.stop="dragged && move(dragged, index); dragged = null">
          <header><button type="button" class="branch-case-toggle" :aria-label="`${collapsedCases.has(c.id) ? 'Expand' : 'Collapse'} ${c.label}`" :aria-expanded="!collapsedCases.has(c.id)" :aria-controls="`branch-case-${node.id}-${c.id}`" @click="toggleCase(c.id)"><span aria-hidden="true">{{ collapsedCases.has(c.id) ? '▸' : '▾' }}</span></button><button type="button" :draggable="!disabled" :aria-label="`Drag ${c.label} to reorder`" @dragstart.stop="event => { dragged = c.id; event.dataTransfer?.setData('application/x-odyssey-branch-case', c.id) }" @dragend="dragged = null">⠿</button><label>{{ index + 1 }}.<input v-model="c.label" :aria-label="`Case ${index + 1} name`" /></label><button type="button" :disabled="index === 0" :aria-label="`Move ${c.label} up`" @click="move(c.id, index - 1)">↑</button><button type="button" :disabled="index === draft.cases.length - 1" :aria-label="`Move ${c.label} down`" @click="move(c.id, index + 1)">↓</button><button type="button" :aria-label="`Delete ${c.label}`" @click="requestDialog({ type: 'delete', caseId: c.id })">×</button></header>
          <p v-if="collapsedCases.has(c.id)" class="branch-case-summary">{{ c.conditions.length }} {{ c.conditions.length === 1 ? 'condition' : 'conditions' }} · AND · {{ isConnected(c.id) ? 'Connected' : 'Not connected' }}</p>
          <div v-show="!collapsedCases.has(c.id)" :id="`branch-case-${node.id}-${c.id}`" class="branch-case-body">
            <small>Match ALL conditions (AND)</small>
            <p v-if="!creating && !isConnected(c.id)" class="branch-warning">⚠ Not connected · Connect this exit on the canvas.</p>
            <p v-for="i in conditionIssues(c.id)" :key="i.code" class="branch-error" role="alert">{{ messages[i.code] }}</p>
            <div v-for="(condition, conditionIndex) in c.conditions" :key="condition.id" class="branch-condition">
              <div class="branch-condition-heading"><strong>Condition {{ conditionIndex + 1 }}<span v-if="conditionIndex" class="branch-condition-join">AND</span></strong><button type="button" class="branch-remove-condition" :aria-label="`Remove condition ${conditionIndex + 1} from case ${index + 1}`" :title="`Remove condition ${conditionIndex + 1}`" @click="c.conditions = c.conditions.filter(item => item.id !== condition.id)">×</button></div>
              <BranchOperandField :model-value="condition.left" :variables="variables" :search="query" :label="`Case ${index + 1} condition ${conditionIndex + 1} left`" :disabled="disabled" @update:model-value="updateLeft(c.id, condition.id, $event)" />
              <div class="branch-condition-controls"><label>Operator<AppSelect :model-value="condition.operator" :options="branchOperators" :control-label="`Case ${index + 1} condition ${conditionIndex + 1} operator`" @update:model-value="value => { const operator = branchOperators.find(item => item.value === value); if (operator) condition.operator = operator.value }" /></label></div>
              <BranchOperandField v-if="!unaryBranchOperator(condition.operator)" v-model="condition.right" :variables="variables" :search="query" :label="`Case ${index + 1} condition ${conditionIndex + 1} right`" :disabled="disabled" />
              <p v-for="i in conditionIssues(c.id, condition.id)" :key="i.code" class="branch-error" role="alert">{{ messages[i.code] }}</p>
            </div>
            <button type="button" @click="addCondition(c.id)">+ Add condition</button>
          </div>
        </section>
        <button ref="addCaseButton" type="button" class="branch-add-case" @click="addCase">+ Add case</button>
        <section class="branch-callout"><strong>↳ Default · Required</strong><label>Default label<input v-model="draft.defaultCase.label" aria-label="Default label" /></label><p>Runs when no case matches. No conditions.</p><small v-if="!creating && !isConnected(draft.defaultCase.id)" class="branch-warning">⚠ Not connected</small></section>
      </fieldset>
      <p>Connect each exit on the canvas to choose its next step.</p>
      <div class="branch-footer"><p role="status">{{ dirty ? 'Unapplied draft · Other changes may autosave.' : 'Settings applied · Workflow uses autosave.' }}</p><button type="button" :disabled="disabled" @click="reset">Reload settings</button><button type="submit" class="branch-primary" :disabled="disabled || stale">{{ creating ? 'Create Branch' : 'Apply Branch settings' }}</button></div>
    </form>
    <NModal class="branch-confirmation" :show="dialog.type !== 'closed'" preset="dialog" :title="dialog.type === 'discard' ? 'Discard unapplied Branch changes?' : `Delete “${deletion?.label ?? 'case'}”?`" positive-text="Confirm" negative-text="Cancel" :mask-closable="false" @positive-click="confirmDialog" @negative-click="cancelDialog" @close="cancelDialog" @update:show="value => !value && cancelDialog()">
      <p v-if="dialog.type === 'discard'">Your unapplied draft will be discarded.</p>
      <template v-else><p>This removes {{ deletion?.conditions.length ?? 0 }} conditions and {{ deletionEdges.length }} outgoing connections when you apply Branch settings.</p><p v-for="edge in deletionEdges" :key="edge.id">Connection to {{ targetNames?.[edge.targetNodeId] ?? 'next node' }}</p><p>The target nodes stay on the canvas. Other cases keep their connections.</p></template>
    </NModal>
  </aside>
</template>

<style scoped>
.branch-panel { display:flex; flex-direction:column; gap:14px; padding:24px; color:var(--odyssey-text); }
.branch-panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }.branch-panel h2 { margin:0; font-size:20px; }
.branch-panel p { margin:0; color:var(--odyssey-muted); font-size:12px; line-height:1.5; }.branch-panel form,.branch-panel fieldset { display:grid; gap:14px; min-width:0; }.branch-panel fieldset { margin:0; padding:0; border:0; }
.branch-panel label { display:grid; gap:6px; min-width:0; color:var(--odyssey-muted); font-size:11px; }.branch-panel input { width:100%; min-width:0; min-height:38px; padding:8px 10px; border:1px solid var(--odyssey-border); border-radius:8px; color:var(--odyssey-text); background:var(--odyssey-surface); font-size:12px; }
.branch-panel button { min-height:32px; padding:6px 10px; border:1px solid var(--odyssey-border); border-radius:8px; background:var(--odyssey-surface); color:var(--odyssey-accent); cursor:pointer; font-size:12px; }.branch-panel button:disabled { opacity:.45; cursor:default; }.branch-panel :focus-visible { outline:2px solid var(--odyssey-accent); outline-offset:2px; }
.branch-case { display:grid; gap:12px; padding:16px; border:1px solid var(--odyssey-border); border-radius:12px; background:var(--odyssey-surface); min-width:0; }.branch-case + .branch-case { margin-top:12px; }.branch-case header { display:flex; align-items:center; gap:4px; margin:-16px -16px 0; padding:12px 16px; border-bottom:1px solid var(--odyssey-border); border-radius:8px 8px 0 0; background:var(--odyssey-surface); }.branch-case header label { display:flex; align-items:center; flex:1; }.branch-case header button { padding:4px 7px; }.branch-case header input { font-weight:600; }.branch-case small { color:var(--odyssey-muted); font-size:10px; }
.branch-condition { display:grid; gap:10px; padding:12px; border:1px solid var(--odyssey-border); border-radius:8px; background:var(--odyssey-surface); min-width:0; }.branch-condition-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }.branch-condition-heading strong { display:flex; align-items:center; gap:8px; color:var(--odyssey-muted); font-size:11px; font-weight:600; }.branch-condition-join { padding:2px 6px; border:1px solid var(--odyssey-border); border-radius:4px; font-size:10px; }.branch-panel .branch-remove-condition { width:28px; min-height:28px; padding:0; display:grid; place-items:center; background:transparent; color:var(--odyssey-muted); border-color:transparent; }.branch-panel .branch-remove-condition:hover:not(:disabled) { color:var(--odyssey-error); border-color:var(--odyssey-border); background:var(--odyssey-surface); }.branch-condition-controls { display:flex; align-items:end; gap:8px; }.branch-condition-controls label { flex:1; }.branch-callout { display:grid; gap:8px; padding:12px; border:1px solid var(--odyssey-border); background:var(--odyssey-surface); border-radius:8px; font-size:12px; }.branch-section-label { font-size:10px; }.branch-add-case { text-align:left; }.branch-footer { display:flex; flex-wrap:wrap; gap:8px; padding-top:12px; border-top:1px solid var(--odyssey-border); }.branch-footer p { flex-basis:100%; }.branch-primary { background:var(--odyssey-accent) !important; color:var(--odyssey-surface) !important; }
.branch-panel .branch-error { color:var(--odyssey-error); }.branch-panel .branch-warning { color:var(--odyssey-muted); }
.branch-panel :deep(.branch-operand) { display:grid; grid-template-columns:minmax(90px,.7fr) minmax(0,1.3fr); gap:8px; }.branch-panel :deep(.branch-operand label) { display:grid; gap:6px; min-width:0; font-size:10px; color:var(--odyssey-muted); }.branch-panel :deep(.branch-operand input) { width:100%; min-width:0; min-height:38px; padding:8px; border:1px solid var(--odyssey-border); border-radius:8px; background:var(--odyssey-surface); color:var(--odyssey-text); font-size:11px; }.branch-panel :deep(.branch-operand small) { grid-column:1/-1; color:var(--odyssey-error); }
.branch-panel :deep(.app-select__trigger) { min-height:38px; padding:8px 10px; border-radius:8px; background:var(--odyssey-surface); color:var(--odyssey-text); font-size:12px; gap:8px; }
.branch-panel :deep(.app-select__trigger span) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.branch-panel :deep(.app-select__menu) { min-width:100%; max-height:240px; overflow:auto; }
.branch-panel :deep(.app-select__menu button) { font-size:12px; }
.branch-panel :deep(.app-select__trigger:disabled) { opacity:.55; cursor:not-allowed; }
.branch-case-body { display:grid; gap:12px; min-width:0; }
.branch-panel .branch-case-toggle { flex-shrink:0; width:28px; padding:0; color:var(--odyssey-muted); border-color:transparent; background:transparent; }
.branch-panel .branch-case-toggle:hover:not(:disabled) { border-color:var(--odyssey-border); }
.branch-case-summary { padding-top:2px; }
</style>
