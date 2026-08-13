<script setup lang="ts">
import type { RepositoryError } from '@odyssey/schemas'
import type { RouteLocationRaw } from 'vue-router'
import type { LoadStatus } from '@/stores/journeyEditor'

const props = defineProps<{
  status: Exclude<LoadStatus, 'ready'>
  subject: string
  error?: RepositoryError | null
  backTo: RouteLocationRaw
  backLabel: string
}>()
const emit = defineEmits<{ retry: [] }>()

function errorCopy(error: RepositoryError | null | undefined): { title: string; detail: string } {
  switch (error?.code) {
    case 'NETWORK_FAILED':
      return { title: `Unable to load ${props.subject}`, detail: 'Check your connection and try again.' }
    case 'RESPONSE_INVALID':
      return { title: `${props.subject} data is invalid`, detail: 'The response did not match the frozen editor contract.' }
    case 'REVISION_CONFLICT':
      return { title: `${props.subject} changed elsewhere`, detail: 'Reload the latest revision before continuing.' }
    case 'ABORTED':
      return { title: `${props.subject} request was cancelled`, detail: 'Try loading the page again.' }
    case 'NOT_FOUND':
      return { title: `${props.subject} not found`, detail: 'It may have been removed or the link may be incorrect.' }
    case undefined:
      return { title: `Unable to load ${props.subject}`, detail: 'Try loading the page again.' }
  }
}
</script>

<template>
  <section v-if="status === 'loading' || status === 'idle'" class="route-boundary" role="status" aria-live="polite" aria-busy="true">
    <span class="route-boundary__spinner" aria-hidden="true" />
    <h1>Loading {{ subject }}…</h1>
  </section>
  <section v-else class="route-boundary" :role="status === 'error' ? 'alert' : 'status'">
    <span class="route-boundary__symbol" aria-hidden="true">{{ status === 'not-found' ? '404' : '!' }}</span>
    <h1>{{ status === 'not-found' ? `${subject} not found` : errorCopy(error).title }}</h1>
    <p>{{ status === 'not-found' ? 'It may have been removed or the link may be incorrect.' : errorCopy(error).detail }}</p>
    <div class="route-boundary__actions">
      <button v-if="status === 'error'" type="button" @click="emit('retry')">Try again</button>
      <RouterLink :to="backTo">{{ backLabel }}</RouterLink>
    </div>
  </section>
</template>
