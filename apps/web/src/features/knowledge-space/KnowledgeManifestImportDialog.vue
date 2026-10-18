<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import {
  knowledgeGraphManifestSchema,
  type KnowledgeGraphManifest,
  type RepositoryError,
  type UUID,
  type ValidateKnowledgeGraphManifestResult,
} from '@odyssey/schemas'
import { useEditorRepository } from '@/app/editorRepository'

type ImportState =
  | { type: 'idle' }
  | { type: 'validating'; fileName: string }
  | { type: 'invalid'; fileName: string; message: string }
  | { type: 'ready-to-apply'; fileName: string; manifest: KnowledgeGraphManifest; validation: ValidateKnowledgeGraphManifestResult }
  | { type: 'applying'; fileName: string; manifest: KnowledgeGraphManifest; validation: ValidateKnowledgeGraphManifestResult }
  | { type: 'failed'; fileName: string; manifest: KnowledgeGraphManifest | null; error: RepositoryError }
  | { type: 'conflict'; fileName: string; manifest: KnowledgeGraphManifest }

const props = defineProps<{ knowledgeSpaceId: UUID; revision: number }>()
const emit = defineEmits<{ close: []; applied: [] }>()
const repository = useEditorRepository()
const state = ref<ImportState>({ type: 'idle' })
const fileInput = ref<globalThis.HTMLInputElement | null>(null)
let requestController: globalThis.AbortController | null = null

function chooseFile() {
  if (state.value.type === 'validating' || state.value.type === 'applying') return
  fileInput.value?.click()
}

async function readManifest(file: globalThis.File): Promise<KnowledgeGraphManifest | null> {
  if (file.size > 2 * 1024 * 1024) {
    state.value = { type: 'invalid', fileName: file.name, message: 'Manifest must be smaller than 2 MB.' }
    return null
  }
  try {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new globalThis.FileReader()
      reader.addEventListener('load', () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('INVALID_FILE_RESULT')), { once: true })
      reader.addEventListener('error', () => reject(reader.error ?? new Error('FILE_READ_FAILED')), { once: true })
      reader.readAsText(file)
    })
    const parsedJson: unknown = JSON.parse(content)
    const parsed = knowledgeGraphManifestSchema.safeParse(parsedJson)
    if (!parsed.success) {
      state.value = { type: 'invalid', fileName: file.name, message: 'This file does not match Manifest V1.' }
      return null
    }
    return parsed.data
  } catch {
    state.value = { type: 'invalid', fileName: file.name, message: 'Choose a valid JSON file.' }
    return null
  }
}

async function validateFile(event: globalThis.Event) {
  const input = event.currentTarget instanceof globalThis.HTMLInputElement ? event.currentTarget : null
  const file = input?.files?.[0]
  if (!file) return
  if (input) input.value = ''
  const manifest = await readManifest(file)
  if (!manifest) return
  await validateManifest(file.name, manifest)
}

async function validateManifest(fileName: string, manifest: KnowledgeGraphManifest) {
  requestController?.abort()
  const currentController = new globalThis.AbortController()
  requestController = currentController
  state.value = { type: 'validating', fileName }
  const result = await repository.validateKnowledgeGraphManifest(props.knowledgeSpaceId, props.revision, manifest, { signal: currentController.signal })
  if (currentController.signal.aborted || requestController !== currentController) return
  if (!result.ok) {
    state.value = result.error.code === 'REVISION_CONFLICT'
      ? { type: 'conflict', fileName, manifest }
      : { type: 'failed', fileName, manifest, error: result.error }
    return
  }
  state.value = result.value.status === 'valid' && result.value.validationToken
    ? { type: 'ready-to-apply', fileName, manifest, validation: result.value }
    : { type: 'invalid', fileName, message: result.value.issues.map((issue) => `${issue.code} · ${issue.path.join('.') || 'manifest'}`).join('\n') || 'Manifest validation failed.' }
}

