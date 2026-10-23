<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { colors, radii } from '@odyssey/design-tokens'
import { jsonValueSchema, uuidSchema, type AgentVariable, type JsonValue, type VariableDataType, type VariableOwnership } from '@odyssey/schemas'
import ResourcePanelCloseButton from './ResourcePanelCloseButton.vue'
import ToolSelect from './ToolSelect.vue'

const props = defineProps<{ variables: readonly AgentVariable[]; readOnly?: boolean; error?: string | null; referenceCount: (id: AgentVariable['id']) => number }>()
const emit = defineEmits<{ save: [variable: AgentVariable]; delete: [id: AgentVariable['id']]; collapse: [] }>()
const query = ref('')
const editingId = ref<AgentVariable['id'] | null>(null)
const formOpen = ref(false)
const validationError = ref('')
const pendingSaveId = ref<AgentVariable['id'] | null>(null)
const pendingDeleteId = ref<AgentVariable['id'] | null>(null)
const confirmingDelete = ref(false)
const form = reactive({ key: '', description: '', dataType: 'string' as VariableDataType, ownership: 'user_managed' as VariableOwnership, defaultValue: '' })
const groups = [
  { ownership: 'user_managed' as const, title: 'User-managed', note: 'Tools write · Agent read-only', tone: 'user' },
  { ownership: 'shared' as const, title: 'Shared', note: 'Tools + Agent Actions write', tone: 'shared' },
  { ownership: 'agent_managed' as const, title: 'Agent-managed', note: 'Maintained by Agent Actions', tone: 'agent' },
]
const dataTypeOptions: readonly { value: VariableDataType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'Object / JSON' },
]
const filtered = computed(() => props.variables.filter((variable) => `${variable.key} ${variable.displayName} ${variable.description ?? ''}`.toLowerCase().includes(query.value.toLowerCase())))
function resetForm(variable?: AgentVariable) {
  editingId.value = variable?.id ?? null
  form.key = variable?.key ?? ''
  form.description = variable?.description ?? ''
  form.dataType = variable?.dataType ?? 'string'
  form.ownership = variable?.ownership ?? 'user_managed'
  const defaultValue = variable?.defaultValue
  form.defaultValue = defaultValue === undefined || defaultValue === null ? '' : typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue)
  validationError.value = ''
  formOpen.value = true
}
function parseDefault(): JsonValue | null | undefined {
  if (!form.defaultValue.trim()) return null
  if (form.dataType === 'string') return form.defaultValue
  if (form.dataType === 'number') { const value = Number(form.defaultValue); return Number.isFinite(value) ? value : undefined }
  if (form.dataType === 'boolean') return form.defaultValue === 'true' ? true : form.defaultValue === 'false' ? false : undefined
  try { return jsonValueSchema.parse(JSON.parse(form.defaultValue)) } catch { return undefined }
}
function displayNameFromKey(key: string) {
  return key.split('_').filter(Boolean).map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
}
function submit() {
  const key = form.key.trim()
  const defaultValue = parseDefault()
  if (!/^[a-z][a-z0-9_]*$/.test(key) || key.startsWith('sys_')) { validationError.value = 'Use a unique snake_case name outside the reserved sys namespace.'; return }
  if (defaultValue === undefined) { validationError.value = 'Default value does not match the selected data type.'; return }
  const id = editingId.value ?? uuidSchema.parse(globalThis.crypto.randomUUID())
  pendingSaveId.value = id
  emit('save', { id, key, displayName: displayNameFromKey(key), description: form.description.trim() || null, dataType: form.dataType, ownership: form.ownership, defaultValue, readOnly: form.ownership === 'agent_managed' })
}
function preview(value: JsonValue) { return value === null ? '—' : typeof value === 'string' ? value : JSON.stringify(value) }
function selectDataType(value: string) {
  const option = dataTypeOptions.find((candidate) => candidate.value === value)
  if (option) form.dataType = option.value
}
function closeForm() { formOpen.value = false; editingId.value = null; validationError.value = ''; confirmingDelete.value = false; pendingSaveId.value = null; pendingDeleteId.value = null }
function requestDelete() { confirmingDelete.value = true }
function confirmDelete() {
  if (!editingId.value) return
  pendingDeleteId.value = editingId.value
  emit('delete', editingId.value)
}
watch(() => props.variables, (variables) => {
  if (pendingSaveId.value && variables.some((variable) => variable.id === pendingSaveId.value)) closeForm()
  else if (pendingDeleteId.value && !variables.some((variable) => variable.id === pendingDeleteId.value)) closeForm()
}, { deep: false })
</script>

