import { computed, onScopeDispose, ref, shallowRef, toRaw, watch, type Ref } from 'vue'
import type { AgentWorkflowEditorDocument, AgentWorkflowExportDocument, JourneyEditorDocument, KnowledgeSpaceSummary, UUID } from '@odyssey/schemas'
import { agentWorkflowEditorDocumentSchema, uuidSchema } from '@odyssey/schemas'
import { compileDsl, type DslBaseline, type DslCompileResult } from '@/domain/workflow-dsl/compiler'
import { printWorkflowDsl } from '@/domain/workflow-dsl/printer'
import { collectNodeSignatures, parseDsl, normalizeDslName, type DslDiagnostic } from '@/domain/workflow-dsl/syntax'
import { workflowEndRoutingStatus } from '@/domain/workflow/workflowEndRouting'

type DslPhase = 'unavailable' | 'synced' | 'editing' | 'checking' | 'invalid' | 'ready' | 'stale' | 'context-required' | 'applying' | 'apply-failed'
type CheckState =
  | { readonly type: 'ready'; readonly result: Extract<DslCompileResult, { status: 'checked' }> }
  | { readonly type: Exclude<DslPhase, 'ready'>; readonly diagnostics: readonly DslDiagnostic[] }

export function useWorkflowDsl(input: {
  document: Readonly<Ref<AgentWorkflowEditorDocument | null>>
  journey: Readonly<Ref<JourneyEditorDocument | null>>
  knowledge: Readonly<Ref<KnowledgeSpaceSummary[]>>
  knowledgeStatus: Readonly<Ref<'loading' | 'ready' | 'error'>>
  mutationSeq: () => number
  apply: (document: AgentWorkflowExportDocument, expectedMutationSeq: number) => { ok: boolean; error?: { code: string } }
}) {
  const source = ref('')
  const syncedSource = ref('')
  const baseline = shallowRef<DslBaseline | null>(null)
  const state = shallowRef<CheckState>({ type: 'unavailable', diagnostics: [] })
  const baseMutationSeq = ref(0)
  const applyError = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let canvasTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let allowIdentityReplacement = false
  const dirty = computed(() => source.value !== syncedSource.value)
  const diagnostics = computed(() => state.value.type === 'ready' ? state.value.result.diagnostics : state.value.diagnostics)
  const exitNames = computed(() => {
    const map = new Map<UUID, string>()
    const pattern = input.journey.value?.pattern
    for (const node of input.document.value?.workflow.nodes ?? []) {
      if (node.type !== 'end') continue
      const target = node.config.binding?.target
      const targetId = target?.type === 'slot' ? target.slotId : null
      // Slot labels are stable under reordering/replacement; duplicate labels fail resolution.
      const name = targetId ? pattern?.slots.find((slot) => slot.id === targetId)?.label : target?.type === 'journey_end' ? 'Journey End' : node.name
      map.set(node.id, normalizeDslName(name ?? 'Unavailable exit'))
    }
    return map
  })
  const documentFingerprint = computed(() => {
    // Commands may mutate a shallow document; sequence invalidates this projection,
    // while only semantic changes alter its value.
    input.mutationSeq()
    return JSON.stringify({
    agentId: input.document.value?.agent.id,
    document: input.document.value ? { workflow: { ...input.document.value.workflow, nodes: input.document.value.workflow.nodes.map((node) => node.type === 'loop' ? { ...node, config: { ...node.config, body: { graph: node.config.body.graph } } } : node) }, variables: input.document.value.variables, reusableTools: input.document.value.reusableTools } : null,
    pattern: input.journey.value?.pattern,
    })
  })
  const fingerprint = computed(() => JSON.stringify({
    document: documentFingerprint.value,
    knowledge: input.knowledge.value.map((entry) => [entry.id, entry.name, entry.lifecycleStatus, entry.graphStatus]),
    status: input.knowledgeStatus.value,
  }))
  let baseFingerprint = ''
  let baseDocumentFingerprint = ''
  let awaitingInitialKnowledge = false
  function captureContext() {
    baseFingerprint = fingerprint.value
    baseDocumentFingerprint = documentFingerprint.value
    awaitingInitialKnowledge = input.knowledgeStatus.value !== 'ready'
  }
  function contextDiagnostic(code: string, messageKey = code): DslDiagnostic {
    return { code, severity: 'info', messageKey, span: { start: 0, end: 0 } }
  }
  function check(): DslCompileResult | null {
    clearTimeout(timer)
    if (disposed || !baseline.value || !input.document.value) return null
    if (baseFingerprint !== fingerprint.value) {
      state.value = { type: 'stale', diagnostics: [contextDiagnostic('ODSL505')] }
      return null
    }
    const current = input.document.value
    const journey = input.journey.value
    if (journey && workflowEndRoutingStatus(current.workflow, journey.pattern, current.agent.id)?.synchronized === false) {
      state.value = { type: 'context-required', diagnostics: [...parseDsl(source.value).diagnostics, contextDiagnostic('ODSL504', 'ODSL504_EXIT_ROUTING')] }
      return null
    }
    baseMutationSeq.value = input.mutationSeq()
    const result = compileDsl(source.value, {
      inventory: { knowledge: input.knowledge.value.filter((entry) => ['ready', 'syncing'].includes(entry.lifecycleStatus) && ['healthy', 'needs_review'].includes(entry.graphStatus)), ready: input.knowledgeStatus.value === 'ready' },
      baseline: { ...baseline.value, document: agentWorkflowEditorDocumentSchema.parse(toRaw(current)) },
      createId: () => uuidSchema.parse(crypto.randomUUID()),
      exitNames: exitNames.value,
      allowIdentityReplacement,
    })
    state.value = result.status === 'checked'
      ? dirty.value ? { type: 'ready', result } : { type: 'synced', diagnostics: result.diagnostics }
      : { type: result.status, diagnostics: result.diagnostics }
    return result
  }
  function revert() {
    clearTimeout(timer)
    clearTimeout(canvasTimer)
    const document = input.document.value
    if (!document) return
    const printed = printWorkflowDsl(agentWorkflowEditorDocumentSchema.parse(toRaw(document)), input.knowledge.value, exitNames.value)
    source.value = printed.source
    syncedSource.value = printed.source
    baseline.value = printed.baseline
    baseMutationSeq.value = input.mutationSeq()
    captureContext()
    allowIdentityReplacement = false
    applyError.value = ''
    check()
  }
  function edit(value: string) {
    clearTimeout(canvasTimer)
    source.value = value
    applyError.value = ''
    clearTimeout(timer)
    if (baseFingerprint !== fingerprint.value) { state.value = { type: 'stale', diagnostics: diagnostics.value }; return }
    state.value = { type: 'checking', diagnostics: diagnostics.value }
    timer = setTimeout(check, 250)
  }
  function apply() {
    const result = check()
    if (!result || result.status !== 'checked' || !dirty.value) return
    state.value = { type: 'applying', diagnostics: result.diagnostics }
    const applied = input.apply(result.document, baseMutationSeq.value)
    if (!applied.ok || !input.document.value) {
      applyError.value = applied.error?.code ?? 'APPLY_FAILED'
      state.value = { type: 'apply-failed', diagnostics: result.diagnostics }
      return
    }
    baseline.value = { document: agentWorkflowEditorDocumentSchema.parse(toRaw(input.document.value)), symbols: result.symbols, nodeSignatures: collectNodeSignatures(parseDsl(source.value).syntax) }
    syncedSource.value = source.value
    allowIdentityReplacement = false
    baseMutationSeq.value = input.mutationSeq()
    captureContext()
    state.value = { type: 'synced', diagnostics: result.diagnostics }
  }
  function reviewReplacement() {
    // User explicitly accepted replacing a changed Canvas. Preserve the draft,
    // but bind against current resources, Pattern exits and the latest revision.
    const current = input.document.value
    if (!current || !baseline.value) return
    const retainedIds = new Set<string>()
    const collect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      if ('id' in value && typeof value.id === 'string') retainedIds.add(value.id)
      for (const child of Object.values(value)) collect(child)
    }
    collect(current)
    baseline.value = { nodeSignatures: baseline.value.nodeSignatures, document: agentWorkflowEditorDocumentSchema.parse(toRaw(current)), symbols: new Map([...baseline.value.symbols].filter(([, id]) => retainedIds.has(id))) }
    baseMutationSeq.value = input.mutationSeq()
    captureContext()
    allowIdentityReplacement = true
    check()
  }
  function upgrade() {
    const result = check()
    if (!result || result.status !== 'checked' || !input.document.value) return
    const document = agentWorkflowEditorDocumentSchema.parse({ ...toRaw(input.document.value), ...result.document, workflow: { ...result.document.workflow, schemaVersion: '1.2.0' } })
    const printed = printWorkflowDsl(document, input.knowledge.value, exitNames.value)
    baseline.value = printed.baseline
    edit(printed.source)
  }
  function format() {
    const result = check()
    if (!result || result.status !== 'checked' || !input.document.value) return
    const printed = printWorkflowDsl(agentWorkflowEditorDocumentSchema.parse({ ...toRaw(input.document.value), ...result.document }), input.knowledge.value, exitNames.value)
    // Formatting may choose new aliases; preserve their identity mapping before the next check.
    baseline.value = printed.baseline
    edit(printed.source)
  }
  watch(fingerprint, () => {
    clearTimeout(timer)
    clearTimeout(canvasTimer)
    if (!input.document.value) {
      source.value = ''; syncedSource.value = ''; baseline.value = null
      state.value = { type: 'unavailable', diagnostics: [] }; return
    }
    if (fingerprint.value === baseFingerprint) return
    // The first complete inventory hydrates a context we could not resolve yet.
    // Preserve the draft and recheck it; later resource replacements remain stale.
    if (dirty.value && awaitingInitialKnowledge && input.knowledgeStatus.value === 'ready'
        && documentFingerprint.value === baseDocumentFingerprint) {
      captureContext()
      check()
      return
    }
    if (!dirty.value) {
      if (!baseline.value) revert()
      else canvasTimer = setTimeout(() => {
        if (!dirty.value) revert()
        else state.value = { type: 'stale', diagnostics: diagnostics.value }
      }, 150)
    }
    else state.value = { type: 'stale', diagnostics: [contextDiagnostic('ODSL505')] }
  }, { immediate: true })
  onScopeDispose(() => { disposed = true; clearTimeout(timer); clearTimeout(canvasTimer) })
  return { source, state, dirty, diagnostics, applyError, edit, check, revert, format, upgrade, apply, reviewReplacement }
}

