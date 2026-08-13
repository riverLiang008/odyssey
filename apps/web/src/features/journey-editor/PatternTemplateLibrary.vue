<script setup lang="ts">
import type { PatternTemplateKey } from '@odyssey/schemas'
import { PATTERN_DEFINITIONS } from '@/domain/pattern'
const meta = {
  hub_and_spoke: 'Coordinator with specialist spokes', diamond_loop: 'Branch, review and convergence',
  linear_sequence: 'Ordered execution pipeline', solo_component: 'Single focused Agent',
} as const satisfies Record<PatternTemplateKey, string>
const templates = Object.values(PATTERN_DEFINITIONS).map((definition) => ({
  key: definition.templateKey, name: definition.name, meta: meta[definition.templateKey],
}))
defineEmits<{ choose: [templateKey: PatternTemplateKey] }>()
</script>
<template><aside class="journey-library"><h2>Pattern templates</h2><p>Choose or drag a Pattern onto the canvas</p><button v-for="item in templates" :key="item.key" class="template-card" @click="$emit('choose', item.key)"><strong>{{ item.name }}</strong><span>{{ item.meta }}</span><small>Drag to replace Pattern</small></button></aside></template>
