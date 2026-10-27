<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { KnowledgeGraphCanvasNodeData } from '@/canvas/knowledge'

defineProps<NodeProps<KnowledgeGraphCanvasNodeData>>()

function activateNode(event: globalThis.KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  if (event.currentTarget instanceof globalThis.HTMLElement) event.currentTarget.click()
}
</script>

<template>
  <article class="knowledge-graph-node" :class="{ 'has-issues': data.issues.length > 0 }" role="button" tabindex="0" :aria-label="`${data.node.name}; ${data.families.length} families; ${data.issues.length} issues`" @keydown="activateNode">
    <Handle type="target" :position="Position.Left" :connectable="false" />
    <header>
      <span class="knowledge-graph-node__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20"><path d="M5 2.75h6l4 4v10.5H5V2.75Z" /><path d="M11 2.75v4h4" /></svg>
      </span>
      <div>
        <strong>{{ data.node.name }}</strong>
        <small>{{ data.node.status.replace('_', ' ') }}</small>
      </div>
      <span v-if="data.issues.length" class="knowledge-graph-node__issue" :title="`${data.issues.length} open issues`" aria-label="Has open issues">!</span>
    </header>
    <p>{{ data.node.summary || 'No summary yet.' }}</p>
    <footer v-if="data.families.length || data.node.tags.length">
      <span v-for="family in data.families.slice(0, 2)" :key="family.id">{{ family.name }}</span>
      <span v-if="data.families.length > 2">+{{ data.families.length - 2 }}</span>
    </footer>
    <Handle type="source" :position="Position.Right" :connectable="false" />
  </article>
</template>
