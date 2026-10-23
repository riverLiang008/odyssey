<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { AgentWorkflowExportDocument, UUID } from '@odyssey/schemas'

import { parseWorkflowImportJson, type WorkflowImportErrorCode, type WorkflowImportIssue, type WorkflowImportSummary } from '@/domain/workflow-import/workflowImport'
import EndMappingFields from './EndMappingFields.vue'
import type { ImportEndMapping } from '@/domain/workflow-import/importEndBindings'
import { readWorkflowImportFile, type WorkflowImportFileErrorCode } from './workflowImportFileAdapter'

type ImportState =
  | { readonly type: 'empty' }
  | { readonly type: 'reading'; readonly fileName: string }
  | { readonly type: 'invalid'; readonly fileName: string; readonly code: WorkflowImportFileErrorCode | WorkflowImportErrorCode; readonly issues: readonly WorkflowImportIssue[] }
  | { readonly type: 'ready'; readonly fileName: string; readonly candidate: AgentWorkflowExportDocument; readonly summary: WorkflowImportSummary }

const props = defineProps<{
  targetEnds?: readonly { id: UUID; name: string }[]
  availableKnowledgeSpaceIds: ReadonlySet<string>
  saveStatus: string
  applyError: string | null
}>()
const emit = defineEmits<{ close: []; apply: [candidate: AgentWorkflowExportDocument, mapping?: ImportEndMapping[]] }>()

const dialog = ref<globalThis.HTMLElement | null>(null)
const fileInput = ref<globalThis.HTMLInputElement | null>(null)
const cancelButton = ref<globalThis.HTMLButtonElement | null>(null)
const state = shallowRef<ImportState>({ type: 'empty' })
const readSequence = ref(0)
const endMapping = ref<ImportEndMapping[] | null>(null)
const sourceEnds = computed(() => state.value.type === 'ready' ? state.value.candidate.workflow.nodes.filter((node) => node.type === 'end').map((node) => ({ id: node.id, name: `${node.name} · ${node.id.slice(-6)}` })) : [])
const requiresMapping = computed(() => (props.targetEnds?.length ?? 0) > 1)
const returnTarget = globalThis.document?.activeElement as globalThis.HTMLElement | null
const isBlocked = computed(() => props.saveStatus === 'saving' || props.saveStatus === 'conflict')
const blockMessage = computed(() => props.saveStatus === 'saving'
  ? 'Wait for the current save to finish before replacing this workflow.'
  : props.saveStatus === 'conflict'
    ? 'Resolve the revision conflict before importing a workflow.'
    : null)

const errorCopy: Record<WorkflowImportFileErrorCode | WorkflowImportErrorCode, string> = {
  FILE_TYPE_UNSUPPORTED: 'Choose a .json workflow export file.',
  FILE_TOO_LARGE: 'The file is larger than the 5 MiB import limit.',
  FILE_READ_FAILED: 'The file could not be read. Choose it again.',
  JSON_INVALID: 'The file does not contain valid JSON.',
  EXPORT_SCHEMA_INVALID: 'This is not a supported Odyssey workflow export.',
  WORKFLOW_INVALID: 'The workflow structure or one of its references is invalid.',
  REFERENCE_MISSING: 'One or more referenced Knowledge Spaces are unavailable in this workspace.',
}

async function selectFile(event: globalThis.Event) {
  const input = event.target as globalThis.HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  endMapping.value = null
  const sequence = ++readSequence.value
  state.value = { type: 'reading', fileName: file.name }
  const read = await readWorkflowImportFile(file)
  if (sequence !== readSequence.value) return
  if (!read.ok) {
    state.value = { type: 'invalid', fileName: file.name, code: read.error.code, issues: [] }
    return
  }
  const parsed = parseWorkflowImportJson(read.value.contents, { availableKnowledgeSpaceIds: props.availableKnowledgeSpaceIds })
  if (!parsed.ok) {
    state.value = { type: 'invalid', fileName: read.value.fileName, code: parsed.error.code, issues: parsed.error.issues }
    return
  }
  state.value = { type: 'ready', fileName: read.value.fileName, candidate: parsed.value.document, summary: parsed.summary }
}

