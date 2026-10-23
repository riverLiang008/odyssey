<script setup lang="ts">
import type { BranchPanelSession } from './branchPanelSession'
import BranchConfigPanel from './BranchConfigPanel.vue'
import ToolSelect, { type ToolSelectOption } from './ToolSelect.vue'
import type { BranchEditIntent } from '@/domain/workflow/branchDrafts'
import { computed, ref, watch } from 'vue'
import { jsonValueSchema, type AgentReusableTool, type AgentVariable, type JsonValue, type KnowledgeSpaceSummary, type LoopBodyNode, type LoopNode, type UUID, type WorkflowEdge, type WorkflowNode } from '@odyssey/schemas'
import {
  evaluateWorkflowResourceDrop,
  parseWorkflowResourceDragPayload,
  serializeWorkflowResourceDragPayload,
  WORKFLOW_RESOURCE_DRAG_MIME,
  type WorkflowResourceDropErrorCode,
} from '@/canvas/workflow'

const props = defineProps<{ branchDraftCache?: Map<UUID, BranchPanelSession>; branchEdges?: WorkflowEdge[]; branchTargetNames?: Readonly<Record<string, string>>; branchBlocked?: boolean; branchError?: string | null; branchCreating?: boolean; node: WorkflowNode | LoopBodyNode | null; edge: WorkflowEdge | null; tools?: AgentReusableTool[]; variables?: AgentVariable[]; knowledgeSpaces?: KnowledgeSpaceSummary[]; knowledgeStatus?: 'idle' | 'loading' | 'ready' | 'error'; loopExpanded?: boolean; readOnly?: boolean }>()
const emit = defineEmits<{ branchDirtyChange: []; applyBranch: [intent: BranchEditIntent]; close: []; openLoop: [loopNodeId: string]; updateLoop: [details: Pick<LoopNode, 'name'> & Pick<LoopNode['config'], 'maxTurns' | 'exitCondition'>]; bindTool: [toolId: UUID]; unbindTool: [toolId: UUID]; bindKnowledgeSpace: [knowledgeSpaceId: UUID]; unbindKnowledgeSpace: [knowledgeSpaceId: UUID]; rejectResource: [reason: WorkflowResourceDropErrorCode] }>()
const loopName = ref('')
const loopMaxTurns = ref('1')
const loopVariableId = ref('')
const loopOperator = ref<LoopNode['config']['exitCondition']['operator']>('eq')
const loopValue = ref('')
const loopError = ref<string | null>(null)
const selectedLoopVariable = computed(() => props.variables?.find((variable) => variable.id === loopVariableId.value) ?? null)
const loopVariableOptions = computed<readonly ToolSelectOption[]>(() => [
  { value: '', label: 'Choose a Variable', disabled: true },
  ...(props.variables ?? []).map((variable) => ({ value: variable.id, label: variable.displayName })),
])
const loopOperatorOptions: readonly ToolSelectOption[] = [
  { value: 'eq', label: 'Equals (=)' },
  { value: 'neq', label: 'Does not equal (≠)' },
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'gte', label: 'Greater than or equal (≥)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'lte', label: 'Less than or equal (≤)' },
]

function selectLoopOperator(value: string) {
  switch (value) {
    case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte':
      loopOperator.value = value
  }
}

watch(() => props.node, (node) => {
  if (node?.type !== 'loop') return
  loopName.value = node.name
  loopMaxTurns.value = String(node.config.maxTurns)
  loopVariableId.value = node.config.exitCondition.variableId
  loopOperator.value = node.config.exitCondition.operator
  loopValue.value = typeof node.config.exitCondition.value === 'string'
    ? node.config.exitCondition.value
    : JSON.stringify(node.config.exitCondition.value)
  loopError.value = null
}, { immediate: true })

