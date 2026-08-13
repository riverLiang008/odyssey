<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'

import { useEditorRepository } from '@/app/editorRepository'
import RouteBoundary from '@/app/RouteBoundary.vue'
import { parseAgentWorkflowRoute, routeLocations } from '@/router/routeContracts'
import { useWorkflowEditorStore } from '@/stores/workflowEditor'

const route = useRoute()
const repository = useEditorRepository()
const store = useWorkflowEditorStore()
const { document, persistence, session } = storeToRefs(store)
const identity = computed(() => parseAgentWorkflowRoute(route.params.journeyId, route.params.agentId))

watch(identity, (next) => {
  if (next) void store.load(next.journeyId, next.agentId, repository)
  else store.dispose()
}, { immediate: true })
onUnmounted(() => store.dispose())

function retry() {
  const current = identity.value
  if (current) void store.load(current.journeyId, current.agentId, repository)
}
</script>

<template>
  <section v-if="!identity" class="proof-page"><h1>Invalid Agent Workflow</h1><RouterLink to="/journeys">Return to Journeys</RouterLink></section>
  <RouteBoundary v-else-if="persistence.loadStatus !== 'ready'" :status="persistence.loadStatus" subject="Agent workflow" :error="persistence.error" :back-to="routeLocations.journey(identity.journeyId)" back-label="Return to Journey" @retry="retry" />
  <section v-else-if="document" class="editor-page workflow-editor-page">
    <header class="workflow-toolbar">
      <RouterLink :to="routeLocations.journey(document.agent.journeyId)">← OdyJourney / {{ document.agent.name }}</RouterLink>
      <div><button type="button" :class="{ 'is-active': session.mode === 'flow' }" @click="store.setMode('flow')">Flow</button><button type="button" :class="{ 'is-active': session.mode === 'configure' }" @click="store.setMode('configure')">Configure</button></div>
    </header>
    <div class="workflow-editor-layout">
      <aside class="editor-panel workflow-palette"><h2>Workflow nodes</h2><p>Branch</p><p>Loop</p><p>Agent Action</p><p>Task</p></aside>
      <section class="workflow-canvas-placeholder"><h1>{{ document.agent.name }} · Execution Canvas</h1><p>{{ document.workflow.nodes.length }} nodes · {{ document.workflow.edges.length }} edges</p><div class="placeholder-structure">Canvas adapter arrives in M2.6.</div></section>
      <aside class="editor-panel workflow-resources"><h2>Available Tools</h2><p>Panel: {{ session.panel?.type ?? 'closed' }}</p><p>Resource drag is deferred to M2.8.</p></aside>
    </div>
  </section>
</template>
