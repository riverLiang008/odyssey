<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { colors } from '@odyssey/design-tokens'
import type { DslDiagnostic } from '@/domain/workflow-dsl/syntax'
import { sourcePosition } from '@/domain/workflow-dsl/syntax'
import ResourcePanelCloseButton from './ResourcePanelCloseButton.vue'
import { dslDiagnosticMessage } from './dslMessages'

const props = defineProps<{ source: string; phase: string; diagnostics: readonly DslDiagnostic[]; dirty: boolean; readOnly: boolean; blocked: boolean; applyError: string }>()
const emit = defineEmits<{ edit: [source: string]; apply: []; format: []; revert: []; close: []; reviewReplacement: [] }>()
const textarea = ref<globalThis.HTMLTextAreaElement | null>(null)
const scrollTop = ref(0)
const scrollLeft = ref(0)
const confirmRevert = ref(false)
const confirmReplace = ref(false)
const problemsOpen = ref(true)
const errorCount = computed(() => props.diagnostics.filter((item) => item.severity === 'error').length)
const lineCount = computed(() => props.source.split('\n').length)
const tokens = computed(() => {
  const result: Array<{ text: string; kind: string }> = []
  const pattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|\b(?:workflow|version|variables|nodes|edges|agent_action|task|branch|loop|end|start|case|when|default|step|using|system_tool|config|goal|model|knowledge|toolbox)\b|\b\d+(?:\.\d+)?\b/g
  let offset = 0
  for (const match of props.source.matchAll(pattern)) {
    if (match.index > offset) result.push({ text: props.source.slice(offset, match.index), kind: 'plain' })
    const text = match[0]
    result.push({ text, kind: text.startsWith('/') ? 'comment' : text.startsWith('"') ? 'string' : /^\d/.test(text) ? 'number' : 'keyword' })
    offset = match.index + text.length
  }
  result.push({ text: props.source.slice(offset) + '\n', kind: 'plain' })
  let start = 0
  return result.map((token) => {
    const end = start + token.text.length
    const hasError = props.diagnostics.some((item) => item.severity === 'error' && item.span.start < end && item.span.end > start)
    start = end
    return { ...token, hasError }
  })
})
function scroll(event: globalThis.Event) {
  if (!(event.target instanceof globalThis.HTMLTextAreaElement)) return
  scrollTop.value = event.target.scrollTop
  scrollLeft.value = event.target.scrollLeft
}
function input(event: globalThis.Event) {
  if (event.target instanceof globalThis.HTMLTextAreaElement) emit('edit', event.target.value)
}
async function jump(item: DslDiagnostic) {
  await nextTick()
  textarea.value?.focus()
  textarea.value?.setSelectionRange(item.span.start, item.span.end)
  const position = sourcePosition(props.source, item.span.start)
  if (textarea.value) { textarea.value.scrollTop = Math.max(0, (position.line - 3) * 22); scrollTop.value = textarea.value.scrollTop }
}
</script>

<template>
  <aside class="workflow-resource-browser workflow-dsl-panel" aria-label="DSL Edit" :style="{ '--dsl-border': colors.border, '--dsl-ink': colors.ink, '--dsl-muted': colors.muted, '--dsl-primary': colors.primary, '--dsl-surface': colors.canvas, '--dsl-success': colors.success, '--dsl-warning': colors.warning, '--dsl-error': colors.error }">
    <header><div><p class="workflow-eyebrow">RESOURCES</p><h2>DSL Edit</h2></div><ResourcePanelCloseButton @close="emit('close')" /></header>
    <p class="dsl-sync-state" role="status" aria-live="polite">{{ phase === 'synced' ? 'Synced with Canvas' : phase === 'ready' ? 'Ready to apply' : phase.replaceAll('-', ' ') }}<span v-if="dirty"> · Unapplied changes</span></p>
    <p v-if="phase === 'stale'" class="field-error">Canvas or resources changed. Your draft is preserved. Review before replacing the Canvas, or revert to its current version.</p>
    <div v-if="phase === 'stale' || diagnostics.some(item => item.code === 'ODSL507')" class="dsl-revert-confirm"><button type="button" :disabled="readOnly || blocked" @click="confirmReplace = true">Review replacement</button><div v-if="confirmReplace"><p>The Canvas or resources changed. Rechecking your draft may replace newer nodes and connections. Resource names will resolve against the current inventory. Pattern exits remain fixed.</p><button type="button" @click="emit('reviewReplacement'); confirmReplace = false">Recheck against current Canvas</button><button type="button" @click="confirmReplace = false">Cancel</button><p>Review diagnostics, then use Apply to Canvas to commit.</p></div></div>
    <div class="dsl-actions">
      <button type="button" class="primary-panel-button" :disabled="readOnly || blocked || !dirty || phase !== 'ready'" @click="emit('apply')">Apply to Canvas</button>
      <button type="button" :disabled="readOnly || !['ready', 'synced'].includes(phase)" @click="emit('format')">Format</button>
      <button type="button" @click="dirty ? confirmRevert = true : emit('revert')">Revert</button>
    </div>
    <div v-if="confirmRevert" class="dsl-revert-confirm" role="group" aria-label="Discard DSL changes">
      <p>Discard unapplied DSL and reload the Canvas version?</p>
      <button type="button" @click="emit('revert'); confirmRevert = false">Discard and reload</button><button type="button" @click="confirmRevert = false">Keep editing</button>
    </div>
    <p v-if="applyError" class="field-error" role="alert">Apply failed: {{ applyError }}. Your draft is preserved.</p>
    <div class="dsl-code-editor" @keydown.stop>
      <div class="dsl-line-numbers" aria-hidden="true"><div :style="{ transform: `translateY(-${scrollTop}px)` }"><div v-for="line in lineCount" :key="line">{{ line }}</div></div></div>
      <div class="dsl-source-layer">
        <pre aria-hidden="true" :style="{ transform: `translate(-${scrollLeft}px, -${scrollTop}px)` }"><code><span v-for="(token, index) in tokens" :key="index" :class="[`dsl-${token.kind}`, { 'dsl-has-error': token.hasError }]">{{ token.text }}</span></code></pre>
        <textarea ref="textarea" :value="source" :readonly="readOnly" spellcheck="false" aria-label="Workflow DSL source" :aria-invalid="errorCount > 0" aria-describedby="dsl-edit-help" autocapitalize="off" wrap="off" @input="input" @scroll="scroll" />
      </div>
    </div>
    <p id="dsl-edit-help" class="resource-browser-hint">Edits are checked automatically. Apply updates the Canvas; saving follows the normal autosave flow.</p>
    <button type="button" class="dsl-problems-toggle" :aria-expanded="problemsOpen" @click="problemsOpen = !problemsOpen">Problems · {{ errorCount }} errors · {{ diagnostics.filter(item => item.severity === 'warning').length }} warnings</button>
    <ul v-if="problemsOpen" class="dsl-problems" aria-label="DSL diagnostics">
      <li v-for="(item, index) in diagnostics" :key="`${item.code}-${item.span.start}-${index}`"><button type="button" @click="jump(item)"><strong>{{ item.code }} · {{ item.severity }} · {{ sourcePosition(source, item.span.start).line }}:{{ sourcePosition(source, item.span.start).column }}</strong><span>{{ dslDiagnosticMessage(item) }}</span></button></li>
    </ul>
  </aside>
