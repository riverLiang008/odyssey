<script setup lang="ts">
defineProps<{ label?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <button
    type="button"
    class="resource-browser-collapse"
    :aria-label="label ?? 'Close resources'"
    :title="label ?? 'Close resources'"
    @click="$emit('close')"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 3.5l9 9m0-9-9 9" />
    </svg>
  </button>
</template>
