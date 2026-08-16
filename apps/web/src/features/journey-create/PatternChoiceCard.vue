<script setup lang="ts">
import type { PatternTemplateKey } from '@odyssey/schemas'
import CompactPatternPreview from './CompactPatternPreview.vue'
import type { PatternChoicePresentation } from './patternChoicePresentation'

defineProps<{ choice: PatternChoicePresentation; selected: boolean; focusable: boolean; disabled: boolean }>()
defineEmits<{ select: [patternKey: PatternTemplateKey] }>()
</script>

<template>
  <button
    class="pattern-choice-card"
    :class="{ 'is-selected': selected }"
    type="button"
    role="radio"
    :aria-checked="selected"
    :tabindex="focusable ? 0 : -1"
    :disabled="disabled"
    @click="$emit('select', choice.key)"
  >
    <span class="pattern-choice-card__copy">
      <strong>{{ choice.name }}</strong>
      <small>{{ choice.descriptor }}</small>
    </span>
    <span class="pattern-choice-card__radio" aria-hidden="true"><i /></span>
    <CompactPatternPreview :pattern-key="choice.key" />
    <span class="pattern-choice-card__use-case">Best for {{ choice.useCase.toLowerCase() }}</span>
  </button>
</template>
