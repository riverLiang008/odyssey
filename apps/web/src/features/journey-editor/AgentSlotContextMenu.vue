<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { UUID } from '@odyssey/schemas'
const props = defineProps<{ slotId: UUID }>()
const emit = defineEmits<{ action: [action: 'open' | 'replace' | 'duplicate' | 'remove', slotId: UUID]; close: [] }>()
const root = ref<globalThis.HTMLElement | null>(null)
let previousFocus: globalThis.HTMLElement | null = null
let listenersRegistered = false
function keydown(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') emit('close') }
function pointerdown(event: globalThis.PointerEvent) {
  if (!root.value || !event.composedPath().includes(root.value)) emit('close')
}
onMounted(() => {
  if (typeof globalThis.document === 'undefined') return
  previousFocus = globalThis.document.activeElement instanceof globalThis.HTMLElement
    ? globalThis.document.activeElement
    : null
  globalThis.document.addEventListener('keydown', keydown)
  globalThis.document.addEventListener('pointerdown', pointerdown)
  listenersRegistered = true
  root.value?.querySelector<globalThis.HTMLElement>('button')?.focus()
})
onBeforeUnmount(() => {
  if (!listenersRegistered || typeof globalThis.document === 'undefined') return
  globalThis.document.removeEventListener('keydown', keydown)
  globalThis.document.removeEventListener('pointerdown', pointerdown)
  listenersRegistered = false
  previousFocus?.focus()
})
</script>
<template><div ref="root" class="agent-menu" role="menu"><button role="menuitem" @click="$emit('action', 'open', props.slotId)">Open workflow</button><button role="menuitem" @click="$emit('action', 'replace', props.slotId)">Replace agent</button><button role="menuitem" @click="$emit('action', 'duplicate', props.slotId)">Duplicate</button><button class="is-danger" role="menuitem" @click="$emit('action', 'remove', props.slotId)">Remove agent</button></div></template>
