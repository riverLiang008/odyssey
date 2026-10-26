<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

export interface AppSelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = defineProps<{
  modelValue: string
  options: readonly AppSelectOption[]
  controlLabel: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const isOpen = ref(false)
const root = ref<globalThis.HTMLDivElement | null>(null)
const trigger = ref<globalThis.HTMLButtonElement | null>(null)
const optionButtons = ref<Array<globalThis.HTMLButtonElement | undefined>>([])
const selectedIndex = computed(() => Math.max(0, props.options.findIndex((option) => option.value === props.modelValue)))
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? '')

async function openAndFocusSelected() {
  isOpen.value = true
  await nextTick()
  const selected = optionButtons.value[selectedIndex.value]
  const target = selected && !selected.disabled ? selected : optionButtons.value.find(button => button && !button.disabled)
  target?.focus()
}

async function closeAndRestoreFocus() {
  isOpen.value = false
  await nextTick()
  trigger.value?.focus()
}

function escape(event: globalThis.KeyboardEvent) {
  if (!isOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  void closeAndRestoreFocus()
}

function select(option: AppSelectOption) {
  if (option.disabled) return
  void closeAndRestoreFocus()
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}

function closeOnFocusOut(event: globalThis.FocusEvent) {
  if (event.relatedTarget instanceof globalThis.Node && root.value?.contains(event.relatedTarget)) return
  isOpen.value = false
}

function setOptionButton(element: unknown, index: number) {
  if (element instanceof globalThis.HTMLButtonElement) optionButtons.value[index] = element
}

function focusAdjacent(currentIndex: number, direction: 1 | -1) {
  const enabled = props.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled)
  const position = enabled.findIndex(({ index }) => index === currentIndex)
  const next = enabled[(position + direction + enabled.length) % enabled.length]
  if (next) optionButtons.value[next.index]?.focus()
}
</script>

<template>
  <div ref="root" class="app-select" @focusout="closeOnFocusOut" @keydown.escape="escape">
    <button
      ref="trigger"
      type="button"
      class="app-select__trigger"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-label="`${controlLabel}: ${selectedLabel}`"
      @click="isOpen ? (isOpen = false) : openAndFocusSelected()"
      @keydown.down.prevent="openAndFocusSelected"
      @keydown.up.prevent="openAndFocusSelected"
    >
      <span>{{ selectedLabel }}</span>
      <i aria-hidden="true" />
    </button>

    <div v-if="isOpen" class="app-select__menu" role="listbox" :aria-label="controlLabel">
      <button
        v-for="(option, index) in options"
        :key="option.value"
        :ref="(element) => setOptionButton(element, index)"
        type="button"
        role="option"
        :disabled="option.disabled"
        :aria-selected="option.value === modelValue"
        :class="{ 'is-selected': option.value === modelValue }"
        @click="select(option)"
        @keydown.down.prevent="focusAdjacent(index, 1)"
        @keydown.up.prevent="focusAdjacent(index, -1)"
        @keydown.home.prevent="optionButtons.find((button) => button && !button.disabled)?.focus()"
        @keydown.end.prevent="[...optionButtons].reverse().find((button) => button && !button.disabled)?.focus()"
      >
        <span>{{ option.label }}</span>
        <b v-if="option.value === modelValue" aria-hidden="true">✓</b>
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-select { position: relative; min-width: 0; }
.app-select__trigger { width: 100%; min-height: 42px; box-sizing: border-box; border: 1px solid #d5deef; border-radius: 10px; padding: 9px 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #f8faff; color: #21304b; font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease, box-shadow .15s ease; }
.app-select__trigger:hover { border-color: #aebde0; background: #fff; }
.app-select__trigger:focus-visible,
.app-select:focus-within .app-select__trigger { outline: 0; border-color: #4f71f2; background: #fff; box-shadow: 0 0 0 3px rgba(79, 113, 242, .13); }
.app-select__trigger i { width: 8px; height: 8px; flex: 0 0 8px; border-right: 1.5px solid #50617f; border-bottom: 1.5px solid #50617f; transform: translateY(-2px) rotate(45deg); transition: transform .15s ease; }
.app-select__trigger[aria-expanded="true"] i { transform: translateY(2px) rotate(225deg); }
.app-select__menu { position: absolute; z-index: 30; top: calc(100% + 7px); left: 0; right: 0; min-width: 190px; box-sizing: border-box; padding: 6px; border: 1px solid #d8e0ef; border-radius: 10px; display: grid; gap: 2px; background: #fff; box-shadow: 0 16px 36px rgba(31, 48, 81, .16); }
.app-select__menu button { min-height: 34px; border: 0; border-radius: 7px; padding: 7px 9px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: transparent; color: #21304b; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.app-select__menu button:hover:not(:disabled),
.app-select__menu button:focus-visible:not(:disabled) { outline: 0; background: #f1f5ff; color: #3156bd; }
.app-select__menu button.is-selected { background: #e9efff; color: #3156bd; font-weight: 650; }
.app-select__menu button:disabled { opacity: .4; cursor: not-allowed; }
.app-select__menu b { color: #4f71f2; font-size: 12px; }
</style>
