<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from '@/components/AppSelect.vue'
import type { AgentVariable } from '@odyssey/schemas'
import type { BranchOperandDraft } from '@/domain/workflow/branchDrafts'
const props = defineProps<{ modelValue: BranchOperandDraft; variables: readonly AgentVariable[]; label: string; disabled?: boolean; search?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: BranchOperandDraft] }>()
const kind = computed({ get: () => props.modelValue.kind, set: (kind: string) => {
  if (kind === 'variable') emit('update:modelValue', { kind: 'variable', variableId: '' })
  if (kind === 'literal') emit('update:modelValue', { kind: 'literal', dataType: 'string', raw: '' })
} })
const query = computed({ get: () => props.modelValue.kind === 'variable' ? props.modelValue.variableId : '', set: (variableId: string) => emit('update:modelValue', { kind: 'variable', variableId }) })
const options = computed(() => props.variables.filter(v => v.id === query.value || `${v.displayName} ${v.key} ${v.dataType}`.toLowerCase().includes((props.search ?? '').toLowerCase())))
const missing = computed(() => props.modelValue.kind === 'variable' && props.modelValue.variableId && !props.variables.some(v => v.id === query.value))
const sourceOptions = computed(() => [
  { value: 'variable', label: 'Variable' },
  { value: 'literal', label: 'Value' },
  ...(props.modelValue.kind === 'template' ? [{ value: 'template', label: 'Existing template' }] : []),
])
const variableOptions = computed(() => [
  { value: '', label: 'Select variable', disabled: true },
  ...(missing.value ? [{ value: query.value, label: 'Unavailable variable', disabled: true }] : []),
  ...options.value.map(v => ({ value: v.id, label: `${v.displayName} · ${v.dataType}` })),
])
const typeOptions = ['string', 'number', 'boolean', 'json'].map(value => ({ value, label: value === 'json' ? 'JSON' : value[0]?.toUpperCase() + value.slice(1) }))
function updateType(type: string) {
  if (props.modelValue.kind === 'literal' && (type === 'string' || type === 'number' || type === 'boolean' || type === 'json')) {
    emit('update:modelValue', { ...props.modelValue, dataType: type })
  }
}
</script>
<template>
  <fieldset class="branch-operand" :disabled="disabled">
    <label><span>Source</span><AppSelect v-model="kind" :options="sourceOptions" :control-label="`${label} source`" /></label>
    <template v-if="modelValue.kind === 'variable'">
      <label><span>Variable</span><AppSelect v-model="query" :options="variableOptions" :control-label="label" :aria-invalid="Boolean(missing)" /></label>
      <small v-if="missing" class="branch-error">This variable is unavailable. Choose another variable.</small>
    </template>
    <template v-else-if="modelValue.kind === 'literal'">
      <label><span>Type</span><AppSelect :model-value="modelValue.dataType" :options="typeOptions" :control-label="`${label} type`" @update:model-value="updateType" /></label>
      <label class="branch-operand-value"><span>Value</span><input :value="modelValue.raw" :aria-label="label" :disabled="disabled" placeholder="Enter value" @input="event => modelValue.kind === 'literal' && emit('update:modelValue', { ...modelValue, raw: (event.target as HTMLInputElement).value })" /></label>
    </template>
    <p v-else>Existing template is preserved. Choose Variable or Value to replace it.</p>
  </fieldset>
</template>

<style scoped>
.branch-operand { margin:0; padding:0; border:0; min-width:0; }
.branch-operand-value { grid-column:1 / -1; }
</style>
