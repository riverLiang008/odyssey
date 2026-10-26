<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ label: string }>()
const emit = defineEmits<{ close: [] }>()
const root = ref<globalThis.HTMLElement | null>(null)
let previousFocus: globalThis.HTMLElement | null = null
let restoreFocus = false
function markActionFocus() { restoreFocus = true }
function items() { return [...(root.value?.querySelectorAll<globalThis.HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])] }
function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    restoreFocus = true
    emit('close')
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const enabled = items()
  if (!enabled.length) return
  event.preventDefault()
  const current = enabled.findIndex(item => item === globalThis.document.activeElement)
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
    : (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
  enabled[index]?.focus()
}
onMounted(() => {
  previousFocus = globalThis.document.activeElement instanceof globalThis.HTMLElement ? globalThis.document.activeElement : null
  items()[0]?.focus()
})
onBeforeUnmount(() => { if (restoreFocus && previousFocus?.isConnected) previousFocus.focus() })
</script>

<template>
  <div ref="root" class="workflow-canvas-context-menu" role="menu" :aria-label="label" @keydown.stop="keydown" @click.stop="markActionFocus"><slot /></div>
</template>
