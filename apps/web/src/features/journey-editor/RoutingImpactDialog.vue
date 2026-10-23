<script setup lang="ts">
import { NModal } from 'naive-ui'
import type { RoutingImpact, UUID } from '@odyssey/schemas'

defineProps<{
  impact: readonly RoutingImpact[]
  agents: readonly { id: UUID; name: string }[]
  busy?: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <NModal :show="true" preset="dialog" title="Update Pattern-owned exits?" :mask-closable="false" :closable="!busy" :loading="busy" :negative-button-props="{ disabled: busy }" :positive-button-props="{ disabled: busy }" positive-text="Apply and repair paths" negative-text="Discard Pattern changes" @positive-click="!busy && emit('confirm')" @negative-click="!busy && emit('cancel')" @close="!busy && emit('cancel')" @esc="!busy && emit('cancel')">
    <p>The Pattern will update the following Workflow exits. Removed incoming connections will be deleted; upstream nodes remain for you to reconnect. No connection is automatically redirected.</p>
    <ul>
      <li v-for="item in impact" :key="item.agentId">
        {{ agents.find(agent => agent.id === item.agentId)?.name ?? item.agentId }}:
        {{ item.removedEndIds.length }} removed exits, {{ item.removedEdgeIds.length }} removed connections<span v-if="item.legacy">; upgrade legacy boundaries</span>.
      </li>
    </ul>
    <p>Cancelling reloads the saved Pattern and discards its pending changes.</p>
  </NModal>
</template>
