<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

withDefaults(defineProps<{ importEnabled?: boolean }>(), { importEnabled: true })
const emit = defineEmits<{ export: []; import: [] }>()

const root = ref<globalThis.HTMLElement | null>(null)
const trigger = ref<globalThis.HTMLButtonElement | null>(null)
const isOpen = ref(false)

function close(restoreFocus = false) {
  isOpen.value = false
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) void nextTick(() => root.value?.querySelector<globalThis.HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus())
}

function chooseExport() {
  emit('export')
  close(true)
}

function chooseImport() {
  emit('import')
  close(true)
}

function handleMenuKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const items = Array.from(root.value?.querySelectorAll<globalThis.HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
  if (items.length === 0) return
  event.preventDefault()
  const currentIndex = items.indexOf(globalThis.document.activeElement as globalThis.HTMLButtonElement)
  const direction = event.key === 'ArrowDown' ? 1 : -1
  items[(currentIndex + direction + items.length) % items.length]?.focus()
}

function handleDocumentPointerDown(event: globalThis.PointerEvent) {
  if (event.target instanceof globalThis.Node && !root.value?.contains(event.target)) close()
}

onMounted(() => globalThis.document.addEventListener('pointerdown', handleDocumentPointerDown))
onUnmounted(() => globalThis.document.removeEventListener('pointerdown', handleDocumentPointerDown))
</script>

<template>
  <div ref="root" class="workflow-tools">
    <button
      ref="trigger"
      class="workflow-tools__trigger"
      type="button"
      aria-label="Workflow tools"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>

    <div v-if="isOpen" class="workflow-tools__menu" role="menu" aria-label="Workflow tools" @keydown="handleMenuKeydown">
      <button type="button" role="menuitem" :disabled="!importEnabled" @click="chooseImport">
        <span>Import workflow JSON</span>
        <small v-if="!importEnabled">Unavailable</small>
      </button>
      <button type="button" role="menuitem" @click="chooseExport">
        <span>Export workflow JSON</span>
      </button>
      <p>Workflow JSON may contain configured values. Review it before sharing.</p>
    </div>
  </div>
</template>
