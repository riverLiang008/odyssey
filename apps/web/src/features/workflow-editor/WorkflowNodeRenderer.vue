<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { AgentVariable, AgentReusableTool, UUID } from '@odyssey/schemas'
import {
  parseWorkflowResourceDragPayload,
  WORKFLOW_RESOURCE_DRAG_MIME,
  type WorkflowCanvasNodeData,
  type WorkflowResourceDragPayload,
  type WorkflowResourceDropTarget,
} from '@/canvas/workflow'

const props = defineProps<NodeProps<WorkflowCanvasNodeData> & {
  variables?: readonly AgentVariable[]
  configureExpanded: boolean
  tools?: readonly AgentReusableTool[]
  activeResourceDrag?: WorkflowResourceDragPayload | null
  resourceDropState?: 'idle' | 'valid' | 'invalid' | 'duplicate' | 'unavailable'
  resourceDropNodeId?: string | null
}>()
const emit = defineEmits<{
  editTool: [nodeId: UUID, stepId: UUID]
  changeTool: [nodeId: UUID, stepId: UUID, operation: 'delete' | 'up' | 'down']
  resourceEnter: [payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget]
  resourceLeave: [target: WorkflowResourceDropTarget]
  resourceDrop: [payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget]
  unbindTool: [nodeId: UUID, reusableToolId: UUID]
  updateAgentAction: [nodeId: UUID, details: { name: string; model: string; goal: string }]
}>()
const node = computed(() => props.data.node)
const isEditingName = ref(false)
const nameDraft = ref('')
const nameInput = ref<globalThis.HTMLInputElement | null>(null)
const protectedNode = computed(() => ['start', 'end', 'loop_start', 'loop_end'].includes(node.value.type))
const subtitle = computed(() => node.value.type === 'agent_action'
  ? node.value.config.model
  : node.value.type === 'task'
    ? `${node.value.config.steps.length} tool steps`
    : node.value.type === 'loop'
      ? `Max turns · ${node.value.config.maxTurns}`
      : node.value.type === 'branch'
        ? `${props.data.branchHandles.length} routes`
        : protectedNode.value ? 'Fixed boundary' : '')

function valueSourceSummary(): string {
  if (node.value.type !== 'agent_action') return ''
  const goal = node.value.config.goal
  if (goal.kind === 'variable') return `Variable · ${goal.variableId.slice(0, 8)}`
  if (goal.kind === 'template') return goal.segments.map((segment) => segment.kind === 'text' ? segment.text : `{${segment.variableId.slice(0, 8)}}`).join('')
  if (typeof goal.value === 'string') return goal.value
  return JSON.stringify(goal.value)
}

function stepLabel(index: number): string {
  if (node.value.type !== 'task') return ''
  const step = node.value.config.steps[index]
  if (!step) return ''
  return step.label?.trim() || step.kind.split('_').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
}

function stepOutput(index: number): string {
  if (node.value.type !== 'task') return ''
  const step = node.value.config.steps[index]
  if (!step) return ''
  const targetId = step.kind === 'set_variable' ? step.configuration.targetVariableId : step.outputMapping.targetVariableId
  const local = node.value.config.localVariables.find((v) => v.id === targetId)
  const agent = props.variables?.find((v) => v.id === targetId)
  const target = local ? `task.${local.key}` : agent ? `agent.${agent.key}` : 'Unavailable variable'
  return step.kind === 'set_variable' ? `Write: ${target}` : `${step.outputMapping.sourceKey} → ${target}`
}

function loopExitSummary(): string {
  if (node.value.type !== 'loop') return ''
  const exit = node.value.config.exitCondition
  return `${exit.variableId.slice(0, 8)} · ${exit.operator} · ${JSON.stringify(exit.value)}`
}

const toolById = computed(() => new Map((props.tools ?? []).map((tool) => [tool.id, tool])))
const modelOptions = computed(() => [...new Set([node.value.type === 'agent_action' ? node.value.config.model : '', 'gpt-5', 'gpt-4.1', 'gpt-4o'].filter(Boolean))])
function boundToolName(toolId: UUID): string { return toolById.value.get(toolId)?.name ?? 'Unavailable Tool' }
async function beginNameEdit() {
  if (node.value.type !== 'agent_action') return
  nameDraft.value = node.value.name
  isEditingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}
