<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { jsonValueSchema, type ValueSource } from '@odyssey/schemas'
import type { ToolVariableOption } from '@/domain/workflow/systemToolCommands'
const props = withDefaults(defineProps<{ modelValue: ValueSource; variables: readonly ToolVariableOption[]; label: string; compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ 'update:modelValue': [value: ValueSource] }>()
type ValueInputMode = 'text' | 'json' | 'variable'
const mode = ref<ValueInputMode>('text')
const text = ref('')
const modeMenuOpen = ref(false)
const modeSelectRoot = ref<globalThis.HTMLDivElement | null>(null)
const modeOptions = computed(() => [
  { value: 'text' as const, label: 'Text + variables', disabled: false },
  { value: 'json' as const, label: 'Static JSON', disabled: false },
  { value: 'variable' as const, label: 'Variable reference', disabled: props.variables.length === 0 },
])
const modeLabel = computed(() => modeOptions.value.find((option) => option.value === mode.value)?.label ?? 'Text + variables')
watch(() => props.modelValue, (value) => {
  if (value.kind === 'variable') { mode.value = 'variable'; text.value = value.variableId }
  else if (value.kind === 'template') { mode.value = 'text'; text.value = value.segments.map((s) => s.kind === 'text' ? s.text : `{{${props.variables.find((v) => v.id === s.variableId)?.name ?? s.variableId}}}`).join('') }
  else { mode.value = typeof value.value === 'string' ? 'text' : 'json'; text.value = typeof value.value === 'string' ? value.value : JSON.stringify(value.value) }
}, { immediate: true })
function update(event?: globalThis.Event) {
  const input = event?.target
  const control = input instanceof globalThis.HTMLTextAreaElement || input instanceof globalThis.HTMLInputElement ? input : null
  control?.setCustomValidity('')
  if (mode.value === 'variable') {
    const variable = props.variables.find((v) => v.id === text.value)
    if (variable) emit('update:modelValue', { kind: 'variable', variableId: variable.id })
    return
  }
  if (mode.value === 'json') {
    try { emit('update:modelValue', { kind: 'literal', value: jsonValueSchema.parse(JSON.parse(text.value)) }) }
    catch { control?.setCustomValidity('Enter valid JSON.') }
    return
  }
  const segments: Extract<ValueSource, { kind: 'template' }>['segments'] = []
  let offset = 0
  for (const match of text.value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const variable = props.variables.find((v) => v.name === match[1])
    if (!variable) { control?.setCustomValidity('Choose a variable in this Task scope.'); return }
    if (match.index > offset) segments.push({ kind: 'text', text: text.value.slice(offset, match.index) })
    segments.push({ kind: 'variable', variableId: variable.id })
    offset = match.index + match[0].length
  }
  if (!segments.length) emit('update:modelValue', { kind: 'literal', value: text.value })
  else {
    if (offset < text.value.length) segments.push({ kind: 'text', text: text.value.slice(offset) })
    emit('update:modelValue', { kind: 'template', segments })
  }
}
function changeMode() {
  if (mode.value === 'variable') text.value = props.variables[0]?.id ?? ''
  else text.value = mode.value === 'json' ? 'null' : ''
  update()
}
function selectMode(nextMode: ValueInputMode) {
  const option = modeOptions.value.find((candidate) => candidate.value === nextMode)
  if (!option || option.disabled) return
  modeMenuOpen.value = false
  if (mode.value === nextMode) return
  mode.value = nextMode
  changeMode()
}
function closeModeMenuOnFocusOut(event: globalThis.FocusEvent) {
  if (event.relatedTarget instanceof globalThis.Node && modeSelectRoot.value?.contains(event.relatedTarget)) return
  modeMenuOpen.value = false
}
</script>
<template>
  <div class="tool-value-input" :class="{ 'is-compact': compact }">
    <label>
      <span>{{ label }}</span>
      <div ref="modeSelectRoot" class="tool-value-mode-select" @focusout="closeModeMenuOnFocusOut" @keydown.escape.stop="modeMenuOpen = false">
        <button type="button" class="tool-value-mode-trigger" aria-haspopup="listbox" :aria-expanded="modeMenuOpen" :aria-label="`${label} source: ${modeLabel}`" @click="modeMenuOpen = !modeMenuOpen">
          <span>{{ modeLabel }}</span><i aria-hidden="true" />
        </button>
        <div v-if="modeMenuOpen" class="tool-value-mode-menu" role="listbox" :aria-label="`${label} source`">
          <button v-for="option in modeOptions" :key="option.value" type="button" role="option" :disabled="option.disabled" :aria-selected="mode === option.value" :class="{ 'is-selected': mode === option.value }" @click="selectMode(option.value)">
            <span>{{ option.label }}</span><b v-if="mode === option.value" aria-hidden="true">✓</b>
          </button>
        </div>
      </div>
    </label>
    <select v-if="mode === 'variable'" v-model="text" :aria-label="label" required @change="update()"><option v-for="variable in variables" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select>
    <input v-if="compact && mode === 'text'" v-model="text" :aria-label="label" type="text" @input="update($event)" />
    <textarea v-else-if="mode !== 'variable'" v-model="text" :aria-label="label" rows="3" @input="update($event)" />
    <small v-if="mode === 'text'">Use <code v-pre>{{agent.key}}</code> or <code v-pre>{{task.key}}</code> for variables listed below.</small>
  </div>
</template>

<style scoped>
.tool-value-input>label { position:relative; z-index:3; }
.tool-value-mode-select { position:relative; justify-self:end; min-width:112px; max-width:150px; }
.tool-value-mode-trigger { width:100%; min-height:24px; box-sizing:border-box; border:1px solid transparent; border-radius:6px; padding:3px 7px; display:flex; align-items:center; justify-content:space-between; gap:8px; background:transparent; color:var(--tool-muted,#69758c); font:inherit; font-size:9px; line-height:16px; text-align:left; cursor:pointer; transition:border-color .14s ease,background .14s ease,box-shadow .14s ease; }
.tool-value-mode-trigger:hover { border-color:var(--tool-border,#d8deea); background:var(--tool-surface,#fff); }
.tool-value-mode-trigger:focus-visible,.tool-value-mode-select:focus-within .tool-value-mode-trigger { outline:0; border-color:var(--tool-primary,#4d72f2); background:var(--tool-surface,#fff); box-shadow:0 0 0 2px rgba(77,114,242,.14); }
.tool-value-mode-trigger i { width:6px; height:6px; flex:0 0 6px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:translateY(-2px) rotate(45deg); transition:transform .14s ease; }
.tool-value-mode-trigger[aria-expanded="true"] i { transform:translateY(2px) rotate(225deg); }
.tool-value-mode-menu { position:absolute; z-index:40; top:calc(100% + 5px); right:0; width:156px; box-sizing:border-box; padding:5px; border:1px solid var(--tool-border,#d8deea); border-radius:8px; display:grid; gap:2px; background:var(--tool-surface,#fff); box-shadow:0 10px 24px rgba(23,32,51,.16); }
.tool-value-mode-menu button { width:100%; min-height:30px; border:0; border-radius:5px; padding:6px 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; background:transparent; color:var(--tool-ink,#172033); font:inherit; font-size:10px; line-height:16px; text-align:left; cursor:pointer; }
.tool-value-mode-menu button:hover:not(:disabled),.tool-value-mode-menu button:focus-visible:not(:disabled) { outline:0; background:#eef3ff; color:#294fb7; }
.tool-value-mode-menu button.is-selected { background:#e7eeff; color:#294fb7; font-weight:650; }
.tool-value-mode-menu button:disabled { opacity:.4; cursor:not-allowed; }
.tool-value-mode-menu b { color:var(--tool-primary,#4d72f2); font-size:10px; }
.tool-value-input.is-compact .tool-value-mode-select { min-width:112px; }
</style>
