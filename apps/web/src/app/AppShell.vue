<script setup lang="ts">
import { provide, ref } from 'vue'
import GlobalNavigation from './GlobalNavigation.vue'
import ProductHeader from './ProductHeader.vue'
import { appShellPresentationKey } from './appShellPresentation'

const isFocusMode = ref(false)
const isProductHeaderVisible = ref(true)
const isNavigationCollapsed = ref(false)
provide(appShellPresentationKey, {
  setFocusMode(enabled) { isFocusMode.value = enabled },
  setProductHeaderVisible(visible) { isProductHeaderVisible.value = visible },
})
</script>

<template>
  <div class="app-shell" :class="{ 'is-focus-mode': isFocusMode, 'is-navigation-collapsed': isNavigationCollapsed }">
    <GlobalNavigation :collapsed="isNavigationCollapsed" @toggle="isNavigationCollapsed = !isNavigationCollapsed" />
    <div class="app-shell__workspace">
      <ProductHeader v-if="isProductHeaderVisible" />
      <main class="app-shell__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
