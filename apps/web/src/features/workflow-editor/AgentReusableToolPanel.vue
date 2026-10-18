<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowReactive } from 'vue'
import { colors, radii } from '@odyssey/design-tokens'
import {
  agentReusableToolSchema,
  uuidSchema,
  type AgentReusableTool,
  type AgentVariable,
  type KnowledgeSpaceSummary,
  type ValueSource,
} from '@odyssey/schemas'
import type { SystemToolDraft } from '@/stores/workflowEditor'
import type { ToolVariableOption } from '@/domain/workflow/systemToolCommands'
import ToolValueInput from './ToolValueInput.vue'
import ToolSelect from './ToolSelect.vue'
import outputArrow from '@/assets/tool-output-arrow.svg'

const props = defineProps<{
  draft: Extract<NonNullable<SystemToolDraft>, { host: 'agent-action' | 'reusable-tool-library' }>
  variables: readonly AgentVariable[]
  knowledgeSpaces: readonly KnowledgeSpaceSummary[]
  knowledgeStatus: 'loading' | 'ready' | 'error'
}>()
const emit = defineEmits<{ save: [tool: AgentReusableTool]; cancel: [] }>()
const firstInput = ref<globalThis.HTMLInputElement | null>(null)
const returnFocus = globalThis.document.activeElement
onMounted(() => firstInput.value?.focus())
onBeforeUnmount(() => { if (returnFocus instanceof globalThis.HTMLElement && returnFocus.isConnected) returnFocus.focus() })

