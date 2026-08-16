<script setup lang="ts">
import type { UUID } from '@odyssey/schemas'
import type { SystemCanvasViewModel } from '@/canvas/system'
import type { DragPayloadParseErrorCode, DropFeedback, MenuAnchor, PatternDragPayload } from '@/canvas/interaction'
import AgentSlot from './AgentSlot.vue'
import PatternRouteLayer from './PatternRouteLayer.vue'
const props = defineProps<{ model: SystemCanvasViewModel; disabled?: boolean; overSlotId?: UUID | null; overOrder?: number | null; feedback?: DropFeedback | null }>()
defineEmits<{
  selectSlot: [slotId: UUID]; openMenu: [slotId: UUID, anchor: MenuAnchor]; dragStart: [payload: PatternDragPayload]
  dragOverSlot: [slotId: UUID]; dropPayload: [payload: PatternDragPayload, slotId: UUID]
  dropRejected: [error: DragPayloadParseErrorCode]; dragEnd: []; reorder: [slotId: UUID, targetOrder: number]
  reorderDragStart: [payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>]
  dragOverOrder: [targetOrder: number]
  dropOrderPayload: [payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>, targetOrder: number]
  dropUnsupported: []
}>()
function feedbackFor(slotId: UUID, order: number | null) {
  return props.overSlotId === slotId || (order !== null && props.overOrder === order) ? props.feedback : null
}
</script>
<template>
  <section class="system-canvas" aria-label="System configuration">
    <header><h2>System configuration</h2><p>Fixed structure · configure components in place</p></header>
    <div class="system-shell system-shell--input"><strong>Input Guardrail</strong></div>
    <div class="system-shell system-shell--execution">
      <strong>Execution · {{ model.name }}</strong><span>AGENT SLOTS</span>
      <div class="pattern-stage">
        <PatternRouteLayer :routes="model.routes" :width="model.bounds?.width ?? 468" :height="model.bounds?.height ?? 174" />
        <AgentSlot
          v-for="slot in model.slots" :key="slot.id" :model="slot" :disabled="disabled" :feedback="feedbackFor(slot.id, slot.order)"
          :style="{ left: `${slot.position.x}px`, top: `${slot.position.y}px` }" @select="$emit('selectSlot', $event)" @menu="(slotId, anchor) => $emit('openMenu', slotId, anchor)"
          @drag-start="$emit('dragStart', $event)" @drag-over="$emit('dragOverSlot', $event)" @drop-payload="(payload, slotId) => $emit('dropPayload', payload, slotId)"
          @drop-rejected="$emit('dropRejected', $event)" @drag-end="$emit('dragEnd')"
          @drop-unsupported="$emit('dropUnsupported')"
          @reorder-drag-start="$emit('reorderDragStart', $event)" @drag-over-order="$emit('dragOverOrder', $event)"
          @drop-order-payload="(payload, targetOrder) => $emit('dropOrderPayload', payload, targetOrder)"
        />
      </div>
    </div>
    <div class="system-shell system-shell--output"><strong>Output Guardrail</strong></div>
    <div class="system-shell system-shell--behavior"><strong>Execution Behavior · policies and observability</strong></div>
    <p v-if="model.diagnostics.length" class="system-canvas__diagnostic" role="status">Some canvas references are unavailable.</p>
  </section>
</template>
