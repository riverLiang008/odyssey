<script setup lang="ts">
import { ref } from 'vue'
import { NModal } from 'naive-ui'
import type { UUID } from '@odyssey/schemas'
import EndMappingFields from '@/features/workflow-editor/EndMappingFields.vue'

defineProps<{ sources: readonly { id: UUID; name: string }[]; targets: readonly { id: UUID; name: string }[]; busy?: boolean; error?: string }>()
const emit = defineEmits<{ confirm: [mapping: { sourceEndId: UUID; targetEndId: UUID }[]]; cancel: [] }>()
const mapping = ref<{ sourceEndId: UUID; targetEndId: UUID }[] | null>(null)
</script>

<template>
  <NModal :show="true" preset="dialog" title="Choose Template exit destinations" :mask-closable="false" :closable="!busy" :loading="busy" :negative-button-props="{ disabled: busy }" :positive-button-props="{ disabled: !mapping || busy }" positive-text="Instantiate Template" negative-text="Cancel" @positive-click="mapping && emit('confirm', mapping)" @negative-click="!busy && emit('cancel')" @close="!busy && emit('cancel')" @esc="!busy && emit('cancel')">
    <EndMappingFields :sources="sources" :targets="targets" @update="mapping = $event" />
    <p v-if="error" role="alert">{{ error }}</p>
  </NModal>
</template>
