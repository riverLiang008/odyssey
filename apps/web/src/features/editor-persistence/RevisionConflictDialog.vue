<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ subject: string }>()
const emit = defineEmits<{ stay: []; reload: []; overwrite: [] }>()
const dialog = ref<globalThis.HTMLElement | null>(null)
const reloadButton = ref<globalThis.HTMLButtonElement | null>(null)
const confirmButton = ref<globalThis.HTMLButtonElement | null>(null)
const pendingAction = ref<'reload' | 'overwrite' | null>(null)
const returnTarget = globalThis.document?.activeElement as globalThis.HTMLElement | null
const confirmation = computed(() => pendingAction.value === 'reload'
  ? {
      title: `Reload the server ${props.subject.toLowerCase()}?`,
      message: `Your unsaved local ${props.subject.toLowerCase()} changes will be discarded.`,
      action: 'Reload server version',
    }
  : {
      title: `Overwrite the server ${props.subject.toLowerCase()}?`,
      message: `Your local ${props.subject.toLowerCase()} will replace the newer server version. This cannot be undone.`,
      action: 'Overwrite with local version',
    })

function keydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') {
    if (pendingAction.value) {
      pendingAction.value = null
      globalThis.queueMicrotask(() => reloadButton.value?.focus())
    } else emit('stay')
    return
  }
  if (event.key !== 'Tab') return
  const buttons = [...(dialog.value?.querySelectorAll<globalThis.HTMLButtonElement>('button') ?? [])]
  const first = buttons[0]
  const last = buttons.at(-1)
  if (!first || !last) return
  if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus() }
}

function stage(action: 'reload' | 'overwrite') {
  pendingAction.value = action
  globalThis.queueMicrotask(() => confirmButton.value?.focus())
}

function confirm() {
  const action = pendingAction.value
  if (!action) return
  if (action === 'reload') emit('reload')
  else emit('overwrite')
}

onMounted(() => {
  globalThis.window.addEventListener('keydown', keydown)
  reloadButton.value?.focus()
})
onBeforeUnmount(() => {
  globalThis.window.removeEventListener('keydown', keydown)
  returnTarget?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="persistence-dialog-backdrop">
      <section ref="dialog" class="persistence-dialog" role="dialog" aria-modal="true" aria-labelledby="revision-conflict-title">
        <p class="persistence-dialog__eyebrow">{{ pendingAction ? 'CONFIRM RECOVERY' : 'REVISION CONFLICT' }}</p>
        <template v-if="pendingAction">
          <h2 id="revision-conflict-title">{{ confirmation.title }}</h2>
          <p>{{ confirmation.message }}</p>
          <div class="persistence-dialog__actions">
            <button type="button" class="is-quiet" @click="pendingAction = null">Back</button>
            <button ref="confirmButton" type="button" :class="{ 'is-danger': pendingAction === 'overwrite' }" @click="confirm">{{ confirmation.action }}</button>
          </div>
        </template>
        <template v-else>
          <h2 id="revision-conflict-title">{{ subject }} changed on the server</h2>
          <p>Your local configuration is preserved and autosave is paused. Choose which version should remain.</p>
          <div class="persistence-dialog__actions">
            <button type="button" class="is-quiet" @click="emit('stay')">Stay and review</button>
            <button ref="reloadButton" type="button" @click="stage('reload')">Reload server version</button>
            <button type="button" class="is-danger" @click="stage('overwrite')">Overwrite with local version</button>
          </div>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.persistence-dialog-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: rgb(15 28 51 / 34%); }
.persistence-dialog { width: min(560px, 100%); padding: 28px; border: 1px solid #d2dced; border-radius: 20px; background: #fff; box-shadow: 0 24px 64px rgb(15 28 51 / 22%); color: #11284c; }
.persistence-dialog__eyebrow { margin: 0 0 8px; color: #ff6b72; font-size: 12px; font-weight: 700; letter-spacing: .12em; }
.persistence-dialog h2 { margin: 0 0 10px; font-size: 24px; }
.persistence-dialog p { line-height: 1.5; }
.persistence-dialog__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.persistence-dialog button { min-height: 42px; padding: 0 16px; border: 1px solid #cbd7eb; border-radius: 10px; background: #fff; color: #11284c; font: inherit; cursor: pointer; }
.persistence-dialog button:focus-visible { outline: 3px solid rgb(75 113 255 / 30%); outline-offset: 2px; }
.persistence-dialog .is-danger { border-color: #ffced1; background: #fff4f5; color: #d9434b; }
@media (max-width: 640px) { .persistence-dialog__actions { align-items: stretch; flex-direction: column; } }
</style>
