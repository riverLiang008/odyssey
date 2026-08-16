<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ loading?: boolean; error?: string | null }>()
const emit = defineEmits<{ submit: [name: string, description: string | null]; close: [] }>()
const root = ref<globalThis.HTMLElement | null>(null)
const nameInput = ref<globalThis.HTMLInputElement | null>(null)
const name = ref('')
const description = ref('')
let previousFocus: globalThis.HTMLElement | null = null

function close() { emit('close') }
function submit() {
  const trimmedName = name.value.trim()
  if (trimmedName) emit('submit', trimmedName, description.value.trim() || null)
}
function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab' || !root.value) return
  const focusable = [...root.value.querySelectorAll<globalThis.HTMLElement>('input,button:not([disabled])')]
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(() => {
  previousFocus = globalThis.document.activeElement instanceof globalThis.HTMLElement ? globalThis.document.activeElement : null
  void nextTick(() => nameInput.value?.focus())
})
onBeforeUnmount(() => previousFocus?.focus())
</script>

<template>
  <div class="journey-dialog-backdrop">
    <form ref="root" class="journey-staged-dialog" role="dialog" aria-modal="true" aria-labelledby="save-template-title" @submit.prevent="submit" @keydown="keydown">
      <h2 id="save-template-title">Save agent as template</h2>
      <p>Create an independent reusable snapshot of this Agent.</p>
      <label>Template name<input ref="nameInput" v-model="name" required :disabled="loading" aria-label="Template name"></label>
      <label>Description<input v-model="description" :disabled="loading" aria-label="Template description"></label>
      <p v-if="error" class="journey-feedback" role="alert">{{ error }}</p>
      <button type="submit" :disabled="loading || !name.trim()">{{ loading ? 'Saving…' : 'Save template' }}</button>
      <button type="button" :disabled="loading" @click="close">Cancel</button>
    </form>
  </div>
</template>
