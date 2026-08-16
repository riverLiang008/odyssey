<script setup lang="ts">
import type { PatternTemplateKey } from '@odyssey/schemas'
import { useId } from 'vue'

defineProps<{ patternKey: PatternTemplateKey }>()

const arrowMarkerId = `compact-pattern-arrow-${useId()}`
const arrowMarkerUrl = `url(#${arrowMarkerId})`
</script>

<template>
  <svg class="compact-pattern-preview" viewBox="0 0 132 56" aria-hidden="true">
    <defs>
      <marker
        :id="arrowMarkerId"
        markerWidth="7"
        markerHeight="7"
        refX="6"
        refY="3.5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path class="marker-arrow" d="M0 0 7 3.5 0 7Z" />
      </marker>
    </defs>
    <template v-if="patternKey === 'hub_and_spoke'">
      <path class="route" :marker-end="arrowMarkerUrl" d="M58 28H31" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M74 28h27" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M66 20V12" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M66 36v8" />
      <circle cx="66" cy="28" r="8" /><circle cx="24" cy="28" r="7" /><circle cx="108" cy="28" r="7" /><circle cx="66" cy="5" r="7" /><circle cx="66" cy="51" r="7" />
    </template>
    <template v-else-if="patternKey === 'diamond_loop'">
      <path class="route" :marker-end="arrowMarkerUrl" d="M75 9C88 10 98 15 102 21" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M105 36C98 43 87 47 75 48" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M57 47C44 46 34 41 30 35" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M27 20C34 13 45 9 57 8" />
      <circle class="entry" cx="66" cy="8" r="7" /><circle cx="108" cy="28" r="7" /><circle cx="66" cy="48" r="7" /><circle cx="24" cy="28" r="7" /><circle class="entry-dot" cx="66" cy="8" r="3" />
    </template>
    <template v-else-if="patternKey === 'linear_sequence'">
      <path class="route" :marker-end="arrowMarkerUrl" d="M21 28h18" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M53 28h18" />
      <path class="route" :marker-end="arrowMarkerUrl" d="M85 28h18" />
      <circle cx="14" cy="28" r="7" /><circle cx="46" cy="28" r="7" /><circle cx="78" cy="28" r="7" /><circle cx="110" cy="28" r="7" />
    </template>
    <template v-else>
      <circle cx="66" cy="28" r="8" />
      <text x="83" y="32">solo</text>
    </template>
  </svg>
</template>
