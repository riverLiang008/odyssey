<script setup lang="ts">
import type { AgentSummary, GuardrailProjection, GuardrailSide } from '@odyssey/schemas'
import type { MenuAnchor } from '@/canvas/interaction'
import { positionMenuBeside } from './contextMenuPosition'

const props = defineProps<{
  side: GuardrailSide
  projection: GuardrailProjection
  agent: AgentSummary | null
  pending?: boolean
}>()

const emit = defineEmits<{
  add: [side: GuardrailSide]
  select: [side: GuardrailSide]
  menu: [side: GuardrailSide, anchor: MenuAnchor]
}>()

function openMenu(event: globalThis.MouseEvent): void {
  if (props.projection.state !== 'active' || props.pending) return
  const element = event.currentTarget instanceof globalThis.HTMLElement ? event.currentTarget : null
  const rect = element?.getBoundingClientRect()
  if (!rect) return
  emit('menu', props.side, positionMenuBeside(
    { left: rect.left, right: rect.right, top: rect.top },
    { width: globalThis.innerWidth, height: globalThis.innerHeight },
  ))
}
</script>

<template>
  <section
    class="guardrail-module"
    :class="[`guardrail-module--${side}`, { 'is-active': projection.state === 'active', 'is-pending': pending }]"
    :aria-label="`${side === 'input' ? 'Input' : 'Output'} Guardrail`"
  >
    <header>
      <strong>{{ side === 'input' ? 'Input' : 'Output' }} Guardrail</strong>
      <small v-if="projection.state === 'inactive'">Optional</small>
      <small v-else>Single Agent</small>
    </header>
    <button
      v-if="projection.state === 'inactive'"
      class="guardrail-module__add"
      type="button"
      :disabled="pending"
      :aria-label="`Add ${side} Guardrail`"
      @click="emit('add', side)"
    >
      <span aria-hidden="true">+</span>
      <strong>{{ pending ? 'Adding…' : 'Add' }}</strong>
    </button>
    <button
      v-else
      class="guardrail-module__agent"
      type="button"
      :disabled="pending || !agent"
      :aria-label="agent ? `${agent.name}, configured ${side} Guardrail Agent` : `${side} Guardrail Agent unavailable`"
      @click="emit('select', side)"
      @contextmenu.prevent="openMenu"
    >
      <span class="guardrail-module__orb">{{ agent?.name.charAt(0) ?? '!' }}</span>
      <span class="guardrail-module__agent-label">
        <strong>{{ agent?.name ?? 'Agent unavailable' }}</strong>
        <small>{{ pending ? 'Removing…' : agent ? 'Configured' : 'Unavailable' }}</small>
      </span>
    </button>
  </section>
</template>