<template>
  <aside class="workflow-resource-browser agent-variables-panel" :style="{ '--av-primary': colors.primary, '--av-border': colors.border, '--av-surface': colors.surface, '--av-soft': colors.primarySoft, '--av-muted': colors.muted, '--av-radius': radii.sm }" aria-label="Agent Variables">
    <header><div><p class="workflow-eyebrow">RESOURCES</p><h2 v-if="!formOpen">Agent Variables</h2></div><div class="variable-header-actions"><button v-if="!formOpen" type="button" class="variable-add" :disabled="readOnly" @click="resetForm()">+ Add variable</button><ResourcePanelCloseButton @close="emit('collapse')" /></div></header>
    <template v-if="!formOpen">
      <input v-model="query" class="variable-search" aria-label="Search variables" placeholder="⌕  Search variables, references, or descriptions" />
      <section class="variable-group system"><header><strong>System · 0</strong><small>Provided by Odyssey · Read-only</small></header><p>System variable inventory is not available in the current API.</p></section>
      <section v-for="group in groups" :key="group.ownership" class="variable-group" :class="group.tone">
        <header><strong>{{ group.title }} · {{ filtered.filter((variable) => variable.ownership === group.ownership).length }}</strong><small>{{ group.note }}</small></header>
        <button v-for="variable in filtered.filter((entry) => entry.ownership === group.ownership)" :key="variable.id" type="button" class="variable-row" :disabled="readOnly" @click="resetForm(variable)"><i /><span><strong>agent.{{ variable.key }}</strong><small>{{ variable.displayName }}</small></span><small>{{ variable.dataType }}</small><small :title="preview(variable.defaultValue)">{{ preview(variable.defaultValue) }}</small></button>
        <p v-if="!filtered.some((variable) => variable.ownership === group.ownership)">No variables in this group.</p>
      </section>
      <p class="variables-footer">Panel scrolls; variables move automatically when State Ownership changes.</p>
    </template>
    <form v-else class="variable-form" @submit.prevent="submit" @keydown.esc.stop="closeForm">
      <div class="variable-form-title"><button type="button" aria-label="Back to Agent Variables" title="Back to Agent Variables" @click="closeForm">←</button><h3>{{ editingId ? 'Edit variable' : 'Add variable' }}</h3></div>
      <label>Variable name *<input v-model="form.key" placeholder="research_status" autocomplete="off" /><small>Reference: agent.{{ form.key || 'variable_name' }}</small></label>
      <label>Data type<ToolSelect class="variable-data-type" :model-value="form.dataType" :options="dataTypeOptions" control-label="Data type" @update:model-value="selectDataType" /></label>
      <label>Description · optional<textarea v-model="form.description" rows="3" /></label>
      <label>Default value · optional<textarea v-model="form.defaultValue" rows="3" :placeholder="form.dataType === 'json' ? '{} or []' : 'Leave empty for null'" /></label>
      <fieldset><legend>State Ownership</legend><label v-for="group in groups" :key="group.ownership"><input v-model="form.ownership" type="radio" :value="group.ownership" /><span><strong>{{ group.title }}</strong><small>{{ group.note }}</small></span></label></fieldset>
      <p v-if="validationError || error" class="field-error" role="alert">{{ validationError || error }}</p>
      <p v-if="editingId && referenceCount(editingId)" class="variable-impact">Used by {{ referenceCount(editingId) }} workflow reference(s). Delete is blocked until those references are removed.</p>
      <div v-if="confirmingDelete" class="delete-confirm" role="alert"><strong>Delete this variable?</strong><small>This action cannot be undone.</small><div><button type="button" class="delete-confirm__keep" @click="confirmingDelete = false">Keep variable</button><button type="button" class="delete-confirm__danger" @click="confirmDelete">Confirm delete</button></div></div>
      <footer v-else><button v-if="editingId" type="button" class="variable-delete" :disabled="Boolean(referenceCount(editingId))" @click="requestDelete">Delete</button><button type="submit" class="primary-panel-button">{{ editingId ? 'Save changes' : 'Create variable' }}</button></footer>
    </form>
  </aside>
</template>

