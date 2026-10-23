<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { WorkflowPreviewViewModel } from '@/canvas/workflow-preview'
import WorkflowNodeRenderer from '@/features/workflow-editor/WorkflowNodeRenderer.vue'

const props = defineProps<{ model: WorkflowPreviewViewModel }>()
const canvasId = `workflow-preview-${useId()}`
const root = ref<globalThis.HTMLElement | null>(null)
const { fitView, onNodesInitialized } = useVueFlow(canvasId)
let observer: globalThis.ResizeObserver | undefined
let frame: number | undefined
let disposed = false

// Wait for actual card dimensions, including dynamic content and Loop children.
// One viewport transform scales cards, ports and smoothstep edges together.
function scheduleFit() {
  if (disposed || frame !== undefined) return
  frame = globalThis.requestAnimationFrame(() => {
    frame = undefined
    void fitView({ padding: '16px', minZoom: 0.001, maxZoom: 1, duration: 0 })
  })
}
onNodesInitialized(() => {
  observeCards()
  scheduleFit()
})
watch(() => props.model, async () => {
  await nextTick()
  observeCards()
  scheduleFit()
})
function observeCards() {
  observer?.disconnect()
  if (!root.value) return
  observer?.observe(root.value)
  root.value.querySelectorAll('.workflow-node-card').forEach((card) => observer?.observe(card))
}
onMounted(() => {
  observer = new globalThis.ResizeObserver(scheduleFit)
  observeCards()
  scheduleFit()
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  if (frame !== undefined) globalThis.cancelAnimationFrame(frame)
})
</script>

<template>
  <div ref="root" class="workflow-preview-canvas" role="img" :aria-label="`${model.agentName} Workflow: ${model.nodes.length} nodes and ${model.edges.length} edges`">
    <div class="workflow-preview-canvas__surface" inert aria-hidden="true">
      <VueFlow
        :id="canvasId" :nodes="model.nodes" :edges="model.edges"
        :nodes-draggable="false" :nodes-connectable="false" :elements-selectable="false"
        :edges-updatable="false" :nodes-focusable="false" :edges-focusable="false"
        :connect-on-click="false" :auto-connect="false" :select-nodes-on-drag="false"
        :pan-on-drag="false" :pan-on-scroll="false" :zoom-on-scroll="false"
        :zoom-on-pinch="false" :zoom-on-double-click="false"
        :delete-key-code="null" :selection-key-code="null" :multi-selection-key-code="null"
        :pan-activation-key-code="null" :zoom-activation-key-code="null"
        :disable-keyboard-a11y="true" :prevent-scrolling="false"
        :min-zoom="0.001" :max-zoom="1"
      >
        <template #node-workflow="nodeProps">
          <WorkflowNodeRenderer class="workflow-preview-node" v-bind="nodeProps" :configure-expanded="true" :read-only="true" :variables="nodeProps.data.node.type === 'branch' ? model.branchVariables : undefined" />
        </template>
      </VueFlow>
    </div>
  </div>
</template>

<style scoped>
.workflow-preview-canvas { position: relative; width: 100%; height: 100%; overflow: hidden; }
.workflow-preview-canvas__surface { width: 100%; height: 100%; pointer-events: none; user-select: none; }
/* Preview renders the real cards; inert prevents their form controls from acting. */
.workflow-preview-canvas :deep(.compound-loop-resize),
.workflow-preview-canvas :deep(.task-tool-step-actions) { visibility: hidden; }
</style>
