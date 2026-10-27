<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeGraphOverview, KnowledgeGraphNode, UUID } from '@odyssey/schemas'

const props = defineProps<{ graph: KnowledgeGraphOverview; node: KnowledgeGraphNode }>()
defineEmits<{ close: []; openDocument: [resourceId: UUID] }>()

const families = computed(() => props.graph.families.filter(family => family.resourceIds.includes(props.node.id)))
const issues = computed(() => props.graph.issues.filter(issue => issue.resourceIds.includes(props.node.id) && (issue.resolutionStatus === 'open' || issue.resolutionStatus === 'accepted')))
const incoming = computed(() => props.graph.edges.filter(edge => edge.targetResourceId === props.node.id))
const outgoing = computed(() => props.graph.edges.filter(edge => edge.sourceResourceId === props.node.id))
const nodeNames = computed(() => new Map(props.graph.nodes.map(node => [node.id, node.name])))
</script>

<template>
  <aside class="knowledge-graph-inspector" aria-labelledby="knowledge-graph-inspector-title">
    <header>
      <div><span>DOCUMENT INSPECTOR</span><h3 id="knowledge-graph-inspector-title">{{ node.name }}</h3></div>
      <button type="button" aria-label="Close document inspector" @click="$emit('close')">×</button>
    </header>
    <div class="knowledge-graph-inspector__body">
      <section><h4>Summary</h4><p>{{ node.summary || 'No summary yet.' }}</p></section>
      <section><h4>Guide</h4><p>{{ node.guide || 'No guide yet.' }}</p></section>
      <section v-if="families.length"><h4>Knowledge families</h4><div class="knowledge-graph-inspector__chips"><span v-for="family in families" :key="family.id">{{ family.name }}</span></div></section>
      <section v-if="node.tags.length"><h4>Tags</h4><div class="knowledge-graph-inspector__chips"><span v-for="tag in node.tags" :key="tag.id">{{ tag.name }}</span></div></section>
      <section v-if="outgoing.length || incoming.length">
        <h4>Relationships</h4>
        <ul>
          <li v-for="edge in outgoing" :key="edge.id"><b>{{ edge.kind.replaceAll('_', ' ') }}</b> → {{ nodeNames.get(edge.targetResourceId) }}</li>
          <li v-for="edge in incoming" :key="edge.id">{{ nodeNames.get(edge.sourceResourceId) }} → <b>{{ edge.kind.replaceAll('_', ' ') }}</b></li>
        </ul>
      </section>
      <section v-if="issues.length" class="knowledge-graph-inspector__issues"><h4>Needs attention</h4><ul><li v-for="issue in issues" :key="issue.id"><strong>{{ issue.title }}</strong><span>{{ issue.message }}</span></li></ul></section>
    </div>
    <footer><button type="button" class="knowledge-primary-action" @click="$emit('openDocument', node.id)">Open document</button></footer>
  </aside>
</template>
