<script setup lang="ts">
import BranchNodeContent from './BranchNodeContent.vue'
import { radii, workflowRouting, workflowBranch } from '@odyssey/design-tokens'
import { computed, nextTick, ref } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { AgentVariable, AgentReusableTool, KnowledgeSpaceSummary, UUID } from '@odyssey/schemas'
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
  readOnly?: boolean
  tools?: readonly AgentReusableTool[]
  knowledgeSpaces?: readonly KnowledgeSpaceSummary[]
  activeResourceDrag?: WorkflowResourceDragPayload | null
  resourceDropState?: 'idle' | 'valid' | 'invalid' | 'duplicate' | 'unavailable'
  resourceDropNodeId?: string | null
  resourceDropTargetKind?: WorkflowResourceDropTarget['kind'] | null
}>()
const emit = defineEmits<{
  editTool: [nodeId: UUID, stepId: UUID]
  changeTool: [nodeId: UUID, stepId: UUID, operation: 'delete' | 'up' | 'down']
  reorderTool: [nodeId: UUID, stepId: UUID, targetIndex: number]
  toolStepContextMenu: [nodeId: UUID, stepId: UUID, point: { x: number; y: number }]
  resourceEnter: [payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget]
  resourceLeave: [target: WorkflowResourceDropTarget]
  resourceDrop: [payload: WorkflowResourceDragPayload, target: WorkflowResourceDropTarget]
  unbindTool: [nodeId: UUID, reusableToolId: UUID]
  unbindKnowledgeSpace: [nodeId: UUID, knowledgeSpaceId: UUID]
  editReusableTool: [nodeId: UUID, reusableToolId: UUID]
  updateAgentAction: [nodeId: UUID, details: { name: string; model: string; goal: string }]
  updateNodeName: [nodeId: UUID, name: string]
  resizeNode: [nodeId: UUID, size: { width: number; height: number }]
}>()
const node = computed(() => props.data.node)
const isEditingName = ref(false)
const nameDraft = ref('')
const nameInput = ref<globalThis.HTMLInputElement | null>(null)
const modelMenuOpen = ref(false)
const modelSelectRoot = ref<globalThis.HTMLDivElement | null>(null)
let resizeCleanup: (() => void) | null = null
function startLoopResize(event: globalThis.PointerEvent) {
  if (!props.data.compoundLoop || !props.configureExpanded) return
  event.preventDefault()
  event.stopPropagation()
  const card = event.currentTarget instanceof globalThis.HTMLElement ? event.currentTarget.closest<globalThis.HTMLElement>('.workflow-node-card') : null
  if (!card) return
  const scale = card.getBoundingClientRect().width / card.offsetWidth || 1
  const start = { x: event.clientX, y: event.clientY, width: card.offsetWidth, height: card.offsetHeight }
  const move = (moveEvent: globalThis.PointerEvent) => emit('resizeNode', node.value.id, {
    width: Math.min(1600, Math.max(420, start.width + (moveEvent.clientX - start.x) / scale)),
    height: Math.min(1200, Math.max(300, start.height + (moveEvent.clientY - start.y) / scale)),
  })
  const stop = () => { globalThis.window.removeEventListener('pointermove', move); globalThis.window.removeEventListener('pointerup', stop); resizeCleanup = null }
  resizeCleanup?.()
  resizeCleanup = stop
  globalThis.window.addEventListener('pointermove', move)
  globalThis.window.addEventListener('pointerup', stop, { once: true })
}
type StepReorderState = { type: 'idle' } | { type: 'dragging'; stepId: UUID; overStepId: UUID; placement: 'before' | 'after' }
const stepReorder = ref<StepReorderState>({ type: 'idle' })
const protectedNode = computed(() => ['start', 'end', 'loop_start', 'loop_end'].includes(node.value.type))
const subtitle = computed(() => node.value.type === 'agent_action'
  ? node.value.config.model
  : node.value.type === 'task'
    ? 'Deterministic sequence · drag Tool to add a step'
    : node.value.type === 'loop'
      ? `Max turns · ${node.value.config.maxTurns}`
      : node.value.type === 'branch'
        ? `${props.data.branchHandles.length} routes`
        : node.value.type === 'end' && node.value.config.binding ? 'Pattern-managed exit'
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
  if (step.kind === 'set_variable') {
    const targetId = step.configuration.targetVariableId
    const local = node.value.config.localVariables.find((v) => v.id === targetId)
    const agent = props.variables?.find((v) => v.id === targetId)
    const target = local ? `task.${local.key}` : agent ? `agent.${agent.key}` : 'Unavailable variable'
    return `Write: ${target}`
  }
  const outputMapping = step.outputMapping
  if (!outputMapping) return 'No output binding'
  const targetId = outputMapping.targetVariableId
  const local = node.value.config.localVariables.find((v) => v.id === targetId)
  const agent = props.variables?.find((v) => v.id === targetId)
  const target = local ? `task.${local.key}` : agent ? `agent.${agent.key}` : 'Unavailable variable'
  return `Output: ${target}`
}

