<script setup lang="ts">
import type { AgentTemplate, UUID } from '@odyssey/schemas'
defineProps<{ templates: readonly AgentTemplate[]; loading?: boolean; error?: string | null }>()
defineEmits<{ choose: [templateId: UUID] }>()
</script>
<template><aside class="journey-library"><h2>Agent templates</h2><p>Drag a saved template into an empty slot</p><p v-if="loading" role="status">Loading Agent templates…</p><p v-else-if="error" role="alert">{{ error }}</p><div v-else-if="templates.length === 0" class="library-empty"><strong>No Agent templates yet</strong><span>Create an Agent, then use Save as Template.</span></div><button v-for="template in templates" v-else :key="template.id" class="template-card template-card--agent" @click="$emit('choose', template.id)"><i>{{ template.name.charAt(0) }}</i><strong>{{ template.name }}</strong><span>{{ template.description ?? 'Reusable Agent workflow' }}</span></button></aside></template>
