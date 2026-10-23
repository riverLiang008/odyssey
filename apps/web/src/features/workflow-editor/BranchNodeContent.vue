<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { workflowBranch } from '@odyssey/design-tokens'
import type { AgentVariable, BranchNode, UUID } from '@odyssey/schemas'
import { branchConditionSummary, branchDraftFromNode, parseBranchDraft } from '@/domain/workflow/branchDrafts'
const props = defineProps<{ node: BranchNode; expanded: boolean; variables: readonly AgentVariable[]; connectedHandles: readonly UUID[]; readOnly?: boolean }>()
const emit = defineEmits<{ rename: [name: string] }>()
const editing = ref(false)
const name = ref('')
const input = ref<globalThis.HTMLInputElement | null>(null)
async function editName() { if (props.readOnly) return; name.value = props.node.name; editing.value = true; await nextTick(); input.value?.focus(); input.value?.select() }
function finishName(commit: boolean) { if (!editing.value) return; editing.value = false; if (commit && !props.readOnly && name.value.trim() && name.value.trim() !== props.node.name) emit('rename', name.value.trim()) }
const root = ref<globalThis.HTMLElement | null>(null)
const { updateNodeInternals } = useVueFlow()
let observer: globalThis.ResizeObserver | null = null
let active = true
async function refresh() {
  await nextTick()
  // Hidden/unlaid-out nodes have no handle geometry yet. ResizeObserver will
  // refresh them when they become measurable, without feeding zero bounds to Vue Flow.
  if (active && root.value?.getBoundingClientRect().width) updateNodeInternals([props.node.id])
}
onMounted(() => { observer = new globalThis.ResizeObserver(() => { void refresh() }); if (root.value) observer.observe(root.value); void refresh() })
onBeforeUnmount(() => { active = false; observer?.disconnect() })
watch(() => [props.node, props.expanded, props.variables], () => { void refresh() }, { deep: true })
function connected(id: UUID) { return props.connectedHandles.includes(id) }
function caseInvalid(id: UUID) {
  const result = parseBranchDraft(branchDraftFromNode(props.node), props.variables)
  return !result.ok && result.issues.some(i => i.caseId === id)
}
</script>
<template>
  <section ref="root" class="branch-node-content" :style="{ '--branch-surface': workflowBranch.surface, '--branch-gap': workflowBranch.gap }">
    <header><span>BRANCH</span><div v-if="expanded && !readOnly" class="node-name-editor nodrag nopan" data-no-node-inspector="true" @pointerdown.stop @click.stop><button v-if="!editing" type="button" aria-label="Edit branch name" @click="editName">{{ node.name }}</button><input v-else ref="input" v-model="name" aria-label="branch name" @blur="finishName(true)" @keydown.enter.stop.prevent="finishName(true)" @keydown.escape.stop.prevent="finishName(false)" /></div><strong v-else>{{ node.name }}</strong></header>
    <small>First match wins · {{ node.config.cases.length }} cases + Default</small>
    <ol aria-label="Branch routes">
      <li v-for="(c, index) in node.config.cases" :key="c.id" :data-case-id="c.id">
        <strong>{{ index + 1 }}. {{ c.label }}</strong>
        <small v-if="expanded">{{ c.conditions.map(condition => branchConditionSummary(condition, variables)).join(' AND ') }}</small>
        <small v-if="expanded && caseInvalid(c.id)" class="branch-node-error">⚠ Review invalid or unavailable variables</small>
        <small v-if="expanded && !connected(c.id)">⚠ Not connected</small>
        <Handle :id="c.id" type="source" :position="Position.Right" class="workflow-handle branch-row-handle" :connectable="!readOnly" :title="`${c.label} exit`" :aria-label="`${c.label} exit`" />
      </li>
      <li :data-case-id="node.config.defaultCase.id"><strong>↳ {{ node.config.defaultCase.label }}</strong><small v-if="expanded">When no case matches</small><small v-if="expanded && !connected(node.config.defaultCase.id)">⚠ Not connected</small><Handle :id="node.config.defaultCase.id" type="source" :position="Position.Right" class="workflow-handle branch-row-handle" :connectable="!readOnly" title="Default exit" aria-label="Default exit" /></li>
    </ol>
    <small v-if="expanded && !node.config.cases.length">Add a case in the Branch configuration panel.</small>
  </section>
</template>
<style scoped>
.branch-node-content { display:grid; gap:var(--branch-gap); }.branch-node-content header { display:flex; align-items:center; gap:12px; }.branch-node-content header span { font-size:10px; flex-shrink:0; }.branch-node-content header .node-name-editor { flex:1; min-width:0; margin:0; }.branch-node-content header .node-name-editor button { overflow-wrap:anywhere; white-space:normal; }.branch-node-content header strong { font-size:15px; overflow-wrap:anywhere; }.branch-node-content ol { display:grid; gap:12px; margin:0; padding:0; list-style:none; }.branch-node-content li { position:relative; display:grid; gap:4px; padding:10px; border-radius:8px; background:var(--branch-surface); overflow-wrap:anywhere; }.branch-node-content li strong { font-size:12px; }.branch-node-content small { margin:0; font-size:11px; line-height:1.5; }.branch-node-content :deep(.branch-row-handle) { right:calc(-1px - var(--branch-padding)); top:50%; }.branch-node-error { color:var(--odyssey-error) !important; }
</style>