function loopExitSummary(): string {
  if (node.value.type !== 'loop') return ''
  const exit = node.value.config.exitCondition
  return `${exit.variableId.slice(0, 8)} · ${exit.operator} · ${JSON.stringify(exit.value)}`
}

const toolById = computed(() => new Map((props.tools ?? []).map((tool) => [tool.id, tool])))
const knowledgeSpaceById = computed(() => new Map((props.knowledgeSpaces ?? []).map((space) => [space.id, space])))
const modelOptions = computed(() => [...new Set([node.value.type === 'agent_action' ? node.value.config.model : '', 'gpt-5', 'gpt-4.1', 'gpt-4o'].filter(Boolean))])
function selectModel(model: string) {
  if (node.value.type !== 'agent_action') return
  const currentGoal = node.value.config.goal.kind === 'literal' && typeof node.value.config.goal.value === 'string'
    ? node.value.config.goal.value
    : valueSourceSummary()
  modelMenuOpen.value = false
  if (model === node.value.config.model) return
  emit('updateAgentAction', node.value.id, { name: node.value.name, model, goal: currentGoal })
}
function closeModelMenuOnFocusOut(event: globalThis.FocusEvent) {
  if (event.relatedTarget instanceof globalThis.Node && modelSelectRoot.value?.contains(event.relatedTarget)) return
  modelMenuOpen.value = false
}
function boundToolName(toolId: UUID): string { return toolById.value.get(toolId)?.name ?? 'Unavailable Tool' }
function boundKnowledgeSpaceName(knowledgeSpaceId: UUID): string { return knowledgeSpaceById.value.get(knowledgeSpaceId)?.name ?? 'Unavailable Knowledge Space' }
async function beginNameEdit() {
  if (!['agent_action', 'task', 'branch', 'loop'].includes(node.value.type)) return
  nameDraft.value = node.value.name
  isEditingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}
