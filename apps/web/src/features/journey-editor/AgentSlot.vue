<script setup lang="ts">
import type { SystemCanvasSlotViewModel } from '@/canvas/system'
import type { DropFeedback } from '@/canvas/interaction'
import { ODYSSEY_DRAG_MIME, parseOdysseyDragPayload, serializeOdysseyDragPayload, type DragPayloadParseErrorCode, type MenuAnchor, type PatternDragPayload } from '@/canvas/interaction'
const props = defineProps<{ model: SystemCanvasSlotViewModel; feedback?: DropFeedback | null; disabled?: boolean }>()
const emit = defineEmits<{
  select: [slotId: SystemCanvasSlotViewModel['id']]
  menu: [slotId: SystemCanvasSlotViewModel['id'], anchor: MenuAnchor]
  dragStart: [payload: PatternDragPayload]
  dragOver: [slotId: SystemCanvasSlotViewModel['id']]
  dropPayload: [payload: PatternDragPayload, slotId: SystemCanvasSlotViewModel['id']]
  dropRejected: [error: DragPayloadParseErrorCode]
  dropUnsupported: []
  dragEnd: []
  reorderDragStart: [payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>]
  dragOverOrder: [targetOrder: number]
  dropOrderPayload: [payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>, targetOrder: number]
}>()

function select(): void {
  if (props.disabled) return
  emit('select', props.model.id)
}

function openMenu(event: globalThis.MouseEvent): void {
  if (props.disabled) return
  const element = event.currentTarget instanceof globalThis.HTMLElement ? event.currentTarget : null
  const rect = element?.getBoundingClientRect()
  const anchor = event.clientX || event.clientY
    ? { x: event.clientX, y: event.clientY }
    : { x: rect?.left ?? 0, y: rect?.bottom ?? 0 }
  emit('menu', props.model.id, anchor)
}

function startAgentDrag(event: globalThis.DragEvent): void {
  if (props.disabled || props.model.assignment !== 'configured' || !props.model.agent) return
  const payload = { version: 1, kind: 'assigned-agent', agentId: props.model.agent.id, sourceSlotId: props.model.id } as const
  event.dataTransfer?.setData(ODYSSEY_DRAG_MIME, serializeOdysseyDragPayload(payload))
  emit('dragStart', payload)
}

function startReorderDrag(event: globalThis.DragEvent): void {
  if (props.disabled || !props.model.canReorder) return
  const payload = { version: 1, kind: 'pattern-slot', slotId: props.model.id } as const
  event.dataTransfer?.setData(ODYSSEY_DRAG_MIME, serializeOdysseyDragPayload(payload))
  emit('reorderDragStart', payload)
}

function drop(event: globalThis.DragEvent): void {
  if (props.disabled) return
  const parsed = parseOdysseyDragPayload(event.dataTransfer?.getData(ODYSSEY_DRAG_MIME) ?? '')
  if (!parsed.ok) { emit('dropRejected', parsed.error.code); return }
  if (parsed.value.kind !== 'agent-template' && parsed.value.kind !== 'assigned-agent') {
    emit('dropUnsupported'); return
  }
  emit('dropPayload', parsed.value, props.model.id)
}

function dropOrder(event: globalThis.DragEvent): void {
  if (props.disabled || !props.model.canReorder || props.model.order === null) return
  const parsed = parseOdysseyDragPayload(event.dataTransfer?.getData(ODYSSEY_DRAG_MIME) ?? '')
  if (!parsed.ok) { emit('dropRejected', parsed.error.code); return }
  if (parsed.value.kind !== 'pattern-slot') { drop(event); return }
  emit('dropOrderPayload', parsed.value, props.model.order)
}

function accessibleLabel(model: SystemCanvasSlotViewModel, disabled = false): string {
  const state = model.assignment === 'configured'
    ? `${model.agent?.name ?? model.label}, configured`
    : model.assignment === 'missing-summary'
      ? `${model.label}, Agent unavailable because its summary is missing`
      : `${model.label}, empty slot`
  const entry = model.isEntry ? `${state}, loop entry` : state
  return disabled ? `${entry}, disabled` : entry
}
</script>
<template>
  <div
    class="agent-slot" :class="[`is-${model.assignment}`, `label-${model.labelPlacement ?? 'bottom'}`, { 'is-selected': model.selected, 'is-disabled': disabled, [`is-${feedback?.tone}`]: feedback }]"
    @dragover.prevent.stop="model.canReorder && model.order !== null ? emit('dragOverOrder', model.order) : !disabled && emit('dragOver', model.id)"
    @drop.prevent.stop="model.canReorder ? dropOrder($event) : drop($event)"
  >
    <button
      class="agent-slot__select"
      :disabled="disabled"
      :aria-label="accessibleLabel(model, disabled)"
      :draggable="!disabled && model.assignment === 'configured'"
      @click="select"
      @contextmenu.prevent="openMenu"
      @dragstart="startAgentDrag"
      @dragend="emit('dragEnd')"
    >
      <span class="agent-slot__orb">{{ model.agent ? model.agent.name.charAt(0) : '+' }}</span>
      <span v-if="model.isEntry" class="agent-slot__entry">Entry</span>
      <span class="agent-slot__label">
        <strong>{{ model.agent?.name ?? model.label }}</strong>
        <small>{{ model.assignment === 'configured' ? 'Configured' : model.assignment === 'empty' ? 'Empty slot' : 'Agent unavailable' }}</small>
      </span>
    </button>
    <span
      v-if="model.canReorder"
      class="agent-slot__reorder"
      role="button"
      tabindex="0"
      draggable="true"
      :aria-label="`Drag ${model.label} to reorder`"
      @dragstart.stop="startReorderDrag"
      @dragend="emit('dragEnd')"
    >⠿</span>
    <span v-if="feedback" class="agent-slot__feedback">{{ feedback.message }}</span>
  </div>
</template>
