<script setup lang="ts">
import type { PatternTemplateKey } from '@odyssey/schemas'
import { PATTERN_DEFINITIONS } from '@/domain/pattern'
const meta = {
  hub_and_spoke: 'Coordinator with specialist spokes', diamond_loop: 'Directed cycle with one entry',
  linear_sequence: 'Ordered execution pipeline', solo_component: 'Single focused Agent',
} as const satisfies Record<PatternTemplateKey, string>
const templates = Object.values(PATTERN_DEFINITIONS).map((definition) => ({
  key: definition.templateKey, name: definition.name, meta: meta[definition.templateKey],
}))
const props = defineProps<{ disabled?: boolean; selected?: PatternTemplateKey | null }>()
const emit = defineEmits<{ choose: [templateKey: PatternTemplateKey] }>()
function choose(templateKey: PatternTemplateKey) { if (!props.disabled) emit('choose', templateKey) }
</script>
<template><aside class="journey-library"><h2>Pattern templates</h2><p>Choose the execution structure for this Journey.</p><button v-for="item in templates" :key="item.key" class="template-card" :class="{ 'is-selected': selected === item.key }" :aria-pressed="selected === item.key" :disabled="disabled" @click="choose(item.key)"><strong>{{ item.name }}</strong><span>{{ item.meta }}</span><small>Select Pattern</small></button></aside></template>
