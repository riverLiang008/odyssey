<script setup lang="ts">
import odysseyLogoUrl from '../../../../doc/assets/brand/odyssey-logo.png'

const items = [
  { label: 'Community', disabled: true },
  { label: 'OdyJourney', to: '/journeys' },
  { label: 'Assets', disabled: true },
  { label: 'Settings', disabled: true },
] as const
</script>

<template>
  <aside class="global-navigation" aria-label="Primary navigation">
    <RouterLink class="app-brand" to="/" aria-label="Odyssey home">
      <span class="app-brand__mark"><img :src="odysseyLogoUrl" alt="" /></span>
      <span>ODYSSEY</span>
    </RouterLink>
    <span class="plan-label">PRO PLAN</span>
    <nav class="global-navigation__items">
      <template v-for="item in items" :key="item.label">
        <RouterLink v-if="'to' in item" :to="item.to" class="global-navigation__item" active-class="is-active">
          {{ item.label }}
        </RouterLink>
        <span v-else class="global-navigation__item is-disabled" :aria-label="`${item.label}, coming soon`">
          {{ item.label }}
        </span>
      </template>
    </nav>
  </aside>
</template>
