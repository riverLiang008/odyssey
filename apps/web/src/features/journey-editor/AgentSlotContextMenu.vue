<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { UUID } from '@odyssey/schemas'
const props = defineProps<{
  slotId: UUID
  configured?: boolean
  canReorder?: boolean
  canMoveEarlier?: boolean
  canMoveLater?: boolean
  canAddSibling?: boolean
  canRemoveSlot?: boolean
}>()
const emit = defineEmits<{
  action: [action: 'open' | 'save-template' | 'replace' | 'duplicate' | 'add-before' | 'add-after' | 'move-earlier' | 'move-later' | 'remove-slot' | 'remove', slotId: UUID]
  close: []
}>()
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
<template><div ref="root" class="agent-menu" role="menu"><button v-if="configured" role="menuitem" @click="$emit('action', 'open', props.slotId)">Open workflow</button><button v-if="configured" role="menuitem" @click="$emit('action', 'save-template', props.slotId)">Save as template</button><button v-if="configured" role="menuitem" @click="$emit('action', 'replace', props.slotId)">Replace agent</button><button v-if="configured" role="menuitem" @click="$emit('action', 'duplicate', props.slotId)">Duplicate</button><button v-if="canAddSibling" role="menuitem" @click="$emit('action', 'add-before', props.slotId)">Add slot before</button><button v-if="canAddSibling" role="menuitem" @click="$emit('action', 'add-after', props.slotId)">Add slot after</button><button v-if="canReorder" role="menuitem" :disabled="!canMoveEarlier" @click="$emit('action', 'move-earlier', props.slotId)">Move earlier</button><button v-if="canReorder" role="menuitem" :disabled="!canMoveLater" @click="$emit('action', 'move-later', props.slotId)">Move later</button><button v-if="canRemoveSlot" class="is-danger" role="menuitem" @click="$emit('action', 'remove-slot', props.slotId)">Remove slot</button><button v-if="configured" class="is-danger" role="menuitem" @click="$emit('action', 'remove', props.slotId)">Remove agent</button></div></template>