function finishNameEdit(commit: boolean) {
  if (node.value.type !== 'agent_action') return
  const nextName = nameDraft.value.trim()
  isEditingName.value = false
  if (!commit || !nextName || nextName === node.value.name) return
  const currentGoal = node.value.config.goal.kind === 'literal' && typeof node.value.config.goal.value === 'string'
    ? node.value.config.goal.value
    : valueSourceSummary()
  emit('updateAgentAction', node.value.id, { name: nextName, model: node.value.config.model, goal: currentGoal })
}
function updateAgentActionField(field: 'name' | 'model' | 'goal', event: globalThis.Event) {
  if (node.value.type !== 'agent_action' || !(event.target instanceof globalThis.HTMLInputElement || event.target instanceof globalThis.HTMLSelectElement)) return
  const currentGoal = node.value.config.goal.kind === 'literal' && typeof node.value.config.goal.value === 'string'
    ? node.value.config.goal.value
    : valueSourceSummary()
  emit('updateAgentAction', node.value.id, {
    name: field === 'name' ? event.target.value : node.value.name,
    model: field === 'model' ? event.target.value : node.value.config.model,
    goal: field === 'goal' ? event.target.value : currentGoal,
  })
}
function target(kind: 'agent-action-tools' | 'task-tool-sequence'): WorkflowResourceDropTarget {
  return { kind, nodeId: node.value.id }
}
function payloadFromEvent(event: globalThis.DragEvent): WorkflowResourceDragPayload | null {
  if (props.activeResourceDrag) return props.activeResourceDrag
  return parseWorkflowResourceDragPayload(event.dataTransfer?.getData(WORKFLOW_RESOURCE_DRAG_MIME) || event.dataTransfer?.getData('text/plain') || '')
}
function resourceEnter(event: globalThis.DragEvent, kind: 'agent-action-tools' | 'task-tool-sequence') {
  const payload = payloadFromEvent(event)
  if (!payload) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  emit('resourceEnter', payload, target(kind))
}
function resourceLeave(event: globalThis.DragEvent, kind: 'agent-action-tools' | 'task-tool-sequence') {
  const current = event.currentTarget
  if (current instanceof globalThis.Element && event.relatedTarget instanceof globalThis.Node && current.contains(event.relatedTarget)) return
  emit('resourceLeave', target(kind))
}
function resourceDrop(event: globalThis.DragEvent, kind: 'agent-action-tools' | 'task-tool-sequence') {
  const payload = payloadFromEvent(event)
  if (!payload) return
  event.preventDefault()
  event.stopPropagation()
  emit('resourceDrop', payload, target(kind))
}
function targetStateClass() {
  if (props.resourceDropNodeId !== node.value.id || !props.resourceDropState || props.resourceDropState === 'idle') return ''
  return `is-drop-${props.resourceDropState}`
}
function dropStatusText(): string {
  if (props.resourceDropNodeId !== node.value.id) return ''
  if (props.resourceDropState === 'valid') return 'Drop to add'
  if (props.resourceDropState === 'duplicate') return 'Already added'
  if (props.resourceDropState === 'unavailable') return 'Tool unavailable'
  if (props.resourceDropState === 'invalid') return 'Not available here'
  return ''
}

</script>