function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') { emit('close'); return }
  if (event.key !== 'Tab') return
  const controls = [...(dialog.value?.querySelectorAll<globalThis.HTMLElement>('button:not(:disabled),input:not(:disabled)') ?? [])]
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || !last) return
  if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus() }
}

onMounted(() => {
  globalThis.window.addEventListener('keydown', keydown)
  cancelButton.value?.focus()
})
onBeforeUnmount(() => {
  readSequence.value += 1
  globalThis.window.removeEventListener('keydown', keydown)
  returnTarget?.focus()
})

function chooseAnotherFile() {
  fileInput.value?.click()
}

function confirmImport() {
  if (state.value.type !== 'ready' || isBlocked.value) return
  if (requiresMapping.value && !endMapping.value) return
  if (endMapping.value) emit('apply', state.value.candidate, endMapping.value)
  else emit('apply', state.value.candidate)
  void nextTick(() => cancelButton.value?.focus())
}
</script>

<template>
  <Teleport to="body">
    <div class="workflow-import-backdrop">
      <section ref="dialog" class="workflow-import-dialog" role="dialog" aria-modal="true" aria-labelledby="workflow-import-title">
        <header>
          <div>
            <p>WORKFLOW TOOLS</p>
            <h2 id="workflow-import-title">Import workflow JSON</h2>
          </div>
          <button ref="cancelButton" type="button" aria-label="Close import dialog" @click="emit('close')">×</button>
        </header>

        <input ref="fileInput" class="workflow-import-file-input" type="file" accept=".json,application/json" @change="selectFile">

        <button v-if="state.type === 'empty'" type="button" class="workflow-import-picker" @click="chooseAnotherFile">
          <strong>Choose workflow JSON</strong>
          <small>Odyssey export · maximum 5 MiB</small>
        </button>
        <div v-else-if="state.type === 'reading'" class="workflow-import-status" role="status">
          <strong>Reading and validating…</strong><small>{{ state.fileName }}</small>
        </div>
        <div v-else-if="state.type === 'invalid'" class="workflow-import-status is-error" role="alert">
          <strong>{{ errorCopy[state.code] }}</strong>
          <small>{{ state.fileName }}</small>
          <ul v-if="state.issues.length">
            <li v-for="(issue, index) in state.issues.slice(0, 4)" :key="`${issue.code}-${index}`">{{ issue.code }}</li>
          </ul>
          <button type="button" @click="chooseAnotherFile">Choose another file</button>
        </div>
        <div v-else class="workflow-import-preview">
          <div class="workflow-import-file-row"><strong>{{ state.fileName }}</strong><button type="button" @click="chooseAnotherFile">Replace file</button></div>
          <dl>
            <div><dt>Source Agent</dt><dd>{{ state.summary.sourceAgentName }}</dd></div>
            <div><dt>Root graph</dt><dd>{{ state.summary.rootNodeCount }} nodes · {{ state.summary.rootEdgeCount }} edges</dd></div>
            <div><dt>Nested Loops</dt><dd>{{ state.summary.loopCount }}</dd></div>
            <div><dt>Variables</dt><dd>{{ state.summary.variableCount }}</dd></div>
            <div><dt>Reusable Tools</dt><dd>{{ state.summary.reusableToolCount }}</dd></div>
            <div><dt>Knowledge Spaces</dt><dd>{{ state.summary.knowledgeSpaceCount }}</dd></div>
          </dl>
          <EndMappingFields v-if="requiresMapping && targetEnds" :key="state.fileName" :sources="sourceEnds" :targets="targetEnds" @update="endMapping = $event" />
          <p class="workflow-import-warning"><strong>This will replace the current workflow configuration.</strong> The current Agent identity is preserved. Workflow JSON may contain configured values; review it before sharing.</p>
        </div>

        <p v-if="blockMessage" class="workflow-import-block" role="alert">{{ blockMessage }}</p>
        <p v-if="applyError" class="workflow-import-block" role="alert">Import could not be applied: {{ applyError.replaceAll('_', ' ').toLowerCase() }}.</p>

        <footer>
          <button type="button" @click="emit('close')">Cancel</button>
          <button type="button" class="is-danger" :disabled="state.type !== 'ready' || isBlocked || (requiresMapping && !endMapping)" @click="confirmImport">Import and replace</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.workflow-import-backdrop { position:fixed; inset:0; z-index:1400; display:grid; place-items:center; padding:24px; background:rgb(15 28 51 / 38%); }