function parseLoopValue(): JsonValue | null {
  const variable = selectedLoopVariable.value
  if (!variable) return null
  if (variable.dataType === 'string') return loopValue.value
  if (variable.dataType === 'number') {
    const parsed = Number(loopValue.value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (variable.dataType === 'boolean') {
    if (loopValue.value === 'true') return true
    if (loopValue.value === 'false') return false
    return null
  }
  try {
    const parsed = jsonValueSchema.safeParse(JSON.parse(loopValue.value))
    return parsed.success ? parsed.data : null
  } catch { return null }
}

function submitLoop() {
  if (props.readOnly) return
  if (props.node?.type !== 'loop') return
  const maxTurns = Number(loopMaxTurns.value)
  const value = parseLoopValue()
  if (!loopName.value.trim()) { loopError.value = 'Name is required.'; return }
  if (!Number.isInteger(maxTurns) || maxTurns <= 0) { loopError.value = 'Maximum turns must be a positive integer.'; return }
  if (!loopVariableId.value || value === null) { loopError.value = 'Choose a Variable and enter a compatible value.'; return }
  loopError.value = null
  emit('updateLoop', {
    name: loopName.value.trim(),
    maxTurns,
    exitCondition: { kind: 'variable_comparison', variableId: loopVariableId.value as UUID, operator: loopOperator.value, value },
  })
}
function toolLabel(toolId: UUID) { return props.tools?.find((tool) => tool.id === toolId)?.name ?? 'Unavailable Tool' }
function knowledgeLabel(id: UUID) { return props.knowledgeSpaces?.find((space) => space.id === id)?.name ?? 'Unavailable Knowledge Space' }
function isKnowledgeSelectable(space: KnowledgeSpaceSummary) { return ['ready', 'syncing'].includes(space.lifecycleStatus) && ['healthy', 'needs_review'].includes(space.graphStatus) }
function dropTool(event: globalThis.DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (props.readOnly) return
  const payload = parseWorkflowResourceDragPayload(event.dataTransfer?.getData(WORKFLOW_RESOURCE_DRAG_MIME) ?? '')
  if (!payload || props.node?.type !== 'agent_action') { emit('rejectResource', 'INVALID_RESOURCE_TARGET'); return }
  const evaluation = evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-tools', nodeId: props.node.id }, {
    node: props.node,
    availableReusableToolIds: new Set(props.tools?.map((tool) => tool.id) ?? []),
  })
  if (evaluation.status !== 'valid') { emit('rejectResource', evaluation.reason); return }
  if (evaluation.action.type !== 'bind-reusable-tool') { emit('rejectResource', 'WRONG_RESOURCE_TYPE'); return }
  emit('bindTool', evaluation.action.reusableToolId)
}
function dropKnowledgeSpace(event: globalThis.DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (props.readOnly) return
  const payload = parseWorkflowResourceDragPayload(event.dataTransfer?.getData(WORKFLOW_RESOURCE_DRAG_MIME) ?? '')
  if (!payload || props.node?.type !== 'agent_action') { emit('rejectResource', 'INVALID_RESOURCE_TARGET'); return }
  const selectableIds = new Set(props.knowledgeSpaces?.filter(isKnowledgeSelectable).map((space) => space.id) ?? [])
  const evaluation = evaluateWorkflowResourceDrop(payload, { kind: 'agent-action-knowledge-spaces', nodeId: props.node.id }, { node: props.node, availableReusableToolIds: new Set(), availableKnowledgeSpaceIds: selectableIds })
  if (evaluation.status === 'valid' && evaluation.action.type === 'bind-knowledge-space') emit('bindKnowledgeSpace', evaluation.action.knowledgeSpaceId)
  else if (evaluation.status !== 'valid') emit('rejectResource', evaluation.reason)
}
function startToolDrag(event: globalThis.DragEvent, toolId: UUID) {
  if (props.readOnly) return
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(WORKFLOW_RESOURCE_DRAG_MIME, serializeWorkflowResourceDragPayload(toolId))
}
function startKnowledgeDrag(event: globalThis.DragEvent, space: KnowledgeSpaceSummary) {
  if (props.readOnly) return
  if (!event.dataTransfer || !isKnowledgeSelectable(space)) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(WORKFLOW_RESOURCE_DRAG_MIME, serializeWorkflowResourceDragPayload(space.id, 'knowledge-space'))
}
</script>

