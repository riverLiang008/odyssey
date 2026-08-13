<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { useEditorRepository } from '@/app/editorRepository'
import RouteBoundary from '@/app/RouteBoundary.vue'
import { journeyTabs, parseJourneyRoute, routeLocations, type JourneyTab } from '@/router/routeContracts'
import { useJourneyEditorStore } from '@/stores/journeyEditor'

const route = useRoute()
const router = useRouter()
const repository = useEditorRepository()
const store = useJourneyEditorStore()
const { document, persistence, session } = storeToRefs(store)
const identity = computed(() => parseJourneyRoute(route.params.journeyId, route.query.tab))

watch(identity, (next) => {
  if (!next) {
    store.dispose()
  } else if (store.document?.journey.id === next.journeyId && store.persistence.loadStatus === 'ready') {
    store.setActiveTab(next.tab)
  } else {
    void store.load(next.journeyId, next.tab, repository)
  }
}, { immediate: true })
onUnmounted(() => store.dispose())

function selectTab(tab: JourneyTab) {
  const current = identity.value
  if (!current) return
  store.setActiveTab(tab)
  void router.push(routeLocations.journey(current.journeyId, tab))
}

function retry() {
  const current = identity.value
  if (current) void store.load(current.journeyId, current.tab, repository)
}
</script>

<template>
  <section v-if="!identity" class="proof-page"><h1>Invalid Journey</h1><RouterLink to="/journeys">Return to Journeys</RouterLink></section>
  <RouteBoundary v-else-if="persistence.loadStatus !== 'ready'" :status="persistence.loadStatus" subject="Journey" :error="persistence.error" :back-to="routeLocations.journeys()" back-label="Return to Journeys" @retry="retry" />
  <section v-else-if="document" class="editor-page journey-editor-page">
    <nav class="editor-tabs" aria-label="Journey sections">
      <button v-for="tab in journeyTabs" :key="tab" type="button" :class="{ 'is-active': session.activeTab === tab }" @click="selectTab(tab)">{{ tab }}</button>
    </nav>
    <header class="editor-page__heading"><h1>OdyJourney · {{ document.journey.name }}</h1><span>Revision {{ document.journey.revision }}</span></header>
    <div class="journey-editor-layout">
      <aside class="editor-panel"><h2>{{ session.activeTab === 'agent' ? 'Agent templates' : `${session.activeTab} library` }}</h2><p>Library interactions arrive in the next M2 task.</p></aside>
      <section class="editor-canvas-placeholder"><h2>System configuration</h2><p>Fixed structure · domain commands are intentionally not implemented in M2.2.</p><div class="placeholder-structure">{{ document.pattern.name }}</div></section>
    </div>
  </section>
</template>
