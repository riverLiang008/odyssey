<script setup lang="ts">
import { computed } from 'vue'
import { uuidSchema, type JourneyEditorDocument, type PatternConfig } from '@odyssey/schemas'
import { createSystemCanvasViewModel } from '@/canvas/system'
import PatternRouteLayer from '@/features/journey-editor/PatternRouteLayer.vue'

const props = defineProps<{ pattern: PatternConfig }>()
const previewDocument = computed<JourneyEditorDocument>(() => ({
  journey: {
    id: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8ff1'),
    workspaceId: uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8000'),
    name: 'Pattern preview', description: null, status: 'draft', tags: [], revision: 1,
    createdAt: '2026-08-15T00:00:00Z', updatedAt: '2026-08-15T00:00:00Z',
  },
  pattern: props.pattern,
  agents: [],
}))
const model = computed(() => createSystemCanvasViewModel(previewDocument.value, null))
</script>

<template>
  <section class="pattern-readonly-preview" aria-labelledby="pattern-preview-title">
    <header><span class="page-eyebrow">Selected Pattern</span><h2 id="pattern-preview-title">{{ model.name }}</h2></header>
    <div class="pattern-readonly-preview__stage" :style="{ width: `${model.bounds?.width}px`, height: `${model.bounds?.height}px` }">
      <PatternRouteLayer :routes="model.routes" :width="model.bounds?.width ?? 468" :height="model.bounds?.height ?? 174" />
      <div v-for="slot in model.slots" :key="slot.id" class="pattern-preview-slot" :style="{ left: `${slot.position.x}px`, top: `${slot.position.y}px` }">
        <span>{{ slot.order === null ? '○' : slot.order + 1 }}</span><strong>{{ slot.label }}</strong><small>{{ slot.topologyRole ?? 'stage' }}</small>
      </div>
    </div>
    <p>This preview is read-only. Slots can be configured after creation.</p>
  </section>
</template>
