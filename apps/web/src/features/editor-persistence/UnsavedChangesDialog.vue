<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{ stay: []; leave: [] }>()
const dialog = ref<globalThis.HTMLElement | null>(null)
const stayButton = ref<globalThis.HTMLButtonElement | null>(null)
const returnTarget = globalThis.document?.activeElement as globalThis.HTMLElement | null

function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') { emit('stay'); return }
  if (event.key !== 'Tab') return
  const buttons = [...(dialog.value?.querySelectorAll<globalThis.HTMLButtonElement>('button') ?? [])]
  const first = buttons[0]
  const last = buttons.at(-1)
  if (!first || !last) return
  if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus() }
}

onMounted(() => {
  globalThis.window.addEventListener('keydown', keydown)
  stayButton.value?.focus()
})
onBeforeUnmount(() => {
  globalThis.window.removeEventListener('keydown', keydown)
  returnTarget?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="unsaved-dialog-backdrop">
      <section ref="dialog" class="unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title">
        <p class="unsaved-dialog__eyebrow">UNSAVED CHANGES</p>
        <h2 id="unsaved-dialog-title">Leave without saving?</h2>
        <p>The latest changes could not be saved. Stay to retry, or leave and discard the local changes.</p>
        <div class="unsaved-dialog__actions">
          <button ref="stayButton" type="button" @click="emit('stay')">Stay and retry</button>
          <button type="button" class="is-danger" @click="emit('leave')">Leave without saving</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.unsaved-dialog-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: rgb(15 28 51 / 34%); }
.unsaved-dialog { width: min(520px, 100%); padding: 28px; border: 1px solid #d2dced; border-radius: 20px; background: #fff; box-shadow: 0 24px 64px rgb(15 28 51 / 22%); color: #11284c; }
.unsaved-dialog__eyebrow { margin: 0 0 8px; color: #ff6b72; font-size: 12px; font-weight: 700; letter-spacing: .12em; }
.unsaved-dialog h2 { margin: 0 0 10px; font-size: 24px; }
.unsaved-dialog p { line-height: 1.5; }
.unsaved-dialog__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.unsaved-dialog button { min-height: 42px; padding: 0 16px; border: 1px solid #cbd7eb; border-radius: 10px; background: #fff; color: #11284c; font: inherit; cursor: pointer; }
.unsaved-dialog button:focus-visible { outline: 3px solid rgb(75 113 255 / 30%); outline-offset: 2px; }
.unsaved-dialog .is-danger { border-color: #ffced1; background: #fff4f5; color: #d9434b; }
@media (max-width: 640px) { .unsaved-dialog__actions { align-items: stretch; flex-direction: column; } }
</style>
