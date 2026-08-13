<script setup lang="ts">
import type { SystemCanvasSlotViewModel } from '@/canvas/system'
import type { DropFeedback } from '@/canvas/interaction'
const props = defineProps<{ model: SystemCanvasSlotViewModel; feedback?: DropFeedback | null; disabled?: boolean }>()
const emit = defineEmits<{ select: [slotId: SystemCanvasSlotViewModel['id']]; menu: [slotId: SystemCanvasSlotViewModel['id']] }>()

function select(): void {
  if (props.disabled) return
  emit('select', props.model.id)
}

function openMenu(): void {
  if (props.disabled) return
  emit('menu', props.model.id)
}

function accessibleLabel(model: SystemCanvasSlotViewModel, disabled = false): string {
  const state = model.assignment === 'configured'
    ? `${model.agent?.name ?? model.label}, configured`
    : model.assignment === 'missing-summary'
      ? `${model.label}, Agent unavailable because its summary is missing`
      : `${model.label}, empty slot`
  return disabled ? `${state}, disabled` : state
}
</script>
<template>
  <button
    class="agent-slot" :class="[`is-${model.assignment}`, { 'is-selected': model.selected, 'is-disabled': disabled, [`is-${feedback?.tone}`]: feedback }]"
    :disabled="disabled" :aria-label="accessibleLabel(model, disabled)"
    @click="select" @contextmenu.prevent="openMenu"
  >
    <span class="agent-slot__orb">{{ model.agent ? model.agent.name.charAt(0) : '+' }}</span>
    <strong>{{ model.agent?.name ?? model.label }}</strong>
    <small>{{ model.assignment === 'configured' ? 'Configured' : model.assignment === 'empty' ? 'Empty slot' : 'Agent unavailable' }}</small>
    <span v-if="feedback" class="agent-slot__feedback">{{ feedback.message }}</span>
  </button>
</template>
