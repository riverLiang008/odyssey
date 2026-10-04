<script setup lang="ts">
import { ref, watch } from 'vue'
import { jsonValueSchema, type ValueSource } from '@odyssey/schemas'
import type { ToolVariableOption } from '@/domain/workflow/systemToolCommands'
const props = defineProps<{ modelValue: ValueSource; variables: readonly ToolVariableOption[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: ValueSource] }>()
const mode = ref('text')
const text = ref('')
watch(() => props.modelValue, (value) => {
  if (value.kind === 'variable') { mode.value = 'variable'; text.value = value.variableId }
  else if (value.kind === 'template') { mode.value = 'text'; text.value = value.segments.map((s) => s.kind === 'text' ? s.text : `{{${props.variables.find((v) => v.id === s.variableId)?.name ?? s.variableId}}}`).join('') }
  else { mode.value = typeof value.value === 'string' ? 'text' : 'json'; text.value = typeof value.value === 'string' ? value.value : JSON.stringify(value.value) }
}, { immediate: true })
function update(event?: globalThis.Event) {
  const input = event?.target
  const control = input instanceof globalThis.HTMLTextAreaElement ? input : null
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
</script>
<template>
  <div class="tool-value-input">
    <label>{{ label }}<select v-model="mode" :aria-label="`${label} source`" @change="changeMode"><option value="text">Text + variables</option><option value="json">Static JSON</option><option value="variable" :disabled="!variables.length">Variable reference</option></select></label>
    <select v-if="mode === 'variable'" v-model="text" :aria-label="label" required @change="update()"><option v-for="variable in variables" :key="variable.id" :value="variable.id">{{ variable.name }}</option></select>
    <textarea v-else v-model="text" :aria-label="label" rows="3" @input="update($event)" />
    <small v-if="mode === 'text'">Use <code v-pre>{{agent.key}}</code> or <code v-pre>{{task.key}}</code> for variables listed below.</small>
  </div>
</template>