function finishNameEdit(commit: boolean) {
  if (!['agent_action', 'task', 'branch', 'loop'].includes(node.value.type)) return
  const nextName = nameDraft.value.trim()
  isEditingName.value = false
  if (!commit || !nextName || nextName === node.value.name) return
  if (node.value.type !== 'agent_action') {
    emit('updateNodeName', node.value.id, nextName)
    return
  }
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
type NodeResourceDropTargetKind = Exclude<WorkflowResourceDropTarget['kind'], 'canvas-pane'>
function target(kind: NodeResourceDropTargetKind): WorkflowResourceDropTarget {
  return { kind, nodeId: node.value.id }
}
function payloadFromEvent(event: globalThis.DragEvent): WorkflowResourceDragPayload | null {
  if (props.activeResourceDrag) return props.activeResourceDrag
  return parseWorkflowResourceDragPayload(event.dataTransfer?.getData(WORKFLOW_RESOURCE_DRAG_MIME) || event.dataTransfer?.getData('text/plain') || '')
}
function resourceEnter(event: globalThis.DragEvent, kind: NodeResourceDropTargetKind) {
  const payload = payloadFromEvent(event)
  if (!payload) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  emit('resourceEnter', payload, target(kind))
}
function resourceLeave(event: globalThis.DragEvent, kind: NodeResourceDropTargetKind) {
  const current = event.currentTarget
  if (current instanceof globalThis.Element && event.relatedTarget instanceof globalThis.Node && current.contains(event.relatedTarget)) return
  emit('resourceLeave', target(kind))
}
function resourceDrop(event: globalThis.DragEvent, kind: NodeResourceDropTargetKind) {
  const payload = payloadFromEvent(event)
  if (!payload) return
  event.preventDefault()
  event.stopPropagation()
  emit('resourceDrop', payload, target(kind))
}
function targetStateClass(kind: NodeResourceDropTargetKind) {
  if (props.resourceDropNodeId !== node.value.id || props.resourceDropTargetKind !== kind || !props.resourceDropState || props.resourceDropState === 'idle') return ''
  return `is-drop-${props.resourceDropState}`
}
function dropStatusText(kind: NodeResourceDropTargetKind): string {
  if (props.resourceDropNodeId !== node.value.id || props.resourceDropTargetKind !== kind) return ''
  if (props.resourceDropState === 'valid') return 'Drop to add'
  if (props.resourceDropState === 'duplicate') return 'Already added'
  if (props.resourceDropState === 'unavailable') return 'Resource unavailable'
  if (props.resourceDropState === 'invalid') return 'Not available here'
  return ''
}

function openToolStepContextMenu(event: globalThis.MouseEvent, stepId: UUID) {
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget
  const bounds = target instanceof globalThis.HTMLElement ? target.getBoundingClientRect() : null
  emit('toolStepContextMenu', node.value.id, stepId, {
    x: event.clientX || bounds?.left || 0,
    y: event.clientY || bounds?.bottom || 0,
  })
}

function startStepReorder(event: globalThis.DragEvent, stepId: UUID) {
  if (node.value.type !== 'task' || !event.dataTransfer) return
  event.stopPropagation()
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-odyssey-task-tool-step', stepId)
  stepReorder.value = { type: 'dragging', stepId, overStepId: stepId, placement: 'before' }
}
function overStepReorder(event: globalThis.DragEvent, overStepId: UUID) {
  if (stepReorder.value.type !== 'dragging') return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const bounds = event.currentTarget instanceof globalThis.HTMLElement ? event.currentTarget.getBoundingClientRect() : null
  const placement = bounds && event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before'
  stepReorder.value = { ...stepReorder.value, overStepId, placement }
}
function dropStepReorder(event: globalThis.DragEvent, overIndex: number) {
  if (node.value.type !== 'task' || stepReorder.value.type !== 'dragging') return
  event.preventDefault()
  event.stopPropagation()
  const drag = stepReorder.value
  const sourceIndex = node.value.config.steps.findIndex((step) => step.id === drag.stepId)
  const insertionIndex = overIndex + (drag.placement === 'after' ? 1 : 0)
  const targetIndex = sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex
  stepReorder.value = { type: 'idle' }
  if (sourceIndex >= 0 && targetIndex !== sourceIndex) emit('reorderTool', node.value.id, drag.stepId, targetIndex)
}
function finishStepReorder() { stepReorder.value = { type: 'idle' } }
function stepReorderClass(stepId: UUID): string {
  if (stepReorder.value.type !== 'dragging' || stepReorder.value.overStepId !== stepId || stepReorder.value.stepId === stepId) return ''
  return `is-reorder-${stepReorder.value.placement}`
}

</script>

<template>
  <article :data-measured-node-id="node.id" class="workflow-node-card" :style="data.boundaryLabel ? { '--workflow-exit-width': workflowRouting.exitWidth, '--workflow-exit-min-height': workflowRouting.exitMinHeight, '--workflow-exit-padding': workflowRouting.exitPadding, '--workflow-exit-radius': radii.sm } : node.type === 'branch' ? { '--branch-border': workflowBranch.border, '--branch-radius': workflowBranch.radius, '--branch-width': configureExpanded ? workflowBranch.configureWidth : workflowBranch.flowWidth, '--branch-padding': workflowBranch.padding } : undefined" :data-loop-body-id="data.compoundLoop ? node.id : undefined" :class="[`is-${node.type}`, { 'is-protected': protectedNode, 'is-managed-exit': Boolean(data.boundaryLabel), 'is-selected': selected, 'is-configure-expanded': configureExpanded && !protectedNode && !data.compoundLoop, 'is-compound-loop': data.compoundLoop }]">
    <Handle v-if="node.type !== 'start' && node.type !== 'loop_start'" type="target" :position="Position.Left" class="workflow-handle" />
    <template v-if="data.compoundLoop && node.type === 'loop'">
      <header class="compound-loop-header">
        <span class="node-accent" aria-hidden="true" />
        <div>
          <div v-if="configureExpanded && !readOnly" class="node-name-editor nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop>
            <button v-if="!isEditingName" type="button" aria-label="Edit loop name" @click="beginNameEdit">LOOP · {{ node.name }}</button>
            <input v-else :id="`name-${node.id}`" ref="nameInput" v-model="nameDraft" aria-label="loop name" @blur="finishNameEdit(true)" @keydown.enter.prevent="finishNameEdit(true)" @keydown.escape.prevent="finishNameEdit(false)" />
          </div>
          <strong v-else>LOOP · {{ node.name }}</strong>
          <small>Max turns {{ node.config.maxTurns }} · drag Task or Agent Action into this area</small>
        </div>
      </header>
      <div class="compound-loop-body" aria-hidden="true"><span>Loop body</span></div>
      <button v-if="configureExpanded && !readOnly" type="button" class="compound-loop-resize nodrag nopan" aria-label="Resize Loop" data-no-node-inspector="true" @pointerdown="startLoopResize">↘</button>
    </template>
    <template v-else-if="protectedNode">
      <span class="boundary-symbol" aria-hidden="true" />
      <span class="boundary-copy">
        <strong>{{ node.type === 'start' || node.type === 'loop_start' ? 'Start' : 'End' }}</strong>
        <small v-if="data.boundaryLabel">{{ data.boundaryLabel }}</small>
      </span>
    </template>
    <template v-else-if="node.type === 'branch'">
      <span class="node-accent" aria-hidden="true" />
      <BranchNodeContent :node="node" :expanded="configureExpanded" :variables="variables ?? []" :connected-handles="data.branchConnectedHandles ?? []" :read-only="readOnly" @rename="emit('updateNodeName', node.id, $event)" />
    </template>
    <template v-else>
      <span class="node-accent" aria-hidden="true" />
      <strong v-if="!(configureExpanded && ['agent_action', 'task', 'branch'].includes(node.type))">{{ node.name }}</strong>
      <div v-else class="node-name-editor nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop>
        <button v-if="!isEditingName" type="button" :aria-label="`Edit ${node.type.replace('_', ' ')} name`" @click="beginNameEdit">{{ node.type.replace('_', ' ').toUpperCase() }} · {{ node.name }}</button>
        <input v-else :id="`name-${node.id}`" ref="nameInput" v-model="nameDraft" :aria-label="`${node.type.replace('_', ' ')} name`" @blur="finishNameEdit(true)" @keydown.enter.prevent="finishNameEdit(true)" @keydown.escape.prevent="finishNameEdit(false)" />
      </div>
      <small>{{ subtitle }}</small>
      <dl v-if="configureExpanded && node.type === 'agent_action'" class="node-config-preview">
        <div class="node-config-field node-model-field nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop>
          <dt><span :id="`model-label-${node.id}`">Model</span></dt>
          <dd>
            <div ref="modelSelectRoot" class="node-model-select" @focusout="closeModelMenuOnFocusOut" @keydown.escape.stop="modelMenuOpen = false">
              <button
                :id="`model-${node.id}`"
                type="button"
                class="node-model-select-trigger"
                aria-haspopup="listbox"
                :aria-expanded="modelMenuOpen"
                :aria-labelledby="`model-label-${node.id} model-${node.id}`"
                @click="modelMenuOpen = !modelMenuOpen"
              >
                <span>{{ node.config.model }}</span><i aria-hidden="true" />
              </button>
              <div v-if="modelMenuOpen" class="node-model-select-menu" role="listbox" :aria-labelledby="`model-label-${node.id}`">
                <button
                  v-for="model in modelOptions"
                  :key="model"
                  type="button"
                  role="option"
                  :aria-selected="model === node.config.model"
                  :class="{ 'is-selected': model === node.config.model }"
                  @click="selectModel(model)"
                >
                  <span>{{ model }}</span><b v-if="model === node.config.model" aria-hidden="true">✓</b>
                </button>
              </div>
            </div>
          </dd>
        </div>
        <div class="node-config-field nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop><dt><label :for="`goal-${node.id}`">Goal</label></dt><dd><input :id="`goal-${node.id}`" :value="valueSourceSummary()" placeholder="Describe what this action should accomplish" @change="updateAgentActionField('goal', $event)" /></dd></div>
        <div class="node-config-resource is-knowledge-spaces nodrag nopan" :class="targetStateClass('agent-action-knowledge-spaces')" role="group" data-no-node-inspector="true" data-workflow-resource-drop-target="agent-action-knowledge-spaces" :data-workflow-node-id="node.id" :aria-label="`Drop a Knowledge Space into ${node.name}`" @click.stop @pointerdown.stop @dragenter="resourceEnter($event, 'agent-action-knowledge-spaces')" @dragover="resourceEnter($event, 'agent-action-knowledge-spaces')" @dragleave="resourceLeave($event, 'agent-action-knowledge-spaces')" @drop="resourceDrop($event, 'agent-action-knowledge-spaces')">
          <dt>Knowledge Spaces</dt>
          <dd class="toolbox-content">
            <span v-for="knowledgeSpaceId in node.config.knowledgeSpaceIds" :key="knowledgeSpaceId" class="tool-chip knowledge-space-chip nodrag nopan"><span :title="boundKnowledgeSpaceName(knowledgeSpaceId)">{{ boundKnowledgeSpaceName(knowledgeSpaceId) }}</span><button type="button" :aria-label="`Remove ${boundKnowledgeSpaceName(knowledgeSpaceId)}`" @click.stop="emit('unbindKnowledgeSpace', node.id, knowledgeSpaceId)">×</button></span>
            <span class="toolbox-drop-hint">+ Drop Knowledge Space</span>
            <span v-if="dropStatusText('agent-action-knowledge-spaces')" class="resource-drop-status" role="status">{{ dropStatusText('agent-action-knowledge-spaces') }}</span>
          </dd>
        </div>
        <div class="node-config-resource is-toolbox nodrag nopan" :class="targetStateClass('agent-action-tools')" role="group" data-no-node-inspector="true" data-workflow-resource-drop-target="agent-action-tools" :data-workflow-node-id="node.id" :aria-label="`Drop a Tool into ${node.name} Toolbox`" @click.stop @pointerdown.stop @dragenter="resourceEnter($event, 'agent-action-tools')" @dragover="resourceEnter($event, 'agent-action-tools')" @dragleave="resourceLeave($event, 'agent-action-tools')" @drop="resourceDrop($event, 'agent-action-tools')">
          <dt>Toolbox</dt>
          <dd class="toolbox-content">
            <span v-for="toolId in node.config.reusableToolIds" :key="toolId" class="tool-chip nodrag nopan"><button type="button" :title="`Configure ${boundToolName(toolId)}`" @click.stop="emit('editReusableTool', node.id, toolId)">{{ boundToolName(toolId) }}</button><button type="button" :aria-label="`Remove ${boundToolName(toolId)}`" @click.stop="emit('unbindTool', node.id, toolId)">×</button></span>
            <span class="toolbox-drop-hint">+ Drop Tool</span>
            <span v-if="dropStatusText('agent-action-tools')" class="resource-drop-status" role="status">{{ dropStatusText('agent-action-tools') }}</span>
          </dd>
        </div>
      </dl>
      <section v-else-if="configureExpanded && node.type === 'task'" class="node-config-detail node-config-task nodrag nopan" :class="targetStateClass('task-tool-sequence')" role="group" data-no-node-inspector="true" data-workflow-resource-drop-target="task-tool-sequence" :data-workflow-node-id="node.id" :aria-label="`Drop a Tool into ${node.name} sequence`" @click.stop @pointerdown.stop @dragenter="resourceEnter($event, 'task-tool-sequence')" @dragover="resourceEnter($event, 'task-tool-sequence')" @dragleave="resourceLeave($event, 'task-tool-sequence')" @drop="resourceDrop($event, 'task-tool-sequence')">
        <ol v-if="node.config.steps.length">
          <li v-for="(step, index) in node.config.steps" :key="step.id" class="task-tool-step" :class="stepReorderClass(step.id)" @dragover="overStepReorder($event, step.id)" @drop="dropStepReorder($event, index)" @contextmenu="openToolStepContextMenu($event, step.id)">
            <span class="task-tool-step-index">{{ index + 1 }}</span>
            <button type="button" class="task-tool-step-open" @click="emit('editTool', node.id, step.id)" @contextmenu="openToolStepContextMenu($event, step.id)">
              <strong>{{ stepLabel(index) }}</strong>
              <small>{{ stepOutput(index) }}</small>
            </button>
            <span class="task-tool-step-actions" aria-label="Step actions">
              <button type="button" :draggable="!readOnly" aria-label="Drag to reorder step" title="Drag to reorder" @dragstart="startStepReorder($event, step.id)" @dragend="finishStepReorder">⠿</button>
              <button type="button" :disabled="index === 0" aria-label="Move step up" @click="emit('changeTool', node.id, step.id, 'up')">↑</button>
              <button type="button" :disabled="index === node.config.steps.length - 1" aria-label="Move step down" @click="emit('changeTool', node.id, step.id, 'down')">↓</button>
              <button type="button" aria-label="Delete step" @click="emit('changeTool', node.id, step.id, 'delete')">×</button>
            </span>
          </li>
        </ol>
        <div class="task-tool-drop-zone" :class="{ 'is-empty': !node.config.steps.length }">
          <span>{{ node.config.steps.length ? '+ Drop Tool to add another step' : '+ Drop Tool to create the first step' }}</span>
          <strong v-if="dropStatusText('task-tool-sequence')" class="resource-drop-status" role="status">{{ dropStatusText('task-tool-sequence') }}</strong>
        </div>
      </section>
      <section v-else-if="configureExpanded && node.type === 'loop'" class="node-config-detail node-config-loop">
        <div><span>Max turns</span><strong>{{ node.config.maxTurns }}</strong></div>
        <div><span>Exit condition</span><strong>{{ loopExitSummary() }}</strong></div>
        <div><span>Loop body</span><strong>{{ node.config.body.graph.nodes.length }} nodes · {{ node.config.body.graph.edges.length }} edges</strong></div>
      </section>
    </template>
    <Handle v-if="node.type !== 'branch' && node.type !== 'end' && node.type !== 'loop_end'" type="source" :position="Position.Right" class="workflow-handle" />
  </article>
</template>
