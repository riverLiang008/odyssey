<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isKnowledge = computed(() => String(route.name ?? '').startsWith('knowledge-space'))
</script>

<template>
  <header class="product-header">
    <RouterLink :to="isKnowledge ? '/assets/knowledge-spaces' : '/journeys'" class="product-header__back">{{ isKnowledge ? '← Assets / Knowledge Spaces' : '← OdyJourney' }}</RouterLink>
  </header>
</template>
