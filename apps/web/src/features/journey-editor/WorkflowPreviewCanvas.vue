<script setup lang="ts">
import type { WorkflowPreviewViewModel } from '@/canvas/workflow-preview'

defineProps<{ model: WorkflowPreviewViewModel }>()

function nodeClass(type: WorkflowPreviewViewModel['nodes'][number]['type']): string {
  return `is-${type.replace('_', '-')}`
}
</script>

<template>
  <svg
    class="workflow-preview-canvas"
    :viewBox="`0 0 ${model.bounds.width} ${model.bounds.height}`"
    role="img"
    :aria-label="`${model.agentName} Workflow: ${model.nodes.length} nodes and ${model.edges.length} edges`"
  >
    <defs>
      <marker id="workflow-preview-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 0 0 L 7 3.5 L 0 7 Z" />
      </marker>
    </defs>
    <line
      v-for="edge in model.edges"
      :key="edge.id"
      class="workflow-preview-edge"
      :x1="edge.source.x"
      :y1="edge.source.y"
      :x2="edge.target.x"
      :y2="edge.target.y"
      marker-end="url(#workflow-preview-arrow)"
    />
    <g
      v-for="node in model.nodes"
      :key="node.id"
      class="workflow-preview-node"
      :class="nodeClass(node.type)"
      :transform="`translate(${node.position.x}, ${node.position.y})`"
    >
      <rect :x="-node.width / 2" :y="-node.height / 2" :width="node.width" :height="node.height" rx="8" />
      <text text-anchor="middle" dominant-baseline="middle">{{ node.name.length > 12 ? `${node.name.slice(0, 11)}…` : node.name }}</text>
      <title>{{ node.name }} · {{ node.type }}</title>
    </g>
  </svg>
</template>
