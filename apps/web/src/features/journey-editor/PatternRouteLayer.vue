<script setup lang="ts">
import type { SystemCanvasRouteViewModel } from '@/canvas/system'
defineProps<{ routes: readonly SystemCanvasRouteViewModel[] }>()
</script>
<template><svg class="pattern-routes" viewBox="0 0 720 420" aria-hidden="true"><line v-for="route in routes" :key="route.id" :x1="route.source.x" :y1="route.source.y" :x2="route.target.x" :y2="route.target.y" /></svg></template>
