<script setup lang="ts">
import type { WorkflowResourceCategory } from '@/stores/workflowEditor'

const props = defineProps<{
  category: WorkflowResourceCategory
  panelCollapsed: boolean
  focusMode: boolean
  compact: boolean
}>()
const emit = defineEmits<{
  select: [category: WorkflowResourceCategory]
  toggleCompact: []
}>()

const items: readonly { category: WorkflowResourceCategory; label: string; icon: 'tools' | 'knowledge' | 'variables' | 'dsl' | 'reusable' }[] = [
  { category: 'tools', label: 'Tools', icon: 'tools' },
  { category: 'knowledge-spaces', label: 'Knowledge Spaces', icon: 'knowledge' },
  { category: 'agent-variables', label: 'Agent Variables', icon: 'variables' },
  { category: 'dsl-edit', label: 'DSL Edit', icon: 'dsl' },
  { category: 'reusable-tools', label: 'Reusable Tools', icon: 'reusable' },
]
</script>

<template>
  <nav class="workflow-resource-nav" :class="{ 'is-focus-nav': props.focusMode, 'is-compact': props.focusMode && props.compact }" aria-label="Agent resource configuration">
    <button v-if="props.focusMode" type="button" class="resource-nav-collapse" :aria-label="props.compact ? 'Expand resource navigation' : 'Collapse resource navigation'" :aria-expanded="!props.compact" :data-tooltip="props.compact ? 'Expand resources' : 'Collapse resources'" @click="emit('toggleCompact')">
      <svg viewBox="0 0 18 18" aria-hidden="true"><path :d="props.compact ? 'M5 11L9 7L13 11' : 'M5 7L9 11L13 7'" /></svg>
    </button>
    <span v-if="props.focusMode" class="resource-nav-divider" aria-hidden="true" />
    <button v-for="item in items" :key="item.category" type="button" class="resource-nav-item" :class="{ 'is-active': props.category === item.category && !props.panelCollapsed }" :aria-label="item.label" :data-tooltip="props.focusMode && props.compact ? item.label : undefined" @click="emit('select', item.category)">
      <svg viewBox="0 0 18 18" aria-hidden="true">
        <path v-if="item.icon === 'tools'" d="M10.8 3.2A4 4 0 0 0 6 8L2.8 11.2a1.7 1.7 0 0 0 2.4 2.4L8.4 10.4a4 4 0 0 0 4.8-4.8l-2.5 2.5-1.8-.5-.5-1.8 2.4-2.6Z" />
        <path v-else-if="item.icon === 'knowledge'" d="M3 4.2c2.2-.6 4-.1 6 1.1v9c-2-1.2-3.8-1.7-6-1.1v-9Zm12 0c-2.2-.6-4-.1-6 1.1v9c2-1.2 3.8-1.7 6-1.1v-9Z" />
        <path v-else-if="item.icon === 'variables'" d="M6.2 3.2H4.8c-.9 0-1.6.7-1.6 1.6v1.4M6.2 14.8H4.8c-.9 0-1.6-.7-1.6-1.6v-1.4M11.8 3.2h1.4c.9 0 1.6.7 1.6 1.6v1.4M11.8 14.8h1.4c.9 0 1.6-.7 1.6-1.6v-1.4M6.5 11.8l5-5M7 6.8h.01M11 11.8h.01" />
        <path v-else-if="item.icon === 'dsl'" d="M6.5 5L3 9l3.5 4M11.5 5 15 9l-3.5 4M10.3 3.5 7.7 14.5" />
        <path v-else d="M5.1 5.1A5.5 5.5 0 0 1 14.5 9M12.9 12.9A5.5 5.5 0 0 1 3.5 9M14.5 5.5V9h-3.5M3.5 12.5V9H7" />
      </svg>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
