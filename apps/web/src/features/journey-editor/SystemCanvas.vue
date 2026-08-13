<script setup lang="ts">
import type { UUID } from '@odyssey/schemas'
import type { SystemCanvasViewModel } from '@/canvas/system'
import AgentSlot from './AgentSlot.vue'
import PatternRouteLayer from './PatternRouteLayer.vue'
defineProps<{ model: SystemCanvasViewModel; disabled?: boolean }>()
defineEmits<{ selectSlot: [slotId: UUID]; openMenu: [slotId: UUID] }>()
</script>
<template>
  <section class="system-canvas" aria-label="System configuration">
    <header><h2>System configuration</h2><p>Fixed structure · configure components in place</p></header>
    <div class="system-shell system-shell--input"><strong>Input Guardrail</strong></div>
    <div class="system-shell system-shell--execution">
      <strong>Execution · {{ model.name }}</strong><span>AGENT SLOTS</span>
      <div class="pattern-stage">
        <PatternRouteLayer :routes="model.routes" />
        <AgentSlot
          v-for="slot in model.slots" :key="slot.id" :model="slot" :disabled="disabled"
          :style="{ left: `${slot.position.x}px`, top: `${slot.position.y}px` }" @select="$emit('selectSlot', $event)" @menu="$emit('openMenu', $event)"
        />
      </div>
    </div>
    <div class="system-shell system-shell--output"><strong>Output Guardrail</strong></div>
    <div class="system-shell system-shell--behavior"><strong>Execution Behavior · policies and observability</strong></div>
    <p v-if="model.diagnostics.length" class="system-canvas__diagnostic" role="status">Some canvas references are unavailable.</p>
  </section>
</template>
