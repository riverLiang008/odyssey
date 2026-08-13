<script setup lang="ts">
import GlobalNavigation from './GlobalNavigation.vue'
import ProductHeader from './ProductHeader.vue'
</script>

<template>
  <div class="app-shell">
    <GlobalNavigation />
    <div class="app-shell__workspace">
      <ProductHeader />
      <main class="app-shell__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