const kind = props.draft.kind
const existing = props.draft.tool
const newId = () => uuidSchema.parse(globalThis.crypto.randomUUID())
const literal = (value = ''): ValueSource => ({ kind: 'literal', value })
const variableOptions = computed<ToolVariableOption[]>(() => props.variables.map((variable) => ({
  id: variable.id,
  name: `agent.${variable.key}`,
  dataType: variable.dataType,
  writable: !variable.readOnly,
})))
const writableVariables = computed(() => variableOptions.value.filter((variable) => variable.writable))
const outputOptions = computed(() => [
  { value: '', label: 'No output binding' },
  ...writableVariables.value.map((variable) => ({ value: variable.id, label: variable.name })),
])
const spaces = computed(() => props.knowledgeSpaces.filter((space) => ['ready', 'syncing'].includes(space.lifecycleStatus) && ['healthy', 'needs_review'].includes(space.graphStatus)))
const title = { knowledge_retrieval: 'Knowledge Retrieval', script_execution: 'Script Execution', api_request: 'API Request', set_variable: 'Set Variable', llm_call: 'LLM Call' }[kind]
const description = {
  knowledge_retrieval: 'retrieves context from a Knowledge Space',
  script_execution: 'deterministic code execution',
  api_request: 'external HTTP request',
  set_variable: 'writes a workflow variable',
  llm_call: 'structured model inference',
}[kind]
const outputKeys = { knowledge_retrieval: 'retrieved_documents', script_execution: 'result', api_request: 'response.data', set_variable: '', llm_call: 'response.text' }
const form = shallowReactive({
  name: existing?.name ?? title,
  output: existing?.outputBinding?.targetVariableId ?? '',
  knowledgeSpaceId: existing?.kind === 'knowledge_retrieval' ? existing.configuration.knowledgeSpaceId : '',
  query: existing?.kind === 'knowledge_retrieval' ? existing.configuration.query ?? literal() : literal(),
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

function setBody(event: globalThis.Event) {
  if (!(event.target instanceof globalThis.HTMLSelectElement)) return
  form.body = event.target.value === 'json' ? { kind: 'json', value: literal() } : event.target.value === 'form_data' ? { kind: 'form_data', entries: [] } : { kind: 'none' }
}
function addInput() {
  const first = variableOptions.value[0]
  if (first) form.inputs = [...form.inputs, { alias: `input_${form.inputs.length + 1}`, variableId: first.id }]
}
function submit() {
  const configuration = kind === 'knowledge_retrieval' ? { knowledgeSpaceId: form.knowledgeSpaceId, query: form.query, topK: form.topK }
    : kind === 'script_execution' ? { language: form.language, inputs: form.inputs, script: form.script }
    : kind === 'api_request' ? { method: form.method, url: form.url, headers: form.headers, body: form.body }
    : kind === 'set_variable' ? { targetVariableId: form.target, operation: form.operation, ...(form.operation === 'toggle' ? {} : { value: form.value }) }
    : { model: form.model, systemPrompt: form.systemPrompt, prompt: form.prompt }
  const candidate = {
    id: existing?.id ?? newId(),
    name: form.name.trim(),
    // sourceTemplateId belongs to Tool Template provenance, not System Tool Definition.
    sourceTemplateId: existing?.sourceTemplateId ?? null,
    kind,
    configuration,
    inputBindings: [],
    outputBinding: kind === 'set_variable' || !form.output ? null : { sourceKey: outputKeys[kind], targetVariableId: form.output },
  }
  const parsed = agentReusableToolSchema.safeParse(candidate)
  if (!parsed.success) {
    validationError.value = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    return
  }
  validationError.value = ''
  emit('save', parsed.data)
}
</script>

<template>
  <aside class="workflow-resource-browser system-tool-panel" :style="{ '--tool-border': colors.border, '--tool-surface': colors.surface, '--tool-muted': colors.muted, '--tool-primary': colors.primary, '--tool-soft': colors.primarySoft, '--tool-ink': colors.ink, '--tool-radius': radii.sm }" aria-label="Agent reusable Tool configuration" @keydown.esc.stop="emit('cancel')">
    <header><button type="button" aria-label="Back to System Tools" @click="emit('cancel')">‹</button><h2>{{ title }}</h2><button type="button" aria-label="Close Tool configuration" @click="emit('cancel')">×</button></header>
    <p class="inspector-note">Built-in Tool · {{ description }} · {{ draft.host === 'agent-action' ? 'Agent Action Toolbox' : 'Reusable Tools' }}</p>
    <form class="system-tool-form" @submit.prevent="submit">
      <label>Label · optional<input ref="firstInput" v-model="form.name" placeholder="Give this Tool a clear label" required /></label>
      <h3 class="tool-section-heading">CONFIGURATION</h3>
      <template v-if="kind === 'knowledge_retrieval'">
        <label>Knowledge Space *<select v-model="form.knowledgeSpaceId" required><option value="" disabled>Choose a Knowledge Space</option><option v-for="space in spaces" :key="space.id" :value="space.id">{{ space.name }}</option></select></label>
        <p v-if="knowledgeStatus === 'loading'" role="status">Loading Knowledge Spaces…</p><p v-else-if="knowledgeStatus === 'error'" role="alert">Knowledge Spaces could not be loaded.</p><p v-else-if="!spaces.length">No available Knowledge Space in this Workspace.</p>
        <ToolValueInput v-model="form.query" label="Query" :variables="variableOptions" />
        <label>Top K<input v-model.number="form.topK" type="number" min="1" step="1" required /></label>
      </template>
      <template v-else-if="kind === 'script_execution'">
        <label>Language *<select v-model="form.language"><option value="python">Python</option><option value="javascript">JavaScript</option></select></label>
        <h3>INPUT VARIABLES · OPTIONAL</h3>
        <div v-for="(input, index) in form.inputs" :key="index" class="tool-entry"><input v-model="input.alias" aria-label="Input alias" required /><select v-model="input.variableId"><option v-for="variable in variableOptions" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select><button type="button" @click="form.inputs = form.inputs.filter((_, i) => i !== index)">×</button></div>
        <button type="button" :disabled="!variableOptions.length" @click="addInput">+ Add input variable</button>
        <label>Script *<textarea v-model="form.script" class="tool-code" rows="7" required /></label>
      </template>
      <template v-else-if="kind === 'api_request'">
        <div class="tool-request-row"><label>Method *<select v-model="form.method"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select></label><ToolValueInput v-model="form.url" label="URL *" :variables="variableOptions" compact /></div>
        <h3>HEADERS · OPTIONAL</h3>
        <p class="tool-empty-note">Headers can be added when this Tool is edited from Reusable Tools.</p>
        <label>Request body · optional<select :value="form.body.kind" @change="setBody"><option value="none">None</option><option value="json">JSON</option><option value="form_data">Form data</option></select></label>
      </template>
      <template v-else-if="kind === 'set_variable'">
        <label>Target Agent Variable *<select v-model="form.target" required><option disabled value="">Choose a writable variable</option><option v-for="variable in writableVariables" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select></label>
        <label>Operation *<select v-model="form.operation"><option value="assign">Assign</option><option value="append">Append</option><option value="increment">Increment</option><option value="toggle">Toggle</option></select></label>
        <ToolValueInput v-if="form.operation !== 'toggle'" v-model="form.value" label="Value" :variables="variableOptions" />
      </template>
      <template v-else>
        <label>Model *<input v-model="form.model" required /></label>
        <ToolValueInput v-model="form.systemPrompt" label="System prompt · optional" :variables="variableOptions" />
        <ToolValueInput v-model="form.prompt" label="Prompt" :variables="variableOptions" />
      </template>
      <template v-if="kind !== 'set_variable'">
        <div class="tool-section-divider" />
        <h3>OUTPUT MAPPING · OPTIONAL</h3>
        <label class="tool-output-mapping"><span>{{ outputKeys[kind] }}</span><img :src="outputArrow" alt="maps to" /><ToolSelect v-model="form.output" :options="outputOptions" control-label="Output Agent Variable" /></label>
      </template>
      <p v-if="validationError" role="alert" class="field-error">{{ validationError }}</p>
      <footer><button type="button" @click="emit('cancel')">Cancel</button><button type="submit" class="primary-panel-button">{{ existing ? 'Save Tool' : 'Add to Toolbox' }}</button></footer>
      <small>Agent Variables make this result available to later Agent Actions.</small>
    </form>
  </aside>
</template>
