<script setup lang="ts">
import type { SystemCanvasRouteViewModel } from '@/canvas/system'
defineProps<{ routes: readonly SystemCanvasRouteViewModel[]; width: number; height: number }>()
</script>
<template>
  <svg class="pattern-routes" :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
    <defs>
      <marker id="pattern-route-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
        <path d="M 0 0 L 8 4 L 0 8 Z" />
      </marker>
    </defs>
    <line
      v-for="route in routes"
      :key="route.id"
      :x1="route.source.x"
      :y1="route.source.y"
      :x2="route.target.x"
      :y2="route.target.y"
      :marker-start="route.bidirectional ? 'url(#pattern-route-arrow)' : undefined"
      marker-end="url(#pattern-route-arrow)"
    />
  </svg>
</template>
