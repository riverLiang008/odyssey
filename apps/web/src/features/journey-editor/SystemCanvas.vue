<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { AgentSummary, GuardrailProjection, GuardrailSide, UUID } from '@odyssey/schemas'
import type { CanvasBounds, SystemCanvasViewModel } from '@/canvas/system'
import type { DragPayloadParseErrorCode, DropFeedback, MenuAnchor, PatternDragPayload } from '@/canvas/interaction'
import AgentSlot from './AgentSlot.vue'
import PatternRouteLayer from './PatternRouteLayer.vue'
import GuardrailModule from './GuardrailModule.vue'
const props = withDefaults(defineProps<{
  model: SystemCanvasViewModel
  inputGuardrail?: GuardrailProjection
  outputGuardrail?: GuardrailProjection
  agents?: AgentSummary[]
  guardrailPendingSide?: GuardrailSide | null
  readOnly?: boolean
  disabled?: boolean
  overSlotId?: UUID | null
  overOrder?: number | null
  feedback?: DropFeedback | null
}>(), {
  inputGuardrail: () => ({ state: 'inactive' }),
  outputGuardrail: () => ({ state: 'inactive' }),
  agents: () => [],
  guardrailPendingSide: null,
  overSlotId: null,
  overOrder: null,
  feedback: null,
})
const emit = defineEmits<{
  selectSlot: [slotId: UUID]; openMenu: [slotId: UUID, anchor: MenuAnchor]; dragStart: [payload: PatternDragPayload]
  dragOverSlot: [slotId: UUID]; dropPayload: [payload: PatternDragPayload, slotId: UUID]
  dropRejected: [error: DragPayloadParseErrorCode]; dragEnd: []; reorder: [slotId: UUID, targetOrder: number]
  reorderDragStart: [payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>]
  dragOverOrder: [targetOrder: number]
  dropOrderPayload: [payload: Extract<PatternDragPayload, { kind: 'pattern-slot' }>, targetOrder: number]
  dropUnsupported: []
  addGuardrail: [side: GuardrailSide]
  selectGuardrail: [side: GuardrailSide]
  openGuardrailMenu: [side: GuardrailSide, anchor: MenuAnchor]
  resizePatternStage: [bounds: CanvasBounds]
}>()
const patternStage = ref<globalThis.HTMLElement | null>(null)
let patternStageObserver: globalThis.ResizeObserver | null = null

function reportPatternStageBounds(width: number, height: number): void {
  const bounds = { width: Math.round(width), height: Math.round(height) }
  if (bounds.width > 0 && bounds.height > 0) emit('resizePatternStage', bounds)
}

onMounted(() => {
  const stage = patternStage.value
  if (!stage) return
  const initialBounds = stage.getBoundingClientRect()
  reportPatternStageBounds(initialBounds.width, initialBounds.height)
  if (typeof globalThis.ResizeObserver === 'undefined') return
  patternStageObserver = new globalThis.ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) reportPatternStageBounds(entry.contentRect.width, entry.contentRect.height)
  })
  patternStageObserver.observe(stage)
})

onBeforeUnmount(() => patternStageObserver?.disconnect())
function feedbackFor(slotId: UUID, order: number | null) {
  return props.overSlotId === slotId || (order !== null && props.overOrder === order) ? props.feedback : null
}
function guardrailAgent(projection: GuardrailProjection): AgentSummary | null {
  return projection.state === 'active'
    ? props.agents.find((agent) => agent.id === projection.agentId) ?? null
    : null
}
</script>
<template>
  <section class="system-canvas" aria-label="System configuration">
    <header><h2>System configuration</h2><p>Fixed structure · configure components in place</p></header>
    <div class="system-configuration-grid">
      <GuardrailModule :read-only="readOnly" class="system-shell system-shell--input" side="input" :projection="inputGuardrail" :agent="guardrailAgent(inputGuardrail)" :pending="guardrailPendingSide === 'input'" @add="$emit('addGuardrail', $event)" @select="$emit('selectGuardrail', $event)" @menu="(side, anchor) => $emit('openGuardrailMenu', side, anchor)" />
      <div class="system-shell system-shell--execution">
        <strong>Execution · {{ model.name }}</strong><span>AGENT SLOTS</span>
        <div ref="patternStage" class="pattern-stage">
          <PatternRouteLayer :routes="model.routes" :width="model.bounds?.width ?? 468" :height="model.bounds?.height ?? 174" />
          <AgentSlot
            v-for="slot in model.slots"
            :key="slot.id" :read-only="readOnly" :model="slot" :disabled="disabled" :feedback="feedbackFor(slot.id, slot.order)"
            :style="{
              left: `${slot.position.x}px`,
              top: `${slot.position.y}px`,
            }" @select="$emit('selectSlot', $event)" @menu="(slotId, anchor) => $emit('openMenu', slotId, anchor)"
            @drag-start="$emit('dragStart', $event)" @drag-over="$emit('dragOverSlot', $event)" @drop-payload="(payload, slotId) => $emit('dropPayload', payload, slotId)"
            @drop-rejected="$emit('dropRejected', $event)" @drag-end="$emit('dragEnd')"
            @drop-unsupported="$emit('dropUnsupported')"
            @reorder-drag-start="$emit('reorderDragStart', $event)" @drag-over-order="$emit('dragOverOrder', $event)"
            @drop-order-payload="(payload, targetOrder) => $emit('dropOrderPayload', payload, targetOrder)"
          />
        </div>
      </div>
      <GuardrailModule :read-only="readOnly" class="system-shell system-shell--output" side="output" :projection="outputGuardrail" :agent="guardrailAgent(outputGuardrail)" :pending="guardrailPendingSide === 'output'" @add="$emit('addGuardrail', $event)" @select="$emit('selectGuardrail', $event)" @menu="(side, anchor) => $emit('openGuardrailMenu', side, anchor)" />
      <div class="system-shell system-shell--behavior"><strong>Execution Behavior · policies and observability</strong></div>
    </div>
    <p v-if="model.diagnostics.length" class="system-canvas__diagnostic" role="status">Some canvas references are unavailable.</p>
  </section>
</template>
