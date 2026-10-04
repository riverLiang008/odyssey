<script setup lang="ts">
import { colors, radii } from '@odyssey/design-tokens'
import { computed, shallowReactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { toolStepSchema, uuidSchema, type AgentVariable, type KnowledgeSpaceSummary, type ToolStep, type ValueSource, type TaskNode } from '@odyssey/schemas'
import type { SystemToolDraft } from '@/stores/workflowEditor'
import { toolVariables } from '@/domain/workflow/systemToolCommands'
import outputArrow from '@/assets/tool-output-arrow.svg'
import ToolValueInput from './ToolValueInput.vue'
const props = defineProps<{ draft: NonNullable<SystemToolDraft>; task: TaskNode; variables: readonly AgentVariable[]; knowledgeSpaces: readonly KnowledgeSpaceSummary[]; knowledgeStatus: 'loading' | 'ready' | 'error'; error: string | null }>()
const emit = defineEmits<{ save: [step: ToolStep]; cancel: [] }>()
const firstInput = ref<globalThis.HTMLInputElement | null>(null)
const returnFocus = globalThis.document.activeElement
onMounted(() => firstInput.value?.focus())
onBeforeUnmount(() => { if (returnFocus instanceof globalThis.HTMLElement && returnFocus.isConnected) returnFocus.focus() })
const existing = props.draft.step
const kind = props.draft.kind
const newId = () => uuidSchema.parse(globalThis.crypto.randomUUID())
const literal = (value = ''): ValueSource => ({ kind: 'literal', value })
const form = shallowReactive({
  label: existing?.label ?? '', failure: existing?.failureBehavior.kind ?? 'fail_task',
  output: existing?.outputMapping?.targetVariableId ?? '',
  knowledgeSpaceId: existing?.kind === 'knowledge_retrieval' ? existing.configuration.knowledgeSpaceId : '',
  query: existing?.kind === 'knowledge_retrieval' ? existing.configuration.query : literal(),
  topK: existing?.kind === 'knowledge_retrieval' ? existing.configuration.topK ?? 5 : 5,
  language: existing?.kind === 'script_execution' ? existing.configuration.language : 'python',
  script: existing?.kind === 'script_execution' ? existing.configuration.script : '',
  inputs: existing?.kind === 'script_execution' ? existing.configuration.inputs ?? [] : [],
  method: existing?.kind === 'api_request' ? existing.configuration.method : 'GET',
  url: existing?.kind === 'api_request' ? existing.configuration.url : literal(),
  headers: existing?.kind === 'api_request' ? existing.configuration.headers : [],
  body: existing?.kind === 'api_request' ? existing.configuration.body : { kind: 'none' as const },
  target: existing?.kind === 'set_variable' ? existing.configuration.targetVariableId : '',
  operation: existing?.kind === 'set_variable' ? existing.configuration.operation : 'assign',
  value: existing?.kind === 'set_variable' && 'value' in existing.configuration ? existing.configuration.value : literal(),
  model: existing?.kind === 'llm_call' ? existing.configuration.model : '',
  systemPrompt: existing?.kind === 'llm_call' ? existing.configuration.systemPrompt ?? literal() : literal(),
  prompt: existing?.kind === 'llm_call' ? existing.configuration.prompt : literal(),
})
const validationError = ref('')
const variables = computed(() => toolVariables(props.task, props.variables))
const writable = computed(() => variables.value.filter((v) => v.writable))
const spaces = computed(() => props.knowledgeSpaces.filter((s) => ['ready', 'syncing'].includes(s.lifecycleStatus) && ['healthy', 'needs_review'].includes(s.graphStatus)))
const title = { knowledge_retrieval: 'Knowledge Retrieval', script_execution: 'Script Execution', api_request: 'API Request', set_variable: 'Set Variable', llm_call: 'LLM Call' }[kind]
const outputKeys = { knowledge_retrieval: 'retrieved_documents', script_execution: 'result', api_request: 'response.data', set_variable: '', llm_call: 'response.text' }
function setBody(event: globalThis.Event) {
  if (!(event.target instanceof globalThis.HTMLSelectElement)) return
  form.body = event.target.value === 'json' ? { kind: 'json', value: literal() } : event.target.value === 'form_data' ? { kind: 'form_data', entries: [] } : { kind: 'none' }
}
function addInput() {
  const first = variables.value[0]
  if (first) form.inputs = [...form.inputs, { alias: `input_${form.inputs.length + 1}`, variableId: first.id }]
}
function submit() {
  const base = { id: existing?.id ?? newId(), kind, label: form.label.trim() || null, failureBehavior: form.failure === 'retry' ? { kind: 'retry', maxAttempts: 2 } : { kind: 'fail_task' }, outputMapping: kind === 'set_variable' ? null : { sourceKey: outputKeys[kind], targetVariableId: form.output } }
  const configuration = kind === 'knowledge_retrieval' ? { knowledgeSpaceId: form.knowledgeSpaceId, query: form.query, topK: form.topK }
    : kind === 'script_execution' ? { language: form.language, inputs: form.inputs, script: form.script }
    : kind === 'api_request' ? { method: form.method, url: form.url, headers: form.headers, body: form.body }
    : kind === 'set_variable' ? { targetVariableId: form.target, operation: form.operation, ...(form.operation === 'toggle' ? {} : { value: form.value }) }
    : { model: form.model, systemPrompt: form.systemPrompt, prompt: form.prompt }
  const parsed = toolStepSchema.safeParse({ ...base, configuration })
  if (!parsed.success) { validationError.value = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '); return }
  validationError.value = ''
  emit('save', parsed.data)
}
</script>
<template>
  <aside class="workflow-resource-browser system-tool-panel" :style="{ '--tool-border': colors.border, '--tool-surface': colors.surface, '--tool-muted': colors.muted, '--tool-primary': colors.primary, '--tool-soft': colors.primarySoft, '--tool-ink': colors.ink, '--tool-radius': radii.sm }" aria-label="System Tool configuration" @keydown.esc.stop="emit('cancel')">
    <header><button type="button" aria-label="Back to System Tools" @click="emit('cancel')">‹</button><h2>{{ title }}</h2><button type="button" aria-label="Close Tool configuration" @click="emit('cancel')">×</button></header>
    <p class="inspector-note">Built-in Tool · Task configuration</p>
    <form class="system-tool-form" @submit.prevent="submit">
      <label>Label · optional<input ref="firstInput" v-model="form.label" /></label>
      <h3>CONFIGURATION</h3>
      <template v-if="kind === 'knowledge_retrieval'">
        <label>Knowledge Space *<select v-model="form.knowledgeSpaceId" required><option value="" disabled>Choose a Knowledge Space</option><option v-for="space in spaces" :key="space.id" :value="space.id">{{ space.name }}</option></select></label>
        <p v-if="knowledgeStatus === 'loading'" role="status">Loading Knowledge Spaces…</p><p v-else-if="knowledgeStatus === 'error'" role="alert">Knowledge Spaces could not be loaded.</p><p v-else-if="!spaces.length">No available Knowledge Space in this Workspace.</p>
        <ToolValueInput v-model="form.query" label="Query" :variables="variables" />
        <label>Top K<input v-model.number="form.topK" type="number" min="1" step="1" required /></label>
      </template>
      <template v-else-if="kind === 'script_execution'">
        <label>Language *<select v-model="form.language"><option value="python">Python</option><option value="javascript">JavaScript</option></select></label>
        <h3>INPUT VARIABLES · OPTIONAL</h3>
        <div v-for="(input, index) in form.inputs" :key="index" class="tool-entry"><input v-model="input.alias" aria-label="Input alias" required /><select v-model="input.variableId" aria-label="Input variable"><option v-for="variable in variables" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select><button type="button" aria-label="Remove input" @click="form.inputs = form.inputs.filter((_, i) => i !== index)">×</button></div>
        <button type="button" :disabled="!variables.length" @click="addInput">+ Add input variable</button>
        <label>Script *<textarea v-model="form.script" class="tool-code" rows="7" required /></label>
      </template>
      <template v-else-if="kind === 'api_request'">
        <label>Method *<select v-model="form.method"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select></label>
        <ToolValueInput v-model="form.url" label="URL" :variables="variables" />
        <h3>HEADERS · OPTIONAL</h3>
        <div v-for="(header, index) in form.headers" :key="header.id"><input v-model="header.name" aria-label="Header name" required /><ToolValueInput v-model="header.value" label="Header value" :variables="variables" /><button type="button" @click="form.headers = form.headers.filter((_, i) => i !== index)">Remove header</button></div>
        <button type="button" @click="form.headers = [...form.headers, { id: newId(), name: '', value: literal() }]">+ Add header</button>
        <label>Request body<select :value="form.body.kind" @change="setBody"><option value="none">None</option><option value="json">JSON</option><option value="form_data">Form data</option></select></label>
        <ToolValueInput v-if="form.body.kind === 'json'" v-model="form.body.value" label="JSON body" :variables="variables" />
        <template v-if="form.body.kind === 'form_data'"><div v-for="(entry, index) in form.body.entries" :key="entry.id"><input v-model="entry.name" aria-label="Form field name" required /><ToolValueInput v-model="entry.value" label="Form field value" :variables="variables" /><button type="button" @click="form.body = { kind: 'form_data', entries: form.body.entries.filter((_, i) => i !== index) }">Remove field</button></div><button type="button" @click="form.body = { kind: 'form_data', entries: [...form.body.entries, { id: newId(), name: '', value: literal() }] }">+ Add field</button></template>
      </template>
      <template v-else-if="kind === 'set_variable'">
        <label>Target Variable *<select v-model="form.target" required><option disabled value="">Choose a writable variable</option><option v-for="variable in writable" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select></label>
        <label>Operation *<select v-model="form.operation"><option value="assign">Assign</option><option value="append">Append</option><option value="increment">Increment</option><option value="toggle">Toggle</option></select></label>
        <ToolValueInput v-if="form.operation !== 'toggle'" v-model="form.value" label="Value" :variables="variables" />
      </template>
      <template v-else>
        <label>Model *<input v-model="form.model" placeholder="Model identifier" required /></label>
        <ToolValueInput v-model="form.systemPrompt" label="System prompt · optional" :variables="variables" />
        <ToolValueInput v-model="form.prompt" label="Prompt" :variables="variables" />
      </template>
      <template v-if="kind !== 'set_variable'"><h3>OUTPUT MAPPING</h3><label class="tool-output-mapping"><span>{{ outputKeys[kind] }}</span><img :src="outputArrow" alt="maps to" /><select v-model="form.output" aria-label="Output variable" required><option disabled value="">Choose a writable variable</option><option v-for="variable in writable" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select></label></template>
      <button type="button" disabled>+ New Task Variable</button><small>Task variable creation is unavailable in this batch. Select an existing writable variable.</small>
      <details><summary>Available variables</summary><p v-for="variable in variables" :key="variable.id">{{ variable.name }} · {{ variable.dataType }} · {{ variable.writable ? 'writable' : 'read only' }}</p></details>
      <h3>FAILURE BEHAVIOR</h3><div class="tool-failure"><label><input v-model="form.failure" type="radio" value="retry" />Retry once</label><label><input v-model="form.failure" type="radio" value="fail_task" />Fail Task</label></div>
      <p v-if="validationError || error" role="alert" class="field-error">{{ validationError || error }}</p>
      <footer><button type="button" @click="emit('cancel')">Cancel</button><button type="submit" class="primary-panel-button">Save Tool</button></footer>
      <small>Configuration only. Tools are not executed in V1.</small>
    </form>
  </aside>
</template>

<style>
.system-tool-panel { overflow-y: auto; color: var(--tool-ink); background: var(--tool-surface); border-color: var(--tool-border); }
.system-tool-panel > header { align-items: center; min-height: 28px; flex-shrink: 0; }
.system-tool-panel > header h2 { flex: 1; font-size: 14px; font-weight: 500; }
.system-tool-panel > .inspector-note { margin: 0; padding-bottom: 12px; border-bottom: 1px solid var(--tool-border); font-size: 10px; }
.system-tool-panel p { margin: 0; }
.system-tool-panel .tool-value-input > label { grid-template-columns: 1fr auto; align-items: center; }
.system-tool-panel .tool-value-input > label select { padding: 4px; width: auto; font-size: 9px; }
.system-tool-form { display: grid; gap: 12px; font-size: 11px; }
.system-tool-form label,.tool-value-input { display: grid; gap: 7px; }
.system-tool-form h3 { margin: 8px 0 0; color: var(--tool-muted); font-size: 10px; font-weight: 500; }
.system-tool-form input,.system-tool-form select,.system-tool-form textarea { min-width: 0; width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid var(--tool-border); border-radius: var(--tool-radius); background: var(--tool-soft); color: var(--tool-ink); font: inherit; }
.system-tool-form textarea { resize: vertical; }
.system-tool-form button,.system-tool-panel > header button { border: 1px solid var(--tool-border); border-radius: var(--tool-radius); padding: 8px 12px; background: var(--tool-surface); color: var(--tool-primary); cursor: pointer; }
.system-tool-form button:disabled { color: var(--tool-muted); cursor: not-allowed; }
.system-tool-form :focus-visible { outline: 2px solid var(--tool-primary); outline-offset: 2px; }
.system-tool-form small { color: var(--tool-muted); line-height: 1.5; }
.system-tool-form footer { display: flex; justify-content: space-between; border-top: 1px solid var(--tool-border); padding-top: 16px; }
.system-tool-form .primary-panel-button { width: 132px; background: var(--tool-primary); color: var(--tool-surface); }
.tool-entry { display: grid; grid-template-columns: 1fr 1fr auto; gap: 5px; }
.tool-failure { display: flex; gap: 20px; }
.tool-failure label { flex: 1; display: flex; align-items: center; padding: 8px; border: 1px solid var(--tool-border); border-radius: var(--tool-radius); }
.tool-failure label:has(input:checked) { border-color: var(--tool-primary); background: var(--tool-soft); }
.tool-failure input { width: auto; }
.system-tool-form .tool-output-mapping { display: grid; grid-template-columns: auto 20px minmax(0, 1fr); align-items: center; gap: 8px; }
.tool-output-mapping img { display: block; }
.system-tool-form .tool-code { height: 122px; min-height: 122px; font-family: monospace; background: var(--tool-ink); color: var(--tool-surface); }
</style>
