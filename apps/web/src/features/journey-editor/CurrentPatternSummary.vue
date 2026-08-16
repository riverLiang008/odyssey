<script setup lang="ts">
import type { PatternConfig } from '@odyssey/schemas'
import { PATTERN_DEFINITIONS } from '@/domain/pattern'

const props = defineProps<{ pattern: PatternConfig }>()
const descriptions = {
  hub_and_spoke: 'One coordinator routes work to specialist spokes.',
  diamond_loop: 'Agents execute in a directed cycle from one designated entry.',
  linear_sequence: 'Agents execute once in a defined order.',
  solo_component: 'One focused Agent handles the Journey.',
} as const
</script>

<template>
  <aside class="journey-library current-pattern-summary" aria-labelledby="current-pattern-title">
    <span class="page-eyebrow">Current Pattern</span>
    <h2 id="current-pattern-title">{{ PATTERN_DEFINITIONS[props.pattern.kind].name }}</h2>
    <p>{{ descriptions[props.pattern.kind] }}</p>
    <dl>
      <div><dt>Slots</dt><dd>{{ props.pattern.slots.length }}</dd></div>
      <div><dt>Pattern key</dt><dd>{{ props.pattern.templateKey }}</dd></div>
    </dl>
    <small>Pattern is fixed after this Journey is created. To use another Pattern, create a new Journey.</small>
  </aside>
</template>