<template>
  <BranchConfigPanel v-if="node?.type === 'branch'" :key="node.id" :draft-cache="branchDraftCache" :node="node" :edges="branchEdges ?? []" :variables="variables ?? []" :target-names="branchTargetNames" :read-only="readOnly" :blocked="branchBlocked" :error="branchError" :creating="branchCreating" @dirty-change="emit('branchDirtyChange')" @apply="emit('applyBranch', $event)" @close="emit('close')" />
  <aside v-else-if="node?.type !== 'start' && node?.type !== 'end' && node?.type !== 'loop_start' && node?.type !== 'loop_end'" class="workflow-side-panel" aria-label="Workflow inspector">
    <div class="side-panel-heading"><div><p class="workflow-eyebrow">INSPECTOR</p><h2>{{ node?.name ?? (edge ? 'Route' : 'Nothing selected') }}</h2></div><button type="button" aria-label="Close inspector" @click="$emit('close')">×</button></div>
    <template v-if="node">
      <dl v-if="node.type !== 'loop'"><dt>Node type</dt><dd>{{ node.type.replace('_', ' ') }}</dd><dt>Identity</dt><dd>{{ node.id }}</dd></dl>
      <form v-if="node.type === 'loop'" class="loop-config-form" @submit.prevent="submitLoop">
        <p class="inspector-note">Structured iteration · variable comparison + maximum turns</p>
        <label>Name<input v-model="loopName" type="text" autocomplete="off" :disabled="readOnly" /></label>
        <p class="workflow-eyebrow">EXECUTION SETTINGS</p>
        <label>Maximum turns<input v-model="loopMaxTurns" type="number" min="1" step="1" inputmode="numeric" :disabled="readOnly" /></label>
        <p class="workflow-eyebrow">EXIT CONDITION</p>
        <label>Variable<ToolSelect v-model="loopVariableId" :options="loopVariableOptions" control-label="Exit condition Variable" :disabled="readOnly" /></label>
        <div class="loop-condition-row">
          <label>Operator<ToolSelect :model-value="loopOperator" :options="loopOperatorOptions" control-label="Exit condition Operator" :disabled="readOnly" @update:model-value="selectLoopOperator" /></label>
          <label>Value<input v-model="loopValue" type="text" :disabled="readOnly" /></label>
        </div>
        <p v-if="loopError" class="field-error" role="alert">{{ loopError }}</p>
        <button type="submit" class="primary-panel-button" :disabled="readOnly">Apply Loop settings</button>
        <div class="loop-body-summary"><strong>{{ node.config.body.graph.nodes.length }} nodes · {{ node.config.body.graph.edges.length }} edges</strong><small>The Loop body is editable directly on the workflow canvas.</small></div>
      </form>
      <section v-else-if="node.type === 'agent_action'" class="agent-action-resource-config">
        <h3>Tools</h3>
        <div class="compact-resource-browser"><button v-for="tool in tools" :key="tool.id" type="button" :draggable="!readOnly" :disabled="readOnly || node.config.reusableToolIds.includes(tool.id)" @dragstart="startToolDrag($event, tool.id)" @click="$emit('bindTool', tool.id)">{{ tool.name }}<small>{{ node.config.reusableToolIds.includes(tool.id) ? 'Added' : readOnly ? 'Available in Configure mode' : 'Drag or click to add' }}</small></button></div>
        <div class="resource-drop-zone" @dragover.prevent.stop @drop="dropTool">Drop a reusable Tool here</div>
        <ul v-if="node.config.reusableToolIds.length"><li v-for="toolId in node.config.reusableToolIds" :key="toolId"><span>{{ toolLabel(toolId) }}</span><button type="button" :disabled="readOnly" :aria-label="`Remove ${toolLabel(toolId)}`" @click="$emit('unbindTool', toolId)">×</button></li></ul>
        <h3>Knowledge Spaces</h3>
        <p v-if="knowledgeStatus === 'loading'" class="inspector-note">Loading Knowledge Spaces…</p>
        <p v-else-if="knowledgeStatus === 'error'" class="inspector-note">Knowledge Spaces could not be loaded.</p>
        <p v-else-if="!knowledgeSpaces?.length" class="inspector-note">No Knowledge Spaces are available in this Workspace.</p>
        <div v-else class="compact-resource-browser"><button v-for="space in knowledgeSpaces" :key="space.id" type="button" :draggable="!readOnly && isKnowledgeSelectable(space)" :disabled="readOnly || !isKnowledgeSelectable(space) || node.config.knowledgeSpaceIds.includes(space.id)" @dragstart="startKnowledgeDrag($event, space)" @click="$emit('bindKnowledgeSpace', space.id)">{{ space.name }}<small>{{ node.config.knowledgeSpaceIds.includes(space.id) ? 'Added' : readOnly ? 'Available in Configure mode' : isKnowledgeSelectable(space) ? 'Drag or click to add' : `${space.lifecycleStatus} · ${space.graphStatus}` }}</small></button></div>
        <div class="resource-drop-zone" @dragover.prevent.stop @drop="dropKnowledgeSpace">Drop a Knowledge Space here</div>
        <ul v-if="node.config.knowledgeSpaceIds.length"><li v-for="spaceId in node.config.knowledgeSpaceIds" :key="spaceId"><span>{{ knowledgeLabel(spaceId) }}</span><button type="button" :disabled="readOnly" :aria-label="`Remove ${knowledgeLabel(spaceId)}`" @click="$emit('unbindKnowledgeSpace', spaceId)">×</button></li></ul>
      </section>
    </template>
    <template v-else-if="edge">
      <dl><dt>Source</dt><dd>{{ edge.sourceNodeId }}</dd><dt>Target</dt><dd>{{ edge.targetNodeId }}</dd></dl>
    </template>
    <p v-else class="inspector-note">Select a node or route to inspect it. Node configuration forms continue in M2.8.</p>
  </aside>
</template>
