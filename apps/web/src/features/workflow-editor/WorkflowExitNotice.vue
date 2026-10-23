<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { UUID } from '@odyssey/schemas'
import { colors, radii, shadows } from '@odyssey/design-tokens'
import type { workflowEndRoutingStatus } from '@/domain/workflow/workflowEndRouting'

const props = defineProps<{
  status: ReturnType<typeof workflowEndRoutingStatus>
  agentId: UUID
}>()
const dismissed = ref(false)
const hasNotice = computed(() => props.status?.synchronized && (props.status.missingTargets > 0 || props.status.unconnected > 0))
watch([() => props.agentId, () => props.status?.synchronized, () => props.status?.missingTargets, () => props.status?.unconnected], () => { dismissed.value = false })
const noticeStyle = {
  '--notice-ink': colors.ink,
  '--notice-muted': colors.muted,
  '--notice-accent': colors.primary,
  '--notice-border': colors.border,
  '--notice-surface': colors.surface,
  '--notice-radius': radii.md,
  '--notice-shadow': shadows.panel,
}
</script>

<template>
  <Teleport to="body">
    <Transition name="workflow-toast">
      <aside v-if="status && hasNotice && !dismissed" class="workflow-exit-notice" :style="noticeStyle" aria-label="Workflow exit notice">
        <div role="status" aria-live="polite">
          <strong>Workflow exits need configuration</strong>
          <p>{{ status.unconnected }} exits need internal connections · {{ status.missingTargets }} target Slots need an Agent.</p>
        </div>
        <button type="button" class="workflow-exit-notice__close" aria-label="Dismiss exit notice" @click="dismissed = true">×</button>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.workflow-exit-notice { position:fixed; z-index:1300; top:76px; left:50%; transform:translateX(-50%); width:min(440px,calc(100vw - 32px)); box-sizing:border-box; padding:14px 40px 14px 16px; border:1px solid var(--notice-border); border-radius:var(--notice-radius); background:var(--notice-surface); color:var(--notice-ink); box-shadow:var(--notice-shadow); font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
.workflow-exit-notice strong { font-size:13px; }
.workflow-exit-notice p { margin:6px 0 10px; color:var(--notice-muted); }
.workflow-exit-notice__close { position:absolute; top:8px; right:8px; width:28px; height:28px; border:0; border-radius:6px; background:transparent; color:var(--notice-muted); cursor:pointer; font-size:20px; }
.workflow-exit-notice__close:focus-visible { outline:2px solid var(--notice-accent); outline-offset:3px; }
@media (prefers-reduced-motion:reduce) { .workflow-toast-enter-active,.workflow-toast-leave-active { transition:none; } }
</style>