async function applyManifest() {
  if (state.value.type !== 'ready-to-apply') return
  const validationToken = state.value.validation.validationToken
  if (!validationToken) return
  const { fileName, manifest, validation } = state.value
  const currentController = new globalThis.AbortController()
  requestController?.abort()
  requestController = currentController
  state.value = { type: 'applying', fileName, manifest, validation }
  const result = await repository.applyKnowledgeGraphManifest(props.knowledgeSpaceId, {
    expectedRevision: validation.knowledgeSpaceRevision,
    validationToken,
    manifestChecksum: validation.manifestChecksum,
    manifest,
  }, { signal: currentController.signal })
  if (currentController.signal.aborted || requestController !== currentController) return
  if (!result.ok) {
    state.value = result.error.code === 'REVISION_CONFLICT'
      ? { type: 'conflict', fileName, manifest }
      : { type: 'failed', fileName, manifest, error: result.error }
    return
  }
  emit('applied')
}

function retry() {
  if (state.value.type === 'conflict') void validateManifest(state.value.fileName, state.value.manifest)
  else if (state.value.type === 'failed' && state.value.manifest) void validateManifest(state.value.fileName, state.value.manifest)
}

function close() {
  requestController?.abort()
  emit('close')
}

function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape' && state.value.type !== 'applying') close()
}

onBeforeUnmount(() => requestController?.abort())
void nextTick(() => fileInput.value?.focus())
</script>

<template>
  <div class="knowledge-dialog-backdrop" @mousedown.self="close" @keydown="handleKeydown">
    <section class="knowledge-dialog knowledge-manifest-dialog" role="dialog" aria-modal="true" aria-labelledby="manifest-dialog-title">
      <header>
        <div><span>KNOWLEDGE GRAPH</span><h2 id="manifest-dialog-title">Import graph manifest</h2><p>Validate a reviewed Manifest V1 before replacing the generated graph projection.</p></div>
        <button type="button" aria-label="Close" :disabled="state.type === 'applying'" @click="close">×</button>
      </header>
      <input ref="fileInput" class="knowledge-file-input" type="file" accept=".json,application/json" @change="validateFile" />
      <button type="button" class="knowledge-manifest-picker" :disabled="state.type === 'validating' || state.type === 'applying'" @click="chooseFile">
        <strong>{{ state.type === 'idle' ? 'Choose manifest.json' : 'Choose another manifest' }}</strong>
        <small>JSON · Manifest V1 · maximum 2 MB</small>
      </button>
      <div v-if="state.type === 'validating'" class="knowledge-manifest-status" role="status"><strong>Validating {{ state.fileName }}…</strong><p>Matching document paths and checking graph references.</p></div>
      <div v-else-if="state.type === 'ready-to-apply' || state.type === 'applying'" class="knowledge-manifest-preview">
        <div><strong>{{ state.validation.matchedDocumentCount }}</strong><span>Matched documents</span></div>
        <div><strong>{{ state.validation.unmatchedDocumentCount }}</strong><span>Unmatched documents</span></div>
        <div><strong>{{ state.validation.summaryUpdateCount }}</strong><span>Summaries</span></div>
        <div><strong>{{ state.validation.guideUpdateCount }}</strong><span>Guides</span></div>
        <div><strong>{{ state.validation.tagCount }}</strong><span>Tags</span></div>
        <div><strong>{{ state.validation.relationCount }}</strong><span>Relations</span></div>
        <div><strong>{{ state.validation.issueCount }}</strong><span>Issues</span></div>
        <p>Result: <b>{{ state.validation.resultingGraphStatus?.replace('_', ' ') }}</b></p>
      </div>
      <div v-else-if="state.type === 'invalid'" class="knowledge-manifest-status is-error" role="alert"><strong>Manifest needs attention</strong><pre>{{ state.message }}</pre></div>
      <div v-else-if="state.type === 'conflict'" class="knowledge-manifest-status is-error" role="alert"><strong>The Knowledge Space changed.</strong><p>Validate the manifest again against the latest revision.</p><button type="button" class="knowledge-secondary-action" @click="retry">Validate again</button></div>
      <div v-else-if="state.type === 'failed'" class="knowledge-manifest-status is-error" role="alert"><strong>Import could not continue.</strong><p>{{ state.error.code }}</p><button v-if="state.manifest" type="button" class="knowledge-secondary-action" @click="retry">Retry validation</button></div>
      <footer><button type="button" class="knowledge-secondary-action" :disabled="state.type === 'applying'" @click="close">Cancel</button><button type="button" class="knowledge-primary-action" :disabled="state.type !== 'ready-to-apply'" @click="applyManifest">{{ state.type === 'applying' ? 'Importing…' : 'Import graph' }}</button></footer>
    </section>
  </div>
</template>
