<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isKnowledge = computed(() => String(route.name ?? '').startsWith('knowledge-space'))
</script>

<template>
  <header class="product-header">
    <RouterLink :to="isKnowledge ? '/assets/knowledge-spaces' : '/journeys'" class="product-header__back">{{ isKnowledge ? '← Assets / Knowledge Spaces' : '← OdyJourney' }}</RouterLink>
    <nav class="product-header__resources" aria-label="Project resources">
      <a
        class="product-header__resource-link"
        href="https://github.com/riverLiang008/odyssey"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Odyssey GitHub repository"
        data-tooltip="GitHub repository"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M15.5 21v-3.5a3.6 3.6 0 0 0-1-2.7c3.3-.4 6.8-1.6 6.8-7.2a5.6 5.6 0 0 0-1.5-3.9 5.2 5.2 0 0 0-.1-3.9S18.5-.6 15.5 1.3a13.4 13.4 0 0 0-7 0C5.5-.6 4.3-.2 4.3-.2a5.2 5.2 0 0 0-.1 3.9 5.6 5.6 0 0 0-1.5 3.9c0 5.6 3.5 6.8 6.8 7.2a3.6 3.6 0 0 0-1 2.7V21" />
          <path d="M8.5 18.5c-3 .9-3-1.5-4.2-2" />
        </svg>
      </a>
      <a
        class="product-header__resource-link"
        href="https://riverliang008.github.io/odyssey-architecture/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Odyssey design documentation"
        data-tooltip="Design documentation"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5.75 4.75h4.5A1.75 1.75 0 0 1 12 6.5v12.75a2.75 2.75 0 0 0-2.75-2.75h-3.5V4.75Z" />
          <path d="M18.25 4.75h-4.5A1.75 1.75 0 0 0 12 6.5v12.75a2.75 2.75 0 0 1 2.75-2.75h3.5V4.75Z" />
        </svg>
      </a>
    </nav>
  </header>
</template>
