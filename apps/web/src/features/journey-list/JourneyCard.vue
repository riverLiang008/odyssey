<script setup lang="ts">
import type { JourneySummary } from '@odyssey/schemas'
import { routeLocations } from '@/router/routeContracts'
defineProps<{ journey: JourneySummary }>()
defineEmits<{ delete: [journey: JourneySummary] }>()
</script>

<template>
  <article class="journey-card">
    <div class="journey-card__heading"><h3><RouterLink :to="routeLocations.journey(journey.id)" :aria-label="`Open ${journey.name}`">{{ journey.name }}</RouterLink></h3><span class="journey-status" :class="`is-${journey.status}`"><i />{{ journey.status }}</span></div>
    <p>{{ journey.description ?? 'Configure Agents and execution flow.' }}</p>
    <div class="journey-card__divider" />
    <span>{{ journey.agentCount }} agents · {{ journey.patternKind }}</span>
    <small>Updated {{ new Date(journey.updatedAt).toLocaleDateString() }}</small>
    <div class="journey-card__actions"><RouterLink :to="routeLocations.journey(journey.id)">Open Journey →</RouterLink><button type="button" :aria-label="`Delete ${journey.name}`" @click="$emit('delete', journey)">Delete</button></div>
  </article>
</template>
