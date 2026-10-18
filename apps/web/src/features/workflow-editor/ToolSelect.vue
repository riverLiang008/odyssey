<script setup lang="ts">
import { computed, ref } from 'vue'

export interface ToolSelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = defineProps<{
  modelValue: string
  options: readonly ToolSelectOption[]
  controlLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const root = ref<globalThis.HTMLDivElement | null>(null)
const selectedLabel = computed(() => props.options.find((option) => option.value === props.modelValue)?.label ?? props.options[0]?.label ?? '')

function select(option: ToolSelectOption) {
  if (option.disabled) return
  open.value = false
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}

function closeOnFocusOut(event: globalThis.FocusEvent) {
  if (event.relatedTarget instanceof globalThis.Node && root.value?.contains(event.relatedTarget)) return
  open.value = false
}
</script>

<template>
  <div ref="root" class="tool-select" @focusout="closeOnFocusOut" @keydown.escape.stop="open = false">
    <button type="button" class="tool-select-trigger" aria-haspopup="listbox" :aria-expanded="open" :aria-label="`${controlLabel}: ${selectedLabel}`" @click="open = !open">
      <span>{{ selectedLabel }}</span><i aria-hidden="true" />
    </button>
    <div v-if="open" class="tool-select-menu" role="listbox" :aria-label="controlLabel">
      <button v-for="option in options" :key="option.value" type="button" role="option" :disabled="option.disabled" :aria-selected="option.value === modelValue" :class="{ 'is-selected': option.value === modelValue }" @click="select(option)">
        <span>{{ option.label }}</span><b v-if="option.value === modelValue" aria-hidden="true">✓</b>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tool-select { position:relative; width:100%; min-width:0; }
.tool-select-trigger { width:100%; min-height:34px; box-sizing:border-box; border:1px solid var(--tool-border,#d8deea); border-radius:var(--tool-radius,8px); padding:7px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--tool-soft,#eef2f8); color:var(--tool-ink,#172033); font:inherit; line-height:17px; text-align:left; cursor:pointer; transition:border-color .14s ease,background .14s ease,box-shadow .14s ease; }
.tool-select-trigger:hover { border-color:color-mix(in srgb,var(--tool-primary,#4d72f2) 45%,var(--tool-border,#d8deea)); background:color-mix(in srgb,var(--tool-primary,#4d72f2) 4%,var(--tool-soft,#eef2f8)); }
.tool-select-trigger:focus-visible,.tool-select:focus-within .tool-select-trigger { outline:0; border-color:var(--tool-primary,#4d72f2); background:var(--tool-surface,#fff); box-shadow:0 0 0 2px rgba(77,114,242,.15); }
.tool-select-trigger i { width:7px; height:7px; flex:0 0 7px; border-right:1.5px solid var(--tool-muted,#69758c); border-bottom:1.5px solid var(--tool-muted,#69758c); transform:translateY(-2px) rotate(45deg); transition:transform .14s ease; }
.tool-select-trigger[aria-expanded="true"] i { transform:translateY(2px) rotate(225deg); }
.tool-select-menu { position:absolute; z-index:60; top:calc(100% + 5px); left:0; right:0; min-width:180px; box-sizing:border-box; padding:5px; border:1px solid var(--tool-border,#d8deea); border-radius:8px; display:grid; gap:2px; background:var(--tool-surface,#fff); box-shadow:0 12px 26px rgba(23,32,51,.17); }
.tool-select-menu button { width:100%; min-height:32px; border:0; border-radius:5px; padding:7px 9px; display:flex; align-items:center; justify-content:space-between; gap:8px; background:transparent; color:var(--tool-ink,#172033); font:inherit; line-height:17px; text-align:left; cursor:pointer; }
.tool-select-menu button:hover:not(:disabled),.tool-select-menu button:focus-visible:not(:disabled) { outline:0; background:#eef3ff; color:#294fb7; }
.tool-select-menu button.is-selected { background:#e7eeff; color:#294fb7; font-weight:650; }
.tool-select-menu button:disabled { opacity:.4; cursor:not-allowed; }
.tool-select-menu b { color:var(--tool-primary,#4d72f2); font-size:10px; }
</style>