.workflow-import-dialog { width:min(620px,100%); max-height:calc(100dvh - 48px); overflow:auto; box-sizing:border-box; padding:26px; border:1px solid #d2dced; border-radius:18px; background:#fff; box-shadow:0 24px 70px rgb(15 28 51 / 24%); color:#172033; }
.workflow-import-dialog header,.workflow-import-dialog footer,.workflow-import-file-row { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.workflow-import-dialog header p { margin:0 0 7px; color:#69758c; font-size:10px; font-weight:700; letter-spacing:.12em; }
.workflow-import-dialog h2 { margin:0; font-size:24px; }
.workflow-import-dialog header>button { border:0; background:transparent; color:#69758c; font-size:26px; cursor:pointer; }
.workflow-import-file-input { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.workflow-import-picker,.workflow-import-status,.workflow-import-preview { width:100%; margin-top:22px; box-sizing:border-box; border:1px dashed #b9c8e2; border-radius:12px; padding:22px; background:#f8faff; }
.workflow-import-picker { display:grid; gap:5px; color:#365dcc; font:inherit; text-align:center; cursor:pointer; }
.workflow-import-picker small,.workflow-import-status small { color:#69758c; font-size:10px; }
.workflow-import-picker:focus-visible { outline:3px solid rgb(75 113 255 / 25%); outline-offset:2px; }
.workflow-import-status { display:grid; gap:6px; }
.workflow-import-status.is-error { border-color:#efb4b9; background:#fff7f7; color:#a83d45; }
.workflow-import-status ul { margin:6px 0 0; padding-left:18px; font-size:10px; }
.workflow-import-status button,.workflow-import-file-row button { justify-self:start; border:0; padding:4px 0; background:transparent; color:#365dcc; font:inherit; font-size:10px; cursor:pointer; }
.workflow-import-preview { border-style:solid; }
.workflow-import-file-row { padding-bottom:15px; border-bottom:1px solid #e1e7f0; }
.workflow-import-preview dl { margin:17px 0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 20px; }
.workflow-import-preview dl div { min-width:0; }
.workflow-import-preview dt { color:#69758c; font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.workflow-import-preview dd { margin:5px 0 0; overflow-wrap:anywhere; font-size:12px; }
.workflow-import-warning,.workflow-import-block { margin:14px 0 0; padding:12px; border-radius:9px; background:#fff8e8; color:#765b19; font-size:10px; line-height:1.55; }
.workflow-import-warning strong { display:block; color:#4b3b14; }
.workflow-import-block { background:#fff1f2; color:#a83d45; }
.workflow-import-dialog footer { justify-content:flex-end; margin-top:22px; }
.workflow-import-dialog footer button { min-height:40px; padding:0 15px; border:1px solid #cbd7eb; border-radius:9px; background:#fff; color:#172033; font:inherit; cursor:pointer; }
.workflow-import-dialog footer .is-danger { border-color:#efb4b9; background:#fff1f2; color:#b43c47; }
.workflow-import-dialog footer button:disabled { opacity:.45; cursor:not-allowed; }
@media (max-width:640px) { .workflow-import-preview dl { grid-template-columns:1fr; }.workflow-import-dialog footer { align-items:stretch; flex-direction:column; } }
</style>