<template>
  <article class="workflow-node-card" :class="[`is-${node.type}`, { 'is-protected': protectedNode, 'is-selected': selected, 'is-configure-expanded': configureExpanded && !protectedNode }]">
    <Handle v-if="node.type !== 'start' && node.type !== 'loop_start'" type="target" :position="Position.Left" class="workflow-handle" />
    <template v-if="protectedNode">
      <strong>{{ node.name }}</strong>
    </template>
    <template v-else>
      <span class="node-accent" aria-hidden="true" />
      <strong v-if="!(configureExpanded && node.type === 'agent_action')">{{ node.name }}</strong>
      <div v-else class="node-name-editor nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop>
        <button v-if="!isEditingName" type="button" aria-label="Edit action name" @click="beginNameEdit">AGENT ACTION · {{ node.name }}</button>
        <input v-else :id="`name-${node.id}`" ref="nameInput" v-model="nameDraft" aria-label="Action name" @blur="finishNameEdit(true)" @keydown.enter.prevent="finishNameEdit(true)" @keydown.escape.prevent="finishNameEdit(false)" />
      </div>
      <small>{{ subtitle }}</small>
      <dl v-if="configureExpanded && node.type === 'agent_action'" class="node-config-preview">
        <div class="node-config-field nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop><dt><label :for="`model-${node.id}`">Model</label></dt><dd><select :id="`model-${node.id}`" :value="node.config.model" @change="updateAgentActionField('model', $event)"><option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option></select></dd></div>
        <div class="node-config-field nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop><dt><label :for="`goal-${node.id}`">Goal</label></dt><dd><input :id="`goal-${node.id}`" :value="valueSourceSummary()" placeholder="Describe what this action should accomplish" @change="updateAgentActionField('goal', $event)" /></dd></div>
        <div class="node-config-resource"><dt>Knowledge Spaces</dt><dd>{{ node.config.knowledgeSpaceIds.length ? `${node.config.knowledgeSpaceIds.length} linked` : '+ Drop Knowledge Space' }}</dd></div>
        <div class="node-config-resource is-toolbox nodrag nopan" :class="targetStateClass()" role="group" data-no-node-inspector="true" data-workflow-resource-drop-target="agent-action-tools" :data-workflow-node-id="node.id" :aria-label="`Drop a Tool into ${node.name} Toolbox`" @click.stop @pointerdown.stop @dragenter="resourceEnter($event, 'agent-action-tools')" @dragover="resourceEnter($event, 'agent-action-tools')" @dragleave="resourceLeave($event, 'agent-action-tools')" @drop="resourceDrop($event, 'agent-action-tools')">
          <dt>Toolbox</dt>
          <dd class="toolbox-content">
            <button v-for="toolId in node.config.reusableToolIds" :key="toolId" type="button" class="tool-chip nodrag nopan" :title="`Remove ${boundToolName(toolId)}`" @click.stop="emit('unbindTool', node.id, toolId)">{{ boundToolName(toolId) }} <span aria-hidden="true">×</span></button>
            <span class="toolbox-drop-hint">+ Drop Tool</span>
            <span v-if="dropStatusText()" class="resource-drop-status" role="status">{{ dropStatusText() }}</span>
          </dd>
        </div>
      </dl>
      <section v-else-if="configureExpanded && node.type === 'task'" class="node-config-detail node-config-task nodrag nopan" :class="targetStateClass()" role="group" data-no-node-inspector="true" data-workflow-resource-drop-target="task-tool-sequence" :data-workflow-node-id="node.id" :aria-label="`Drop a Tool into ${node.name} sequence`" @click.stop @pointerdown.stop @dragenter="resourceEnter($event, 'task-tool-sequence')" @dragover="resourceEnter($event, 'task-tool-sequence')" @dragleave="resourceLeave($event, 'task-tool-sequence')" @drop="resourceDrop($event, 'task-tool-sequence')">
        <p>Deterministic sequence · drag Tool to add a step</p>
        <ol v-if="node.config.steps.length">
          <li v-for="(step, index) in node.config.steps" :key="step.id"><span>{{ index + 1 }}</span><button type="button" @click="emit('editTool', node.id, step.id)">{{ stepLabel(index) }}</button><small>{{ stepOutput(index) }}</small><button type="button" :disabled="index === 0" aria-label="Move step up" @click="emit('changeTool', node.id, step.id, 'up')">↑</button><button type="button" :disabled="index === node.config.steps.length - 1" aria-label="Move step down" @click="emit('changeTool', node.id, step.id, 'down')">↓</button><button type="button" aria-label="Delete step" @click="emit('changeTool', node.id, step.id, 'delete')">×</button></li>
        </ol>
        <div v-else class="node-config-empty">+ Drop Tool to create the first step</div>
        <p v-if="dropStatusText()" class="resource-drop-status" role="status">{{ dropStatusText() }}</p>
      </section>
      <section v-else-if="configureExpanded && node.type === 'branch'" class="node-config-detail node-config-branch">
        <p>Route by variables · {{ node.config.cases.length + 1 }} routes</p>
        <ul>
          <li v-for="branchCase in node.config.cases" :key="branchCase.id"><strong>{{ branchCase.label }}</strong><small>{{ branchCase.conditions.length }} conditions · match all</small></li>
          <li><strong>{{ node.config.defaultCase.label }}</strong><small>Default route</small></li>
        </ul>
      </section>
      <section v-else-if="configureExpanded && node.type === 'loop'" class="node-config-detail node-config-loop">
        <div><span>Max turns</span><strong>{{ node.config.maxTurns }}</strong></div>
        <div><span>Exit condition</span><strong>{{ loopExitSummary() }}</strong></div>
        <div><span>Loop body</span><strong>{{ node.config.body.graph.nodes.length }} nodes · {{ node.config.body.graph.edges.length }} edges</strong></div>
      </section>
    </template>
    <template v-if="node.type === 'branch'">
      <Handle
        v-for="(handle, index) in data.branchHandles"
        :id="handle.id"
        :key="handle.id"
        type="source"
        :position="Position.Right"
        class="workflow-handle branch-handle"
        :style="{ top: `${((index + 1) / (data.branchHandles.length + 1)) * 100}%` }"
        :title="handle.label"
      />
    </template>
    <Handle v-else-if="node.type !== 'end' && node.type !== 'loop_end'" type="source" :position="Position.Right" class="workflow-handle" />
  </article>
</template>
