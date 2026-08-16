<script setup lang="ts">
import type { AgentTemplate, UUID } from '@odyssey/schemas'
import { ODYSSEY_DRAG_MIME, serializeOdysseyDragPayload, type PatternDragPayload } from '@/canvas/interaction'
const props = defineProps<{ templates: readonly AgentTemplate[]; loading?: boolean; error?: string | null; disabled?: boolean }>()
const emit = defineEmits<{ choose: [templateId: UUID]; dragStart: [payload: PatternDragPayload] }>()
function startDrag(event: globalThis.DragEvent, templateId: UUID) {
  if (props.disabled) return
  const payload = { version: 1, kind: 'agent-template', templateId } as const
  event.dataTransfer?.setData(ODYSSEY_DRAG_MIME, serializeOdysseyDragPayload(payload))
  emit('dragStart', payload)
}
function choose(templateId: UUID) { if (!props.disabled) emit('choose', templateId) }
</script>
<template><aside class="journey-library"><h2>Agent templates</h2><p>Drag a saved template into an empty slot</p><p v-if="loading" role="status">Loading Agent templates…</p><p v-else-if="error" role="alert">{{ error }}</p><div v-else-if="templates.length === 0" class="library-empty"><strong>No Agent templates yet</strong><span>Create an Agent, then use Save as Template.</span></div><button v-for="template in templates" v-else :key="template.id" class="template-card template-card--agent" :disabled="disabled" :draggable="!disabled" @dragstart="startDrag($event, template.id)" @click="choose(template.id)"><i>{{ template.name.charAt(0) }}</i><strong>{{ template.name }}</strong><span>{{ template.description ?? 'Reusable Agent workflow' }}</span></button></aside></template>
