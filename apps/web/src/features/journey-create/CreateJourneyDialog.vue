<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PatternTemplateKey, RepositoryError, UUID } from '@odyssey/schemas'
import { useEditorRepository } from '@/app/editorRepository'
import PatternChoiceCard from './PatternChoiceCard.vue'
import { patternChoices } from './patternChoicePresentation'

type CreationState = { type: 'editing' } | { type: 'creating' } | { type: 'failed'; error: RepositoryError }
type DialogElement = InstanceType<typeof globalThis.HTMLElement>
type InputElement = InstanceType<typeof globalThis.HTMLInputElement>
type DialogKeyboardEvent = InstanceType<typeof globalThis.KeyboardEvent>

const emit = defineEmits<{ cancel: []; created: [journeyId: UUID] }>()
const repository = useEditorRepository()
const dialog = ref<DialogElement | null>(null)
const nameInput = ref<InputElement | null>(null)
const name = ref('')
const description = ref('')
const selectedPattern = ref<PatternTemplateKey | null>(null)
const state = ref<CreationState>({ type: 'editing' })
const canCreate = computed(() => name.value.trim().length > 0 && selectedPattern.value !== null && state.value.type !== 'creating')
const errorMessage = computed(() => state.value.type === 'failed' ? `Could not create Journey (${state.value.error.code}). Please try again.` : null)

function cancel() {
  if (state.value.type !== 'creating') emit('cancel')
}

function selectPattern(patternKey: PatternTemplateKey) {
  if (state.value.type !== 'creating') selectedPattern.value = patternKey
}

function movePatternSelection(direction: 1 | -1) {
  const currentIndex = patternChoices.findIndex((choice) => choice.key === selectedPattern.value)
  const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : patternChoices.length - 1) : (currentIndex + direction + patternChoices.length) % patternChoices.length
  selectedPattern.value = patternChoices[nextIndex]?.key ?? null
  nextTick(() => dialog.value?.querySelector<DialogElement>('[role="radio"][tabindex="0"]')?.focus())
}

function handleKeydown(event: DialogKeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
  if ((event.key === 'ArrowRight' || event.key === 'ArrowDown') && (event.target as DialogElement).getAttribute('role') === 'radio') { event.preventDefault(); movePatternSelection(1); return }
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowUp') && (event.target as DialogElement).getAttribute('role') === 'radio') { event.preventDefault(); movePatternSelection(-1); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<DialogElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) return
  if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus() }
}

async function createJourney() {
  const patternTemplateKey = selectedPattern.value
  if (!canCreate.value || patternTemplateKey === null) return
  state.value = { type: 'creating' }
  const result = await repository.createJourney({ name: name.value.trim(), description: description.value.trim() || null, patternTemplateKey })
  if (!result.ok) { state.value = { type: 'failed', error: result.error }; return }
  emit('created', result.value.journey.id)
}

onMounted(() => { globalThis.document.body.classList.add('has-modal'); nextTick(() => nameInput.value?.focus()) })
onBeforeUnmount(() => globalThis.document.body.classList.remove('has-modal'))
</script>

<template>
  <div class="create-journey-backdrop" @mousedown.self="cancel">
    <section ref="dialog" class="create-journey-dialog" role="dialog" aria-modal="true" aria-labelledby="create-journey-title" aria-describedby="create-journey-description" @keydown="handleKeydown">
      <header class="create-journey-dialog__header">
        <div><h1 id="create-journey-title">Create OdyJourney</h1><p id="create-journey-description">Name your journey, then choose the execution pattern that fits the work.</p></div>
        <button type="button" class="create-journey-dialog__close" aria-label="Close Create OdyJourney" :disabled="state.type === 'creating'" @click="cancel">×</button>
      </header>
      <form class="create-journey-dialog__form" @submit.prevent="createJourney">
        <div class="create-journey-dialog__body">
          <label class="create-journey-field"><span>Name</span><input ref="nameInput" v-model="name" required maxlength="120" autocomplete="off" placeholder="e.g. Research intelligence pipeline" /></label>
          <label class="create-journey-field"><span>Description <small>Optional</small></span><textarea v-model="description" rows="3" maxlength="500" placeholder="Describe what this journey is designed to accomplish…" /></label>
          <fieldset class="pattern-choice-group" :disabled="state.type === 'creating'">
            <legend><span>Pattern</span><small>Fixed after creation · Create a new Journey to use another Pattern</small></legend>
            <div role="radiogroup" aria-label="Journey Pattern">
              <PatternChoiceCard v-for="(choice, index) in patternChoices" :key="choice.key" :choice="choice" :selected="selectedPattern === choice.key" :focusable="selectedPattern === choice.key || (selectedPattern === null && index === 0)" :disabled="state.type === 'creating'" @select="selectPattern" />
            </div>
          </fieldset>
          <p v-if="errorMessage" class="create-journey-error" role="alert">{{ errorMessage }}</p>
        </div>
        <footer class="create-journey-dialog__actions">
          <button type="button" class="secondary-action" :disabled="state.type === 'creating'" @click="cancel">Cancel</button>
          <button class="create-action" type="submit" :disabled="!canCreate">{{ state.type === 'creating' ? 'Creating…' : 'Create OdyJourney' }}</button>
        </footer>
      </form>
    </section>
  </div>
</template>
