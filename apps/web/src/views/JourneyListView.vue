<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { JourneySummary, RepositoryError } from '@odyssey/schemas'
import { useEditorRepository } from '@/app/editorRepository'
import CreateJourneyDialog from '@/features/journey-create/CreateJourneyDialog.vue'
import JourneyCard from '@/features/journey-list/JourneyCard.vue'
import { routeLocations } from '@/router/routeContracts'

type ListState = { type: 'loading' } | { type: 'ready'; journeys: JourneySummary[] } | { type: 'failed'; error: RepositoryError }
const repository = useEditorRepository()
const route = useRoute()
const router = useRouter()
const state = ref<ListState>({ type: 'loading' })
const isCreateOpen = computed(() => route.name === 'journey-create')
const pendingDelete = ref<JourneySummary | null>(null)
const deleting = ref(false)
const deleteError = ref<RepositoryError | null>(null)
async function load() {
  state.value = { type: 'loading' }
  const result = await repository.listJourneys()
  state.value = result.ok ? { type: 'ready', journeys: result.value } : { type: 'failed', error: result.error }
}
async function confirmDelete() {
  const journey = pendingDelete.value
  if (!journey || deleting.value) return
  deleting.value = true; deleteError.value = null
  const result = await repository.deleteJourney({ journeyId: journey.id, expectedRevision: journey.revision })
  deleting.value = false
  if (!result.ok) { deleteError.value = result.error; return }
  pendingDelete.value = null
  await load()
}
onMounted(load)

async function closeCreateDialog() {
  await router.push(routeLocations.journeys())
  await nextTick()
  globalThis.document.querySelector<InstanceType<typeof globalThis.HTMLAnchorElement>>('.journey-list-page__heading .primary-action')?.focus()
}

async function handleCreated(journeyId: JourneySummary['id']) {
  await router.replace(routeLocations.journey(journeyId))
}
</script>

<template>
  <section class="journey-list-page collection-list-page" aria-labelledby="journey-list-title" :inert="isCreateOpen || undefined">
    <div class="journey-list-page__heading collection-page-heading"><div><h1 id="journey-list-title">Your OdyJourneys</h1><p>Choose a Journey to continue configuring its Resources, Agents, and execution flow.</p></div><RouterLink class="primary-action collection-primary-action" :to="routeLocations.newJourney()">＋ New OdyJourney</RouterLink></div>
    <div class="journey-toolbar collection-toolbar" aria-label="Journey list controls"><input aria-label="Search journeys" placeholder="Search by name or description" disabled /><button type="button" disabled>Status</button><button type="button" disabled>Recently updated</button><span v-if="state.type === 'ready'">{{ state.journeys.length }} {{ state.journeys.length === 1 ? 'journey' : 'journeys' }}</span></div>
    <p v-if="state.type === 'loading'" role="status">Loading Journeys…</p>
    <div v-else-if="state.type === 'failed'" class="empty-state" role="alert">Could not load Journeys: {{ state.error.code }} <button type="button" @click="load">Retry</button></div>
    <div v-else-if="state.journeys.length === 0" class="empty-state" role="status">No Journeys yet. Create one and choose its Pattern.</div>
    <section v-else class="journey-section" aria-labelledby="my-journeys-heading"><div class="journey-section__heading"><h2 id="my-journeys-heading">MY JOURNEYS</h2><i /></div><div class="journey-grid"><JourneyCard v-for="journey in state.journeys" :key="journey.id" :journey="journey" @delete="pendingDelete = $event" /></div></section>
    <section v-if="pendingDelete" class="journey-staged-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-journey-title"><h2 id="delete-journey-title">Delete {{ pendingDelete.name }}?</h2><p>This permanently deletes the Journey and its Agent workflows. Saved Agent Templates remain available.</p><p v-if="deleteError" role="alert">Delete failed: {{ deleteError.code }}</p><button type="button" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Deleting…' : 'Delete Journey' }}</button><button type="button" :disabled="deleting" @click="pendingDelete = null">Cancel</button></section>
  </section>
  <CreateJourneyDialog v-if="isCreateOpen" @cancel="closeCreateDialog" @created="handleCreated" />
</template>
