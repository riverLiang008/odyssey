<script setup lang="ts">
import { onUnmounted } from 'vue'
import {
  serializeWorkflowNodeDragPayload,
  WORKFLOW_NODE_DRAG_MIME,
  type WorkflowPaletteNodeType,
} from '@/canvas/workflow'

const emit = defineEmits<{
  create: [nodeType: WorkflowPaletteNodeType]
  drop: [nodeType: WorkflowPaletteNodeType, point: { clientX: number; clientY: number }]
  collapse: [collapsed: boolean]
}>()
const props = defineProps<{ disabled?: boolean; canCreateLoop?: boolean; loopDisabledReason?: string; collapsed?: boolean }>()

const groups = [
  { label: 'LOGIC', items: [
    { type: 'branch' as const, name: 'Branch', description: 'Route by variables', enabled: true },
    { type: 'loop' as const, name: 'Loop' },
  ] },
  { label: 'ACTION', items: [
    { type: 'agent_action' as const, name: 'Agent Action', description: 'Model-driven action', enabled: true },
    { type: 'task' as const, name: 'Task', description: 'Deterministic tools', enabled: true },
  ] },
]

function isEnabled(item: (typeof groups)[number]['items'][number]) {
  return item.type === 'loop' ? Boolean(props.canCreateLoop) : item.enabled
}

function itemDescription(item: (typeof groups)[number]['items'][number]) {
  if (item.type !== 'loop') return item.description
  return props.canCreateLoop ? 'Structured iteration' : (props.loopDisabledReason ?? 'Create an Agent Variable first')
}

function startDrag(event: globalThis.DragEvent, type: WorkflowPaletteNodeType, enabled: boolean) {
  if (props.disabled || !enabled || !event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  const payload = serializeWorkflowNodeDragPayload(type)
  event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, payload)
  event.dataTransfer.setData('text/plain', payload)
}

let pointerDrag: {
  nodeType: WorkflowPaletteNodeType
  startX: number
  startY: number
  dragged: boolean
} | null = null
let suppressNextClick = false

function pointerMove(event: globalThis.PointerEvent) {
  if (!pointerDrag) return
  if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) >= 6) {
    pointerDrag.dragged = true
  }
}

function finishPointerDrag(event: globalThis.PointerEvent) {
  const drag = pointerDrag
  pointerDrag = null
  globalThis.window.removeEventListener('pointermove', pointerMove)
  globalThis.window.removeEventListener('pointerup', finishPointerDrag)
  globalThis.window.removeEventListener('pointercancel', cancelPointerDrag)
  if (!drag?.dragged) return
  suppressNextClick = true
  emit('drop', drag.nodeType, { clientX: event.clientX, clientY: event.clientY })
  globalThis.setTimeout(() => { suppressNextClick = false }, 0)
}

function cancelPointerDrag() {
  pointerDrag = null
  globalThis.window.removeEventListener('pointermove', pointerMove)
  globalThis.window.removeEventListener('pointerup', finishPointerDrag)
  globalThis.window.removeEventListener('pointercancel', cancelPointerDrag)
}

function startPointerDrag(event: globalThis.PointerEvent, type: WorkflowPaletteNodeType, enabled: boolean) {
  if (props.disabled || !enabled || event.button !== 0) return
  pointerDrag = { nodeType: type, startX: event.clientX, startY: event.clientY, dragged: false }
  globalThis.window.addEventListener('pointermove', pointerMove)
  globalThis.window.addEventListener('pointerup', finishPointerDrag)
  globalThis.window.addEventListener('pointercancel', cancelPointerDrag)
}

function activate(type: WorkflowPaletteNodeType) {
  if (props.disabled) return
  if (suppressNextClick) { suppressNextClick = false; return }
  emit('create', type)
}
onUnmounted(cancelPointerDrag)
</script>

<template>
  <aside class="workflow-node-palette" :class="{ 'is-read-only-mode': disabled, 'is-collapsed': collapsed }" aria-label="Workflow node palette">
    <header class="palette-heading">
      <p v-if="!collapsed" class="workflow-eyebrow">WORKFLOW NODES</p>
      <button type="button" class="palette-collapse" :aria-label="collapsed ? 'Expand Workflow nodes' : 'Collapse Workflow nodes'" :aria-expanded="!collapsed" @click="emit('collapse', !collapsed)">{{ collapsed ? '›' : '‹' }}</button>
    </header>
    <div v-if="collapsed" class="compact-palette" aria-label="Workflow node shortcuts">
      <section v-for="group in groups" :key="group.label" class="compact-palette-group" :aria-label="group.label">
        <button
          v-for="item in group.items"
          :key="item.type"
          type="button"
          class="compact-palette-item"
          :class="[`is-${item.type}`, { 'is-disabled': !isEnabled(item) }]"
          :disabled="disabled || !isEnabled(item)"
          :aria-label="isEnabled(item) ? `Add ${item.name}` : itemDescription(item)"
          :data-tooltip="isEnabled(item) ? item.name : itemDescription(item)"
          @click="activate(item.type)"
          @pointerdown="startPointerDrag($event, item.type, isEnabled(item))"
          @dragstart="startDrag($event, item.type, isEnabled(item))"
        >
          <svg v-if="item.type === 'branch'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="12" cy="19" r="2" /><path d="M6 7v3c0 2 1.5 3 3.5 3H12m6-6v3c0 2-1.5 3-3.5 3H12m0 0v4" /></svg>
          <svg v-else-if="item.type === 'loop'" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8A7 7 0 0 0 6 6.5L3.5 9M5.5 16A7 7 0 0 0 18 17.5l2.5-2.5M3.5 5v4h4M20.5 19v-4h-4" /></svg>
          <svg v-else-if="item.type === 'agent_action'" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="3" /><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8" /></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 2.5 2.5L16 9" /></svg>
          <i aria-hidden="true" />
        </button>
      </section>
      <span class="compact-palette-grip" aria-hidden="true"><i /><i /><i /><i /></span>
    </div>
    <template v-else>
      <section v-for="group in groups" :key="group.label" class="palette-group">
        <p class="palette-group-label">{{ group.label }}</p>
        <button
          v-for="item in group.items"
          :key="item.type"
          type="button"
          class="palette-item"
          :class="[`is-${item.type}`, { 'is-disabled': !isEnabled(item) }]"
          :draggable="false"
          :disabled="disabled || !isEnabled(item)"
          :title="isEnabled(item) ? `Add ${item.name}` : itemDescription(item)"
          @click="activate(item.type)"
          @pointerdown="startPointerDrag($event, item.type, isEnabled(item))"
          @dragstart="startDrag($event, item.type, isEnabled(item))"
        >
          <i aria-hidden="true" />
          <span><strong>{{ item.name }}</strong><small>{{ itemDescription(item) }}</small></span>
        </button>
      </section>
      <div class="palette-note"><strong>DAG only</strong><span>Start and End are fixed. Branch and Loop own structured control flow.</span></div>
    </template>
  </aside>
</template>
