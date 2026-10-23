<script setup lang="ts">
import odysseyLogoUrl from '../../../../doc/assets/brand/odyssey-logo.png'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const items = [
  { label: 'Community', disabled: true },
  { label: 'OdyJourney', to: '/journeys' },
  { label: 'Assets', to: '/assets/knowledge-spaces' },
  { label: 'Settings', disabled: true },
] as const
</script>

<template>
  <aside class="global-navigation" :class="{ 'is-collapsed': collapsed }" aria-label="Primary navigation">
    <div class="global-navigation__header">
      <RouterLink class="app-brand" to="/" aria-label="Odyssey home">
        <span class="app-brand__mark"><img :src="odysseyLogoUrl" alt="" /></span>
        <span class="app-brand__name">ODYSSEY</span>
      </RouterLink>
      <button
        class="global-navigation__toggle"
        type="button"
        :aria-label="collapsed ? 'Expand primary navigation' : 'Collapse primary navigation'"
        :aria-expanded="!collapsed"
        @click="$emit('toggle')"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m12 5-5 5 5 5" /></svg>
      </button>
    </div>
    <nav v-show="!collapsed" class="global-navigation__items">
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
