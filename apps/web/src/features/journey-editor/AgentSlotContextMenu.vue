<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { HubSpokeDirection, UUID } from '@odyssey/schemas'
const props = defineProps<{
  hubDirection?: HubSpokeDirection
  slotId: UUID
  configured?: boolean
  readOnly?: boolean
  canReorder?: boolean
  canMoveEarlier?: boolean
  canMoveLater?: boolean
  canAddSibling?: boolean
  canRemoveSlot?: boolean
}>()
const emit = defineEmits<{
  action: [action: 'open' | 'save-template' | 'replace' | 'duplicate' | 'add-before' | 'add-after' | 'move-earlier' | 'move-later' | 'remove-slot' | 'remove', slotId: UUID]
  direction: [slotId: UUID, direction: HubSpokeDirection]
  close: []
}>()
const root = ref<globalThis.HTMLElement | null>(null)
let previousFocus: globalThis.HTMLElement | null = null
let listenersRegistered = false
function enabledItems(): globalThis.HTMLButtonElement[] {
  return root.value
    ? [...root.value.querySelectorAll<globalThis.HTMLButtonElement>('button:not(:disabled)')]
    : []
}
function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') { emit('close'); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = enabledItems()
  if (items.length === 0) return
  event.preventDefault()
  const current = globalThis.document.activeElement
  const index = items.findIndex((item) => item === current)
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (index + 1 + items.length) % items.length
        : (index - 1 + items.length) % items.length
  items[nextIndex]?.focus()
}
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
  if (root.value) {
    const rect = root.value.getBoundingClientRect()
    root.value.style.left = `${Math.max(12, Math.min(rect.left, globalThis.window.innerWidth - rect.width - 12))}px`
    root.value.style.top = `${Math.max(12, Math.min(rect.top, globalThis.window.innerHeight - rect.height - 12))}px`
  }
  enabledItems()[0]?.focus()
})
onBeforeUnmount(() => {
  if (!listenersRegistered || typeof globalThis.document === 'undefined') return
  globalThis.document.removeEventListener('keydown', keydown)
  globalThis.document.removeEventListener('pointerdown', pointerdown)
  listenersRegistered = false
  previousFocus?.focus()
})
</script>
<template>
  <div ref="root" class="agent-menu" role="menu">
    <div class="agent-menu__group">
      <button role="menuitem" @click="$emit('action', 'open', props.slotId)">Open workflow</button>
      <button role="menuitem" :disabled="readOnly || !configured" @click="$emit('action', 'replace', props.slotId)">Replace agent</button>
      <button role="menuitem" :disabled="readOnly || !configured" @click="$emit('action', 'duplicate', props.slotId)">Duplicate</button>
      <button class="is-danger" role="menuitem" :disabled="readOnly || !configured" @click="$emit('action', 'remove', props.slotId)">Remove agent</button>
    </div>
    <div class="agent-menu__divider" role="separator" />
    <div v-if="hubDirection" class="agent-menu__group" role="group" aria-label="Hub connection direction">
      <button :disabled="readOnly" role="menuitemradio" :aria-checked="hubDirection === 'hub_to_spoke'" @click="emit('direction', slotId, 'hub_to_spoke')">Hub → Spoke</button>
      <button :disabled="readOnly" role="menuitemradio" :aria-checked="hubDirection === 'spoke_to_hub'" @click="emit('direction', slotId, 'spoke_to_hub')">Spoke → Hub</button>
      <button :disabled="readOnly" role="menuitemradio" :aria-checked="hubDirection === 'bidirectional'" @click="emit('direction', slotId, 'bidirectional')">Hub ↔ Spoke</button>
    </div>
    <div class="agent-menu__group agent-menu__group--slot">
      <button role="menuitem" :disabled="readOnly || !configured" @click="$emit('action', 'save-template', props.slotId)">Save as template</button>
      <button v-if="canAddSibling" :disabled="readOnly" role="menuitem" @click="$emit('action', 'add-before', props.slotId)">Add slot before</button>
      <button v-if="canAddSibling" :disabled="readOnly" role="menuitem" @click="$emit('action', 'add-after', props.slotId)">Add slot after</button>
      <button v-if="canReorder" role="menuitem" :disabled="readOnly || !canMoveEarlier" @click="$emit('action', 'move-earlier', props.slotId)">Move earlier</button>
      <button v-if="canReorder" role="menuitem" :disabled="readOnly || !canMoveLater" @click="$emit('action', 'move-later', props.slotId)">Move later</button>
      <button v-if="canRemoveSlot" :disabled="readOnly" class="is-danger" role="menuitem" @click="$emit('action', 'remove-slot', props.slotId)">Remove slot</button>
    </div>
  </div>
</template>