</template>

<style scoped>
.workflow-dsl-panel { display: flex; flex-direction: column; min-height: 0; gap: 10px; }
.dsl-sync-state { margin: 0; font-size: 12px; text-transform: capitalize; }
.dsl-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.dsl-actions button, .dsl-revert-confirm button { appearance: none; min-height: 34px; padding: 7px 12px; border: 1px solid var(--dsl-border); border-radius: 8px; background: transparent; color: var(--dsl-ink); font: inherit; font-size: 12px; font-weight: 500; line-height: 18px; cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease; }
.dsl-actions .primary-panel-button { grid-column: 1 / -1; width: 100%; margin: 0; border-color: var(--dsl-primary); background: var(--dsl-primary); color: white; }
.dsl-actions button:not(.primary-panel-button):not(:disabled):hover, .dsl-revert-confirm button:not(:disabled):hover { border-color: color-mix(in srgb, var(--dsl-primary) 45%, var(--dsl-border)); background: color-mix(in srgb, var(--dsl-primary) 7%, transparent); color: var(--dsl-primary); }
.dsl-actions .primary-panel-button:not(:disabled):hover { filter: brightness(.96); }
.dsl-actions button:focus-visible, .dsl-revert-confirm button:focus-visible { outline: 2px solid var(--dsl-primary); outline-offset: 2px; }
.dsl-actions button:disabled, .dsl-revert-confirm button:disabled { border-color: var(--dsl-border); background: var(--dsl-surface); color: var(--dsl-muted); cursor: not-allowed; opacity: .65; }
.dsl-revert-confirm button { margin: 4px 6px 0 0; }
.dsl-code-editor { display: flex; flex: 1; min-height: 260px; overflow: hidden; border: 1px solid var(--dsl-border); border-radius: 8px; }
.dsl-line-numbers { width: 36px; padding: 10px 4px; text-align: right; overflow: hidden; flex-shrink: 0; color: var(--dsl-muted); font: 12px/22px monospace; background: var(--dsl-surface); }
.dsl-source-layer { position: relative; flex: 1; min-width: 0; overflow: hidden; }
.dsl-source-layer pre, .dsl-source-layer textarea { margin: 0; padding: 10px; border: 0; font: 12px/22px monospace; tab-size: 2; white-space: pre; letter-spacing: normal; }
.dsl-source-layer pre { position: absolute; inset: 0 auto auto 0; pointer-events: none; min-width: 100%; }
.dsl-source-layer textarea { position: absolute; inset: 0; resize: none; width: 100%; height: 100%; background: transparent; color: transparent; caret-color: var(--dsl-ink); outline-offset: -2px; }
.dsl-source-layer textarea::selection { background: color-mix(in srgb, var(--dsl-primary) 22%, transparent); }
.dsl-keyword { color: var(--dsl-primary); font-weight: 600; }
.dsl-string { color: var(--dsl-success); }
.dsl-comment { color: var(--dsl-muted); }
.dsl-number { color: var(--dsl-warning); }
.dsl-plain { color: var(--dsl-ink); }
.dsl-has-error { text-decoration: underline wavy; text-decoration-color: var(--dsl-error); text-underline-offset: 3px; }
.dsl-problems-toggle { text-align: left; background: transparent; border: 0; cursor: pointer; }
.dsl-problems { padding: 0; margin: 0; max-height: 180px; overflow: auto; list-style: none; }
.dsl-problems button { display: flex; flex-direction: column; width: 100%; padding: 8px; border: 0; text-align: left; background: transparent; font-size: 11px; cursor: pointer; }
.dsl-problems span { overflow-wrap: anywhere; }
.dsl-revert-confirm { border: 1px solid var(--dsl-border); border-radius: 6px; padding: 8px; font-size: 12px; }
</style>





