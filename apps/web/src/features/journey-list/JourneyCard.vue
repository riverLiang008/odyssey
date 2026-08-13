<script setup lang="ts">
import { routeLocations } from '@/router/routeContracts'
import type { JourneySummary } from './journeySummaries'

defineProps<{ journey: JourneySummary }>()
</script>

<template>
  <RouterLink class="journey-card" :to="routeLocations.journey(journey.id)" :aria-label="`Open ${journey.name}`">
    <div class="journey-card__heading">
      <h3>{{ journey.name }}</h3>
      <span class="journey-status" :class="`is-${journey.status}`"><i />{{ journey.status }}</span>
    </div>
    <p>{{ journey.description }}</p>
    <div class="journey-card__divider" />
    <span>{{ journey.agentCount }} agents · {{ journey.executionCount }} executions</span>
    <small>Updated {{ journey.updatedLabel }}</small>
    <strong>Open Journey →</strong>
  </RouterLink>
</template>
