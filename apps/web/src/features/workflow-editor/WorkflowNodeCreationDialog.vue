<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { AgentVariable } from '@odyssey/schemas'
import type { AgentActionDraftValues, LoopDraftValues } from '@/domain/workflow'
import type { WorkflowCreationDraft } from '@/stores/workflowEditor'

const props = defineProps<{
  draft: Exclude<WorkflowCreationDraft, { type: 'closed' }>
  variables: readonly AgentVariable[]
  error?: string | null
}>()
const emit = defineEmits<{
  close: []
  submitAgentAction: [values: AgentActionDraftValues]
  submitLoop: [values: LoopDraftValues]
}>()
const firstField = ref<globalThis.HTMLInputElement | null>(null)
const name = ref(props.draft.type === 'agent-action' ? 'New Agent Action' : 'New Loop')
const model = ref('')
const goal = ref('')
const maxTurns = ref(10)
const variableId = ref(props.variables[0]?.id ?? '')
const operator = ref<LoopDraftValues['operator']>('eq')
const comparisonValue = ref('')

onMounted(() => { void nextTick(() => firstField.value?.focus()) })
function submit() {
  if (props.draft.type === 'agent-action') {
    emit('submitAgentAction', { name: name.value, model: model.value, goal: goal.value })
  } else {
    emit('submitLoop', { name: name.value, maxTurns: maxTurns.value, variableId: variableId.value, operator: operator.value, comparisonValue: comparisonValue.value })
  }
}
</script>

<template>
  <div class="workflow-draft-backdrop" @mousedown.self="emit('close')">
    <form class="workflow-draft-dialog" role="dialog" aria-modal="true" :aria-labelledby="`draft-title-${draft.type}`" @submit.prevent="submit" @keydown.esc="emit('close')">
      <header><div><p class="workflow-eyebrow">CREATE NODE</p><h2 :id="`draft-title-${draft.type}`">{{ draft.type === 'agent-action' ? 'Agent Action' : 'Loop' }}</h2></div><button type="button" aria-label="Close" @click="emit('close')">×</button></header>
      <label>Name<input ref="firstField" v-model="name" autocomplete="off" /></label>
      <template v-if="draft.type === 'agent-action'">
        <label>Model<input v-model="model" placeholder="e.g. gpt-4.1" autocomplete="off" /></label>
        <label>Goal<textarea v-model="goal" rows="3" placeholder="Describe what this action should accomplish" /></label>
      </template>
      <template v-else>
        <label>Agent variable<select v-model="variableId"><option v-for="variable in variables" :key="variable.id" :value="variable.id">{{ variable.displayName }} · {{ variable.dataType }}</option></select></label>
        <div class="workflow-draft-row"><label>Exit operator<select v-model="operator"><option value="eq">Equals</option><option value="neq">Does not equal</option><option value="gt">Greater than</option><option value="gte">Greater than or equal</option><option value="lt">Less than</option><option value="lte">Less than or equal</option></select></label><label>Comparison value<input v-model="comparisonValue" autocomplete="off" /></label></div>
        <label>Maximum turns<input v-model.number="maxTurns" type="number" min="1" step="1" /></label>
      </template>
      <p v-if="error" class="workflow-draft-error" role="alert">{{ error }}</p>
      <footer><button type="button" @click="emit('close')">Cancel</button><button type="submit" class="primary-action">Create {{ draft.type === 'agent-action' ? 'Agent Action' : 'Loop' }}</button></footer>
    </form>
  </div>
</template>
