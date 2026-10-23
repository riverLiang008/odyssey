<script setup lang="ts">
import { computed, ref } from 'vue'
import { uuidSchema, type UUID } from '@odyssey/schemas'

const props = defineProps<{
  sources: readonly { id: UUID; name: string }[]
  targets: readonly { id: UUID; name: string }[]
}>()
const emit = defineEmits<{ update: [mapping: { sourceEndId: UUID; targetEndId: UUID }[] | null] }>()
const selection = ref<Record<string, string>>({})
const complete = computed(() => props.sources.every((source) => props.targets.some((target) => target.id === selection.value[source.id])))
function change(sourceEndId: UUID, event: globalThis.Event) {
  if (!(event.target instanceof globalThis.HTMLSelectElement)) return
  selection.value = { ...selection.value, [sourceEndId]: event.target.value }
  emit('update', complete.value ? props.sources.map((source) => ({ sourceEndId: source.id, targetEndId: uuidSchema.parse(selection.value[source.id]) })) : null)
}
</script>

<template>
  <fieldset>
    <legend>Match imported exits to this Pattern</legend>
    <p>Choose a destination for every source exit. Other Pattern exits remain available and unconnected.</p>
    <label v-for="source in sources" :key="source.id" class="end-mapping-field">
      <span>{{ source.name }}</span>
      <select :aria-label="`Destination for ${source.name}`" :value="selection[source.id] ?? ''" @change="change(source.id, $event)">
        <option disabled value="">Choose destination</option>
        <option v-for="target in targets" :key="target.id" :value="target.id">{{ target.name }}</option>
      </select>
    </label>
  </fieldset>
</template>

<style scoped>
.end-mapping-field { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-block: .75rem; }
select { max-width: 65%; padding: .4rem; font: inherit; }
</style>