<style>
.agent-variables-panel { overflow-y: auto; gap: 10px; }
.variable-header-actions { display: flex; align-items: center; gap: 6px; }.variable-add { min-height: 34px; min-width: 110px; padding: 7px 12px; border: 0; border-radius: 7px; background: var(--av-primary); color: white; font: inherit; font-weight: 650; cursor: pointer; }.variable-add:hover:not(:disabled) { background: color-mix(in srgb,var(--av-primary) 88%,#172033); }.variable-add:focus-visible { outline: 2px solid var(--av-primary); outline-offset: 2px; }.variable-add:disabled { opacity: .5; cursor: not-allowed; }
.variable-search { box-sizing: border-box; width: 100%; padding: 9px 11px; border: 1px solid var(--av-border); border-radius: 7px; background: var(--av-soft); color: var(--av-muted); font: inherit; }
.variable-group { display: grid; gap: 5px; padding: 9px 10px; border: 1px solid; border-radius: 9px; }
.variable-group > header { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; }
.variable-group > header small,.variable-group > p { color: var(--av-muted); font-size: 9px; }
.variable-group.system { border-color: #637591; background: #f2f7fc; }.variable-group.system > header strong { color: #637591; }
.variable-group.user { border-color: #29a17a; background: #edfaf5; }.variable-group.user > header strong { color: #238665; }
.variable-group.shared { border-color: #d19421; background: #fff7e5; }.variable-group.shared > header strong { color: #b17814; }
.variable-group.agent { border-color: #7765d5; background: #f3f0ff; }.variable-group.agent > header strong { color: #6653c2; }
.variable-row { display: grid; grid-template-columns: 7px minmax(0, 1fr) 62px 70px; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: var(--av-surface); text-align: left; }
.variable-row i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }.user .variable-row { color: #29a17a; }.shared .variable-row { color: #d19421; }.agent .variable-row { color: #7765d5; }
.variable-row span { min-width: 0; }.variable-row span strong,.variable-row span small { display: block; overflow: hidden; color: #1f2940; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.variable-row span small,.variable-row > small { color: var(--av-muted); font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.variables-footer { margin: 0; padding: 9px 10px; border-radius: 7px; background: #f2f7fc; color: var(--av-muted); font-size: 9px; }
.variable-form { display: grid; gap: 12px; }.variable-form-title { display: flex; align-items: center; gap: 10px; padding: 2px 0 10px; border-bottom: 1px solid var(--av-border); }.variable-form-title button { display: inline-grid; width: 30px; height: 30px; flex: 0 0 30px; padding: 0; place-items: center; border: 1px solid var(--av-border); border-radius: 8px; background: var(--av-surface); color: #52617a; font-size: 17px; line-height: 1; cursor: pointer; }.variable-form-title button:hover { border-color: var(--av-primary); background: var(--av-soft); color: var(--av-primary); }.variable-form-title button:focus-visible { outline: 2px solid var(--av-primary); outline-offset: 2px; }.variable-form-title h3 { margin: 0; color: #202a40; font-size: 18px; line-height: 1.2; }.variable-form label { display: grid; gap: 5px; color: var(--av-muted); font-size: 11px; }.variable-form input,.variable-form textarea { box-sizing: border-box; width: 100%; padding: 8px 10px; border: 1px solid var(--av-border); border-radius: var(--av-radius); background: var(--av-soft); font: inherit; }.variable-form .variable-data-type { --tool-primary: var(--av-primary); --tool-border: var(--av-border); --tool-surface: var(--av-surface); --tool-soft: var(--av-soft); --tool-muted: var(--av-muted); --tool-radius: var(--av-radius); }.variable-form .variable-data-type .tool-select-trigger { min-height: 38px; }.variable-form fieldset { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--av-border); border-radius: var(--av-radius); }.variable-form fieldset label { grid-template-columns: auto 1fr; align-items: start; }.variable-form fieldset input { width: auto; }.variable-form fieldset strong,.variable-form fieldset small { display: block; }.variable-form footer { display: flex; gap: 8px; }.variable-form footer button:last-child { margin-left: auto; }.variable-impact { padding: 8px; border-radius: var(--av-radius); background: #fff7e5; color: #845b13; font-size: 10px; }.variable-form .field-error { color: #b33b43; }
.variable-form footer button { min-height: 38px; padding: 8px 14px; border-radius: 7px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: border-color .14s ease, background .14s ease, color .14s ease, box-shadow .14s ease; }.variable-form footer .variable-delete { border: 1px solid #e3a4aa; background: #fff7f7; color: #b33b43; }.variable-form footer .variable-delete:hover:not(:disabled) { border-color: #c85a64; background: #ffeded; color: #982f38; }.variable-form footer .variable-delete:focus-visible { outline: 2px solid #c83f4b; outline-offset: 2px; }.variable-form footer .variable-delete:disabled { border-color: #e5d7d9; background: #f8f5f5; color: #aa9295; cursor: not-allowed; }.variable-form footer .primary-panel-button { width: auto; flex: 1; margin-bottom: 0; }
.delete-confirm { display: grid; gap: 6px; padding: 14px; border: 1px solid #efb2b6; border-radius: var(--av-radius); background: #fff3f4; color: #7d2830; }.delete-confirm small { color: #9b5057; }.delete-confirm div { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }.delete-confirm button { min-height: 36px; padding: 7px 13px; border-radius: 7px; font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; transition: border-color .14s ease, background .14s ease, color .14s ease, box-shadow .14s ease, transform .08s ease; }.delete-confirm button:active { transform: translateY(1px); }.delete-confirm button:focus-visible { outline: 2px solid #c83f4b; outline-offset: 2px; }.delete-confirm__keep { border: 1px solid #d8a3a8; background: #fff; color: #7d2830; }.delete-confirm__keep:hover { border-color: #c66d76; background: #fff8f8; }.delete-confirm__danger { border: 1px solid #c83f4b; background: #c83f4b; color: #fff; box-shadow: 0 4px 10px rgba(200,63,75,.18); }.delete-confirm__danger:hover { border-color: #ad303c; background: #ad303c; box-shadow: 0 5px 12px rgba(173,48,60,.24); }
</style>
