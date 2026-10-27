<script setup lang="ts">
import { NConfigProvider, NGlobalStyle } from 'naive-ui'
import { isPublicDemo } from '@/app/appMode'
</script>

<template>
  <NConfigProvider>
    <NGlobalStyle />
    <RouterView />
    <aside v-if="isPublicDemo" class="public-demo-notice" role="note">PUBLIC DEMO · Read only · No uploads or cloud saves</aside>
  </NConfigProvider>
</template>

<style>
.public-demo-notice {
  position: fixed; z-index: 1000; bottom: 10px; left: 50%; transform: translateX(-50%);
  padding: 6px 12px; border: 1px solid var(--odyssey-border); border-radius: 8px;
  background: var(--odyssey-surface, white); color: var(--odyssey-text-secondary, #667085);
  font-size: 11px; pointer-events: none; max-width: calc(100vw - 24px); text-align: center;
}
</style>

