<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { GuardrailSide, UUID } from '@odyssey/schemas'

defineProps<{ side: GuardrailSide; agentId: UUID }>()
const emit = defineEmits<{ open: [agentId: UUID]; remove: [side: GuardrailSide, agentId: UUID]; close: [] }>()
const root = ref<globalThis.HTMLElement | null>(null)
let previousFocus: globalThis.HTMLElement | null = null

function keydown(event: globalThis.KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
function pointerdown(event: globalThis.PointerEvent): void {
  if (!root.value || !event.composedPath().includes(root.value)) emit('close')
}
onMounted(() => {
  previousFocus = globalThis.document.activeElement instanceof globalThis.HTMLElement ? globalThis.document.activeElement : null
  globalThis.document.addEventListener('keydown', keydown)
  globalThis.document.addEventListener('pointerdown', pointerdown)
  root.value?.querySelector<globalThis.HTMLButtonElement>('button')?.focus()
})
onBeforeUnmount(() => {
  globalThis.document.removeEventListener('keydown', keydown)
  globalThis.document.removeEventListener('pointerdown', pointerdown)
  previousFocus?.focus()
})
</script>

<template>
  <div ref="root" class="agent-menu guardrail-menu" role="menu">
    <button role="menuitem" @click="$emit('open', agentId)">Open workflow</button>
    <div class="agent-menu__divider" role="separator" />
    <button class="is-danger" role="menuitem" @click="$emit('remove', side, agentId)">Remove guardrail</button>
  </div>
</template>
