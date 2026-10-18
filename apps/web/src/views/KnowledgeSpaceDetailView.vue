<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { uuidSchema, type KnowledgeFileTree, type KnowledgeFolderSummary, type KnowledgeGraphOverview, type KnowledgeResourceSummary, type KnowledgeSpaceCategorySummary, type KnowledgeSpaceDetail, type RepositoryError, type UUID } from '@odyssey/schemas'
import { useEditorRepository } from '@/app/editorRepository'
import AppSelect, { type AppSelectOption } from '@/components/AppSelect.vue'
import MarkdownPreview from '@/features/knowledge-space/MarkdownPreview.vue'
import KnowledgeManifestImportDialog from '@/features/knowledge-space/KnowledgeManifestImportDialog.vue'
import { evaluateKnowledgeResourceMove } from '@/domain/knowledge'
import { parseKnowledgeResourceRoute, parseKnowledgeSpaceRoute, routeLocations } from '@/router/routeContracts'
import type { KnowledgeResourceInspection } from '@/repositories/editorRepository'

type DetailState = { type: 'loading' } | { type: 'ready'; detail: KnowledgeSpaceDetail } | { type: 'failed'; error: RepositoryError | { code: 'INVALID_ROUTE' } }
type GraphState =
  | { type: 'loading' }
  | { type: 'ready'; graph: KnowledgeGraphOverview }
  | { type: 'failed'; error: RepositoryError }
type DialogState = { type: 'closed' } | { type: 'edit' } | { type: 'delete' } | { type: 'folder' } | { type: 'delete-resource'; resourceId: UUID; resourceName: string }
type MutationState = { type: 'idle' } | { type: 'saving' } | { type: 'failed'; error: RepositoryError }
type FolderContextMenuState = { type: 'closed' } | { type: 'open'; folderId: UUID; x: number; y: number }
type ResourceContextMenuState = { type: 'closed' } | { type: 'open'; resourceId: UUID; resourceName: string; x: number; y: number }
type UploadState = { type: 'idle' } | { type: 'uploading'; fileName: string } | { type: 'failed'; error: RepositoryError }
type ResourceMoveState =
  | { type: 'idle' }
  | { type: 'dragging'; resourceId: UUID; targetFolderId: UUID | null }
  | { type: 'moving'; resourceId: UUID; targetFolderId: UUID }
  | { type: 'failed'; error: RepositoryError }
type DocumentState =
  | { type: 'closed' }
  | { type: 'loading'; resourceId: UUID }
  | { type: 'ready'; resourceId: UUID; inspection: KnowledgeResourceInspection }
  | { type: 'failed'; resourceId: UUID; error: RepositoryError }
type DocumentEditorState =
  | { type: 'preview' }
  | { type: 'editing'; mode: 'edit' | 'preview'; draft: string; save: { type: 'idle' } | { type: 'saving' } | { type: 'failed'; error: RepositoryError } }
type KnowledgeTreeRow =
  | { type: 'folder'; folder: KnowledgeFolderSummary; depth: number; hasChildren: boolean }
  | { type: 'resource'; resource: KnowledgeResourceSummary; depth: number }

const repository = useEditorRepository()
const route = useRoute()
const router = useRouter()
const state = ref<DetailState>({ type: 'loading' })
const categories = ref<KnowledgeSpaceCategorySummary[]>([])
const fileTree = ref<KnowledgeFileTree | null>(null)
const graphState = ref<GraphState>({ type: 'loading' })
const dialog = ref<DialogState>({ type: 'closed' })
const mutation = ref<MutationState>({ type: 'idle' })
const form = reactive({ name: '', description: '', categoryId: '' })
const folderName = ref('')
const selectedFolderId = ref<UUID | null>(null)
const expandedFolderIds = ref<ReadonlySet<UUID>>(new Set())
const folderContextMenu = ref<FolderContextMenuState>({ type: 'closed' })
const resourceContextMenu = ref<ResourceContextMenuState>({ type: 'closed' })
const uploadState = ref<UploadState>({ type: 'idle' })
const resourceMoveState = ref<ResourceMoveState>({ type: 'idle' })
const documentState = ref<DocumentState>({ type: 'closed' })
const documentEditor = ref<DocumentEditorState>({ type: 'preview' })
const isManifestImportOpen = ref(false)
const manifestToast = ref<string | null>(null)
const fileInput = ref<globalThis.HTMLInputElement | null>(null)
let controller: globalThis.AbortController | null = null
let documentController: globalThis.AbortController | null = null
const categoryOptions = computed<readonly AppSelectOption[]>(() => categories.value.map((category) => ({ value: category.id, label: category.name })))
const selectedFolder = computed(() => fileTree.value?.folders.find((folder) => folder.id === selectedFolderId.value) ?? null)
const selectedFolderLabel = computed(() => {
  if (!selectedFolder.value) return null
  if (state.value.type === 'ready' && selectedFolder.value.id === fileTree.value?.rootFolderId) return state.value.detail.name
  return selectedFolder.value.name
})
const treeRows = computed<KnowledgeTreeRow[]>(() => {
  const tree = fileTree.value
  if (!tree) return []
  const children = new Map<UUID | null, KnowledgeFolderSummary[]>()
  for (const folder of tree.folders) children.set(folder.parentFolderId, [...(children.get(folder.parentFolderId) ?? []), folder])
  const resources = new Map<UUID, KnowledgeResourceSummary[]>()
  for (const resource of tree.resources) resources.set(resource.folderId, [...(resources.get(resource.folderId) ?? []), resource])
  const rows: KnowledgeTreeRow[] = []
  const visited = new Set<UUID>()
  const append = (folder: KnowledgeFolderSummary, depth: number) => {
    if (visited.has(folder.id)) return
    visited.add(folder.id)
    const childFolders = children.get(folder.id) ?? []
    const childResources = resources.get(folder.id) ?? []
    rows.push({ type: 'folder', folder, depth, hasChildren: childFolders.length > 0 || childResources.length > 0 })
    if (!expandedFolderIds.value.has(folder.id)) return
    for (const child of childFolders) append(child, depth + 1)
    for (const resource of childResources) rows.push({ type: 'resource', resource, depth: depth + 1 })
  }
  const root = tree.folders.find((folder) => folder.id === tree.rootFolderId)
  if (root) append(root, 0)
  const folderIds = new Set(tree.folders.map((folder) => folder.id))
  for (const folder of tree.folders) {
    if (folder.parentFolderId === null || !folderIds.has(folder.parentFolderId)) append(folder, 0)
  }
  return rows
})

async function load() {
  controller?.abort()
  const knowledgeSpaceId = parseKnowledgeSpaceRoute(route.params.knowledgeSpaceId)
  if (!knowledgeSpaceId) { state.value = { type: 'failed', error: { code: 'INVALID_ROUTE' } }; return }
  controller = new globalThis.AbortController()
  state.value = { type: 'loading' }
  graphState.value = { type: 'loading' }
  const [detailResult, categoriesResult, treeResult, graphResult] = await Promise.all([repository.loadKnowledgeSpace(knowledgeSpaceId, { signal: controller.signal }), repository.listKnowledgeSpaceCategories({ signal: controller.signal }), repository.loadKnowledgeFileTree(knowledgeSpaceId, { signal: controller.signal }), repository.loadKnowledgeGraph(knowledgeSpaceId, { signal: controller.signal })])
  if (controller.signal.aborted) return
  if (!detailResult.ok) { state.value = { type: 'failed', error: detailResult.error }; return }
  if (!categoriesResult.ok) { state.value = { type: 'failed', error: categoriesResult.error }; return }
  if (!treeResult.ok) { state.value = { type: 'failed', error: treeResult.error }; return }
  categories.value = categoriesResult.value
  fileTree.value = treeResult.value
  graphState.value = graphResult.ok ? { type: 'ready', graph: graphResult.value } : { type: 'failed', error: graphResult.error }
  selectedFolderId.value = treeResult.value.rootFolderId
  expandedFolderIds.value = new Set(treeResult.value.folders.map((folder) => folder.id))
  state.value = { type: 'ready', detail: detailResult.value }
  void syncDocumentRoute()
}

async function finishManifestImport() {
  isManifestImportOpen.value = false
  if (state.value.type !== 'ready') return
  const knowledgeSpaceId = state.value.detail.id
  const [detailResult, graphResult] = await Promise.all([
    repository.loadKnowledgeSpace(knowledgeSpaceId),
    repository.loadKnowledgeGraph(knowledgeSpaceId),
  ])
  if (detailResult.ok) state.value = { type: 'ready', detail: detailResult.value }
  graphState.value = graphResult.ok ? { type: 'ready', graph: graphResult.value } : { type: 'failed', error: graphResult.error }
  manifestToast.value = 'Graph manifest imported'
  globalThis.setTimeout(() => {
    if (manifestToast.value === 'Graph manifest imported') manifestToast.value = null
  }, 2800)
}

function openFolderDialog() {
  if (!selectedFolder.value) return
  folderContextMenu.value = { type: 'closed' }
  folderName.value = ''
  mutation.value = { type: 'idle' }
  dialog.value = { type: 'folder' }
}

async function createFolder() {
  if (state.value.type !== 'ready' || !fileTree.value || mutation.value.type === 'saving') return
  mutation.value = { type: 'saving' }
  const parentFolderId = selectedFolderId.value
  if (!parentFolderId) return
  const result = await repository.createKnowledgeFolder({ knowledgeSpaceId: state.value.detail.id, expectedRevision: state.value.detail.revision, parentFolderId, name: folderName.value })
  if (!result.ok) { mutation.value = { type: 'failed', error: result.error }; return }
  fileTree.value = { ...fileTree.value, revision: result.value.knowledgeSpaceRevision, folders: [...fileTree.value.folders, result.value.folder] }
  state.value = { type: 'ready', detail: { ...state.value.detail, revision: result.value.knowledgeSpaceRevision } }
  expandedFolderIds.value = new Set([...expandedFolderIds.value, parentFolderId, result.value.folder.id])
  selectedFolderId.value = result.value.folder.id
  mutation.value = { type: 'idle' }
  closeDialog()
}

function selectFolder(folderId: UUID) {
  selectedFolderId.value = folderId
  folderContextMenu.value = { type: 'closed' }
}

function folderLabel(folder: KnowledgeFolderSummary) {
  if (state.value.type === 'ready' && folder.id === fileTree.value?.rootFolderId) return state.value.detail.name
  return folder.name
}

function toggleFolder(folderId: UUID) {
  const next = new Set(expandedFolderIds.value)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  expandedFolderIds.value = next
}

function startResourceDrag(event: globalThis.DragEvent, resourceId: UUID) {
  if (resourceMoveState.value.type === 'moving') {
    event.preventDefault()
    return
  }
  event.dataTransfer?.setData('application/x-odyssey-knowledge-resource', resourceId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  resourceMoveState.value = { type: 'dragging', resourceId, targetFolderId: null }
}

function evaluateResourceDrop(targetFolderId: UUID) {
  if (!fileTree.value || resourceMoveState.value.type !== 'dragging') return null
  return evaluateKnowledgeResourceMove(fileTree.value, resourceMoveState.value.resourceId, targetFolderId)
}

function dragResourceOverFolder(event: globalThis.DragEvent, targetFolderId: UUID) {
  const evaluation = evaluateResourceDrop(targetFolderId)
  if (!evaluation || evaluation.status !== 'valid') return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  resourceMoveState.value = { type: 'dragging', resourceId: evaluation.resourceId, targetFolderId }
}

function leaveResourceDropTarget(targetFolderId: UUID) {
  if (resourceMoveState.value.type !== 'dragging' || resourceMoveState.value.targetFolderId !== targetFolderId) return
  resourceMoveState.value = { ...resourceMoveState.value, targetFolderId: null }
}

async function dropResourceIntoFolder(event: globalThis.DragEvent, targetFolderId: UUID) {
  event.preventDefault()
  if (state.value.type !== 'ready' || !fileTree.value) return
  const evaluation = evaluateResourceDrop(targetFolderId)
  if (!evaluation || evaluation.status !== 'valid') return
  resourceMoveState.value = { type: 'moving', resourceId: evaluation.resourceId, targetFolderId: evaluation.targetFolderId }
  const result = await repository.moveKnowledgeResource({
    knowledgeSpaceId: state.value.detail.id,
    resourceId: evaluation.resourceId,
    targetFolderId: evaluation.targetFolderId,
    expectedRevision: state.value.detail.revision,
  })
  if (!result.ok) {
    resourceMoveState.value = { type: 'failed', error: result.error }
    return
  }
  fileTree.value = {
    ...fileTree.value,
    revision: result.value.knowledgeSpaceRevision,
    resources: fileTree.value.resources.map((resource) => resource.id === result.value.resource.id ? result.value.resource : resource),
  }
  state.value = { type: 'ready', detail: { ...state.value.detail, revision: result.value.knowledgeSpaceRevision } }
  expandedFolderIds.value = new Set([...expandedFolderIds.value, targetFolderId])
  resourceMoveState.value = { type: 'idle' }
}

function endResourceDrag() {
  if (resourceMoveState.value.type === 'dragging') resourceMoveState.value = { type: 'idle' }
}

async function loadDocument(resourceId: UUID) {
  if (state.value.type !== 'ready') return
  documentController?.abort()
  documentController = new globalThis.AbortController()
  documentState.value = { type: 'loading', resourceId }
  const result = await repository.loadKnowledgeResource(state.value.detail.id, resourceId, { signal: documentController.signal })
  if (documentController.signal.aborted || !isCurrentDocumentRequest(resourceId)) return
  documentState.value = result.ok
    ? { type: 'ready', resourceId, inspection: result.value }
    : { type: 'failed', resourceId, error: result.error }
  documentEditor.value = { type: 'preview' }
}

function isCurrentDocumentRequest(resourceId: UUID) {
  return documentState.value.type === 'loading' && documentState.value.resourceId === resourceId
}

function syncDocumentRoute() {
  const resourceId = parseKnowledgeResourceRoute(route.params.resourceId)
  if (!resourceId) {
    documentController?.abort()
    documentState.value = { type: 'closed' }
    return
  }
  void loadDocument(resourceId)
}

function navigateToDocument(resourceId: UUID) {
  if (state.value.type !== 'ready') return
  void router.push(routeLocations.knowledgeDocument(state.value.detail.id, resourceId))
}

function isEditableMarkdown() {
  if (documentState.value.type !== 'ready' || documentState.value.inspection.preview.type !== 'text') return false
  const detail = documentState.value.inspection.detail
  return /\.(md|markdown)$/i.test(detail.name) && (detail.mimeType === 'text/markdown' || detail.mimeType === 'text/plain')
}

function setDocumentMode(mode: 'preview' | 'edit') {
  if (mode === 'preview') {
    if (documentEditor.value.type === 'editing') documentEditor.value = { ...documentEditor.value, mode: 'preview' }
    return
  }
  if (!isEditableMarkdown() || documentState.value.type !== 'ready' || documentState.value.inspection.preview.type !== 'text') return
  const draft = documentEditor.value.type === 'editing' ? documentEditor.value.draft : documentState.value.inspection.preview.content
  documentEditor.value = { type: 'editing', mode: 'edit', draft, save: { type: 'idle' } }
}

async function saveDocumentContent() {
  if (state.value.type !== 'ready' || documentState.value.type !== 'ready' || documentEditor.value.type !== 'editing' || documentEditor.value.save.type === 'saving') return
  const resourceId = documentState.value.resourceId
  const content = documentEditor.value.draft
  documentEditor.value = { ...documentEditor.value, save: { type: 'saving' } }
  const result = await repository.updateKnowledgeResourceContent({
    knowledgeSpaceId: state.value.detail.id,
    resourceId,
    expectedRevision: state.value.detail.revision,
    content,
  })
  if (!result.ok) {
    if (documentEditor.value.type === 'editing') documentEditor.value = { ...documentEditor.value, save: { type: 'failed', error: result.error } }
    return
  }
  if (documentState.value.type !== 'ready' || documentState.value.resourceId !== resourceId) return
  documentState.value = {
    ...documentState.value,
    inspection: {
      detail: { ...documentState.value.inspection.detail, ...result.value.resource },
      preview: { type: 'text', content, truncated: false },
    },
  }
  fileTree.value = fileTree.value ? {
    ...fileTree.value,
    revision: result.value.knowledgeSpaceRevision,
    resources: fileTree.value.resources.map((resource) => resource.id === resourceId ? result.value.resource : resource),
  } : null
  state.value = { type: 'ready', detail: { ...state.value.detail, revision: result.value.knowledgeSpaceRevision } }
  documentEditor.value = { type: 'preview' }
}

function formatFileSize(value: number | null) {
  if (value === null) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function openFolderContextMenu(event: globalThis.MouseEvent | globalThis.KeyboardEvent, folderId: UUID | undefined) {
  if (!folderId) return
  event.preventDefault()
  const target = event.currentTarget instanceof globalThis.HTMLElement ? event.currentTarget : null
  const bounds = target?.getBoundingClientRect()
  const x = event instanceof globalThis.MouseEvent && event.clientX > 0 ? event.clientX : (bounds?.left ?? 0) + 18
  const y = event instanceof globalThis.MouseEvent && event.clientY > 0 ? event.clientY : (bounds?.top ?? 0) + 28
  selectedFolderId.value = folderId
  folderContextMenu.value = { type: 'open', folderId, x, y }
}

function openResourceContextMenu(event: globalThis.MouseEvent | globalThis.KeyboardEvent, resource: KnowledgeResourceSummary) {
  event.preventDefault()
  folderContextMenu.value = { type: 'closed' }
  const target = event.currentTarget instanceof globalThis.HTMLElement ? event.currentTarget : null
  const bounds = target?.getBoundingClientRect()
  const x = event instanceof globalThis.MouseEvent && event.clientX > 0 ? event.clientX : (bounds?.left ?? 0) + 18
  const y = event instanceof globalThis.MouseEvent && event.clientY > 0 ? event.clientY : (bounds?.top ?? 0) + 28
  resourceContextMenu.value = { type: 'open', resourceId: resource.id, resourceName: resource.name, x, y }
}

function closeFolderContextMenu() {
  folderContextMenu.value = { type: 'closed' }
}

function closeResourceContextMenu() {
  resourceContextMenu.value = { type: 'closed' }
}

function openDeleteResource(resourceId: UUID, resourceName: string) {
  closeResourceContextMenu()
  mutation.value = { type: 'idle' }
  dialog.value = { type: 'delete-resource', resourceId, resourceName }
}

async function confirmDeleteResource() {
  if (state.value.type !== 'ready' || !fileTree.value || dialog.value.type !== 'delete-resource' || mutation.value.type === 'saving') return
  const { resourceId } = dialog.value
  mutation.value = { type: 'saving' }
  const result = await repository.deleteKnowledgeResource({
    knowledgeSpaceId: state.value.detail.id,
    resourceId,
    expectedRevision: state.value.detail.revision,
  })
  if (!result.ok) { mutation.value = { type: 'failed', error: result.error }; return }
  fileTree.value = {
    ...fileTree.value,
    revision: result.value.knowledgeSpaceRevision,
    resources: fileTree.value.resources.filter((resource) => resource.id !== resourceId),
  }
  state.value = {
    type: 'ready',
    detail: {
      ...state.value.detail,
      revision: result.value.knowledgeSpaceRevision,
      fileCount: Math.max(0, state.value.detail.fileCount - 1),
    },
  }
  documentController?.abort()
  documentState.value = { type: 'closed' }
  mutation.value = { type: 'idle' }
  dialog.value = { type: 'closed' }
  if (parseKnowledgeResourceRoute(route.params.resourceId) === resourceId) {
    await router.replace(routeLocations.knowledgeSpace(state.value.detail.id))
  }
}

function chooseUploadFile() {
  if (!selectedFolder.value || uploadState.value.type === 'uploading') return
  fileInput.value?.click()
}

async function uploadFile(event: globalThis.Event) {
  if (state.value.type !== 'ready' || !fileTree.value || !selectedFolder.value) return
  const input = event.currentTarget instanceof globalThis.HTMLInputElement ? event.currentTarget : null
  const file = input?.files?.[0]
  if (!file) return
  uploadState.value = { type: 'uploading', fileName: file.name }
  const result = await repository.uploadKnowledgeFile({ knowledgeSpaceId: state.value.detail.id, folderId: selectedFolder.value.id, expectedRevision: state.value.detail.revision, file })
  if (input) input.value = ''
  if (!result.ok) { uploadState.value = { type: 'failed', error: result.error }; return }
  fileTree.value = { ...fileTree.value, revision: result.value.knowledgeSpaceRevision, resources: [...fileTree.value.resources, result.value.resource] }
  state.value = { type: 'ready', detail: { ...state.value.detail, revision: result.value.knowledgeSpaceRevision, fileCount: state.value.detail.fileCount + 1 } }
  uploadState.value = { type: 'idle' }
}

function handleGlobalKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape') {
    closeFolderContextMenu()
    closeResourceContextMenu()
  }
}

function openEdit() {
  if (state.value.type !== 'ready') return
  form.name = state.value.detail.name
  form.description = state.value.detail.description ?? ''
  form.categoryId = state.value.detail.category.id
  mutation.value = { type: 'idle' }
  dialog.value = { type: 'edit' }
}

async function saveMetadata() {
  if (state.value.type !== 'ready' || mutation.value.type === 'saving') return
  const categoryId = uuidSchema.safeParse(form.categoryId)
  if (!categoryId.success) return
  mutation.value = { type: 'saving' }
  const result = await repository.updateKnowledgeSpace({ knowledgeSpaceId: state.value.detail.id, expectedRevision: state.value.detail.revision, name: form.name, description: form.description.trim() || null, categoryId: categoryId.data })
  if (!result.ok) { mutation.value = { type: 'failed', error: result.error }; return }
  state.value = { type: 'ready', detail: result.value }
  mutation.value = { type: 'idle' }
  dialog.value = { type: 'closed' }
}

async function toggleArchived() {
  if (state.value.type !== 'ready' || mutation.value.type === 'saving') return
  mutation.value = { type: 'saving' }
  const detail = state.value.detail
  const input = { knowledgeSpaceId: detail.id, expectedRevision: detail.revision }
  const result = detail.lifecycleStatus === 'archived' ? await repository.unarchiveKnowledgeSpace(input) : await repository.archiveKnowledgeSpace(input)
  if (!result.ok) { mutation.value = { type: 'failed', error: result.error }; return }
  state.value = { type: 'ready', detail: result.value }
  mutation.value = { type: 'idle' }
}

async function confirmDelete() {
  if (state.value.type !== 'ready' || mutation.value.type === 'saving') return
  mutation.value = { type: 'saving' }
  const result = await repository.deleteKnowledgeSpace({ knowledgeSpaceId: state.value.detail.id, expectedRevision: state.value.detail.revision })
  if (!result.ok) { mutation.value = { type: 'failed', error: result.error }; return }
  await router.replace(routeLocations.knowledgeSpaces())
}

function closeDialog() {
  if (mutation.value.type === 'saving') return
  mutation.value = { type: 'idle' }
  dialog.value = { type: 'closed' }
}

onMounted(() => {
  globalThis.document.addEventListener('pointerdown', closeFolderContextMenu)
  globalThis.document.addEventListener('pointerdown', closeResourceContextMenu)
  globalThis.document.addEventListener('keydown', handleGlobalKeydown)
  void load()
})
watch(() => route.params.resourceId, () => syncDocumentRoute())
onBeforeUnmount(() => {
  controller?.abort()
  documentController?.abort()
  globalThis.document.removeEventListener('pointerdown', closeFolderContextMenu)
  globalThis.document.removeEventListener('pointerdown', closeResourceContextMenu)
  globalThis.document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <section v-if="state.type === 'loading'" class="knowledge-detail-state" role="status">Loading Knowledge Space…</section>
  <section v-else-if="state.type === 'failed'" class="knowledge-detail-state" role="alert"><strong>Knowledge Space could not be loaded.</strong><span>{{ state.error.code }}</span><RouterLink :to="routeLocations.knowledgeSpaces()">Back to Knowledge Spaces</RouterLink></section>
  <section v-else class="knowledge-detail-page" aria-labelledby="knowledge-detail-title" :inert="dialog.type !== 'closed' || isManifestImportOpen || undefined">
    <aside class="knowledge-folder-panel">
      <h1 id="knowledge-detail-title" class="knowledge-visually-hidden">{{ state.detail.name }}</h1>
      <div class="knowledge-folder-heading">
        <span>FILES</span>
        <button type="button" class="knowledge-icon-button" aria-label="Create folder in selected folder" title="Create folder in selected folder" :disabled="!selectedFolder" @click="openFolderDialog">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
        </button>
      </div>
      <ul class="knowledge-folder-tree" aria-label="Knowledge Space folders" @contextmenu.self="openFolderContextMenu($event, fileTree?.rootFolderId)">
        <li v-for="row in treeRows" :key="row.type === 'folder' ? row.folder.id : row.resource.id" :class="{ 'knowledge-resource-row': row.type === 'resource' }" :style="{ paddingInlineStart: `${row.depth * 18}px` }">
          <div v-if="row.type === 'folder'" class="knowledge-tree-folder-entry">
            <button v-if="row.hasChildren" type="button" class="knowledge-folder-toggle" :aria-label="`${expandedFolderIds.has(row.folder.id) ? 'Collapse' : 'Expand'} ${folderLabel(row.folder)}`" :aria-expanded="expandedFolderIds.has(row.folder.id)" @click="toggleFolder(row.folder.id)">
              <svg class="knowledge-chevron-icon" :class="{ 'is-collapsed': !expandedFolderIds.has(row.folder.id) }" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.75 6 3.25 3.25L11.25 6" /></svg>
            </button>
            <span v-else class="knowledge-tree-indent" aria-hidden="true" />
            <button type="button" class="knowledge-folder-row" :class="{ 'is-root': row.folder.id === fileTree?.rootFolderId, 'is-selected': selectedFolderId === row.folder.id, 'is-drop-target': resourceMoveState.type === 'dragging' && resourceMoveState.targetFolderId === row.folder.id }" :aria-pressed="selectedFolderId === row.folder.id" @click="selectFolder(row.folder.id)" @contextmenu="openFolderContextMenu($event, row.folder.id)" @keydown.shift.f10="openFolderContextMenu($event, row.folder.id)" @dragover="dragResourceOverFolder($event, row.folder.id)" @dragleave="leaveResourceDropTarget(row.folder.id)" @drop="dropResourceIntoFolder($event, row.folder.id)">
              <svg class="knowledge-folder-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M2.75 5.25A1.75 1.75 0 0 1 4.5 3.5h3.1l1.55 1.75h6.35A1.75 1.75 0 0 1 17.25 7v7.25A1.75 1.75 0 0 1 15.5 16H4.5a1.75 1.75 0 0 1-1.75-1.75v-9Z" /></svg>
              <span class="knowledge-folder-name">{{ folderLabel(row.folder) }}</span>
            </button>
          </div>
          <template v-else>
            <span class="knowledge-tree-indent" aria-hidden="true" />
            <button type="button" class="knowledge-resource-button" :class="{ 'is-selected': documentState.type !== 'closed' && documentState.resourceId === row.resource.id }" draggable="true" :aria-label="`Open ${row.resource.name}; drag to move it to a folder`" :title="`Open ${row.resource.name} or drag it to move`" @click="navigateToDocument(row.resource.id)" @contextmenu="openResourceContextMenu($event, row.resource)" @keydown.shift.f10="openResourceContextMenu($event, row.resource)" @dragstart="startResourceDrag($event, row.resource.id)" @dragend="endResourceDrag">
              <svg class="knowledge-file-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.75h6l4 4v10.5H5V2.75Z" /><path d="M11 2.75v4h4" /></svg>
              <span class="knowledge-folder-name">{{ row.resource.name }}</span>
              <small>{{ row.resource.status.replace('_', ' ') }}</small>
            </button>
          </template>
        </li>
      </ul>
      <p class="knowledge-file-operation-status" aria-live="polite">
        <template v-if="resourceMoveState.type === 'moving'">Moving file…</template>
        <template v-else-if="resourceMoveState.type === 'failed'">Move failed: {{ resourceMoveState.error.code }}</template>
      </p>
      <footer>
        <span>{{ selectedFolderLabel ? `Selected: ${selectedFolderLabel}` : 'Select a folder' }}</span>
        <input ref="fileInput" class="knowledge-file-input" type="file" accept=".md,.markdown,.txt,.pdf,.json" @change="uploadFile" />
        <button type="button" :disabled="!selectedFolder || uploadState.type === 'uploading'" @click="chooseUploadFile">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13.75V3.5m0 0L6.25 7.25M10 3.5l3.75 3.75M3.5 13.75v1.5A1.75 1.75 0 0 0 5.25 17h9.5a1.75 1.75 0 0 0 1.75-1.75v-1.5" /></svg>
          {{ uploadState.type === 'uploading' ? `Uploading ${uploadState.fileName}…` : `Upload to ${selectedFolderLabel ?? 'folder'}` }}
        </button>
        <small v-if="uploadState.type === 'failed'" class="knowledge-upload-error" role="alert">Upload failed: {{ uploadState.error.code }}</small>
      </footer>
    </aside>
    <div class="knowledge-detail-content">
      <template v-if="documentState.type === 'closed'">
        <article class="knowledge-overview-card">
          <div><p>{{ state.detail.description || 'No description yet.' }}</p><span class="knowledge-category-chip">{{ state.detail.category.name }}</span></div>
          <div class="knowledge-detail-actions"><button type="button" @click="openEdit">Edit details</button><button type="button" @click="toggleArchived">{{ state.detail.lifecycleStatus === 'archived' ? 'Restore' : 'Archive' }}</button><button v-if="state.detail.lifecycleStatus === 'archived'" type="button" class="is-danger" @click="dialog = { type: 'delete' }; mutation = { type: 'idle' }">Delete</button></div>
          <span class="knowledge-status" :data-status="state.detail.graphStatus"><i />{{ state.detail.graphStatus.replace('_', ' ') }}</span>
          <dl><div><dt>{{ state.detail.fileCount }}</dt><dd>Files</dd></div><div><dt>{{ state.detail.knowledgeFamilyCount }}</dt><dd>Knowledge Families</dd></div><div><dt>Last document indexed</dt><dd>{{ state.detail.lastDocumentIndexedAt || 'Not indexed' }}</dd></div><div><dt>Last Steward run</dt><dd>{{ state.detail.lastStewardRunAt || 'Not run' }}</dd></div></dl>
          <p v-if="mutation.type === 'failed'" class="knowledge-form-error knowledge-mutation-error" role="alert">Operation failed: {{ mutation.error.code }}</p>
        </article>
        <article class="knowledge-graph-placeholder">
          <header><span>KNOWLEDGE GRAPH</span><div><small>Read-only</small><button type="button" class="knowledge-graph-action" @click="isManifestImportOpen = true">Import manifest</button></div></header>
          <div v-if="graphState.type === 'loading'" role="status"><strong>Loading graph…</strong><p>Reading the persisted Knowledge Space projection.</p></div>
          <div v-else-if="graphState.type === 'failed'" role="alert"><strong>Knowledge graph could not be loaded.</strong><p>{{ graphState.error.code }}</p></div>
          <div v-else-if="graphState.graph.status === 'not_indexed'"><strong>This Knowledge Space is not indexed yet.</strong><p>Automatic analysis is not enabled in this demo. Import a reviewed manifest to generate the graph.</p><button type="button" class="knowledge-primary-action" @click="isManifestImportOpen = true">Import graph manifest</button></div>
          <div v-else-if="graphState.graph.nodes.length === 0"><strong>No indexed documents are available.</strong><p>The persisted graph snapshot is valid but currently empty.</p></div>
          <div v-else><strong>{{ graphState.graph.nodes.length }} documents · {{ graphState.graph.edges.length }} relationships</strong><p>The persisted graph is ready for the read-only canvas adapter.</p></div>
        </article>
      </template>
      <article v-else class="knowledge-document-detail" aria-labelledby="knowledge-document-title">
        <header class="knowledge-document-detail-header">
          <div>
            <RouterLink class="knowledge-document-back" :to="routeLocations.knowledgeSpace(state.detail.id)">← Knowledge Space</RouterLink>
            <span>DOCUMENT DETAIL</span>
            <h2 id="knowledge-document-title">{{ documentState.type === 'ready' ? documentState.inspection.detail.name : 'Document details' }}</h2>
          </div>
          <div v-if="documentState.type === 'ready'" class="knowledge-document-actions">
            <button type="button" class="knowledge-secondary-action is-danger" @click="openDeleteResource(documentState.resourceId, documentState.inspection.detail.name)">Delete file</button>
          </div>
        </header>
        <div v-if="documentState.type === 'loading'" class="knowledge-document-state" role="status">Loading document…</div>
        <div v-else-if="documentState.type === 'failed'" class="knowledge-document-state is-error" role="alert">
          <strong>Document could not be loaded.</strong><span>{{ documentState.error.code }}</span><button type="button" class="knowledge-secondary-action" @click="loadDocument(documentState.resourceId)">Retry</button>
        </div>
        <template v-else>
          <dl class="knowledge-document-metadata">
            <div><dt>Status</dt><dd>{{ documentState.inspection.detail.status.replace('_', ' ') }}</dd></div>
            <div><dt>Type</dt><dd>{{ documentState.inspection.detail.mimeType ?? 'Unknown' }}</dd></div>
            <div><dt>Size</dt><dd>{{ formatFileSize(documentState.inspection.detail.sizeBytes) }}</dd></div>
            <div><dt>Updated</dt><dd>{{ formatTimestamp(documentState.inspection.detail.updatedAt) }}</dd></div>
          </dl>
          <div class="knowledge-document-sections">
            <section class="knowledge-document-copy"><h3>Summary</h3><p>{{ documentState.inspection.detail.summary || 'No summary yet.' }}</p></section>
            <section class="knowledge-document-copy"><h3>Guide</h3><p>{{ documentState.inspection.detail.guide || 'No guide yet.' }}</p></section>
          </div>
          <section class="knowledge-document-preview">
            <header class="knowledge-document-preview-header">
              <h3>{{ documentEditor.type === 'editing' && documentEditor.mode === 'edit' ? 'Markdown editor' : 'Preview' }}</h3>
              <div v-if="isEditableMarkdown()" class="knowledge-document-mode-switch" role="group" aria-label="Markdown view mode">
                <button type="button" :class="{ 'is-active': documentEditor.type === 'preview' || documentEditor.mode === 'preview' }" :aria-pressed="documentEditor.type === 'preview' || documentEditor.mode === 'preview'" @click="setDocumentMode('preview')">Preview</button>
                <button type="button" :class="{ 'is-active': documentEditor.type === 'editing' && documentEditor.mode === 'edit' }" :aria-pressed="documentEditor.type === 'editing' && documentEditor.mode === 'edit'" @click="setDocumentMode('edit')">Edit</button>
              </div>
            </header>
            <template v-if="documentState.inspection.preview.type === 'text'">
              <div v-if="documentEditor.type === 'editing' && documentEditor.mode === 'edit'" class="knowledge-markdown-editor">
                <textarea v-model="documentEditor.draft" aria-label="Markdown source" spellcheck="true" />
                <footer>
                  <p v-if="documentEditor.save.type === 'failed'" role="alert">Save failed: {{ documentEditor.save.error.code }}</p>
                  <span v-else>{{ documentEditor.draft.length.toLocaleString() }} characters</span>
                  <button type="button" class="knowledge-primary-action" :disabled="documentEditor.save.type === 'saving'" @click="saveDocumentContent">{{ documentEditor.save.type === 'saving' ? 'Saving…' : 'Save changes' }}</button>
                </footer>
              </div>
              <MarkdownPreview v-else-if="/\.(md|markdown)$/i.test(documentState.inspection.detail.name)" :source="documentEditor.type === 'editing' ? documentEditor.draft : documentState.inspection.preview.content" />
              <pre v-else>{{ documentState.inspection.preview.content || 'This file is empty.' }}</pre>
            </template>
            <div v-else-if="documentState.inspection.preview.type === 'failed'" class="knowledge-document-preview-failure" role="status">
              <strong>Preview is temporarily unavailable.</strong>
              <p>The document metadata is still available. Retry after the object storage service is restored.</p>
              <button type="button" class="knowledge-secondary-action" @click="loadDocument(documentState.resourceId)">Retry preview</button>
            </div>
            <p v-else>Inline preview is unavailable for this file type.</p>
            <small v-if="documentState.inspection.preview.type === 'text' && documentState.inspection.preview.truncated">Preview truncated to the first 200 KB.</small>
          </section>
        </template>
      </article>
    </div>
  </section>

  <div v-if="dialog.type !== 'closed'" class="knowledge-dialog-backdrop" @mousedown.self="closeDialog">
    <form v-if="dialog.type === 'edit'" class="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-knowledge-space-title" @submit.prevent="saveMetadata">
      <header><div><span>KNOWLEDGE SPACE</span><h2 id="edit-knowledge-space-title">Edit details</h2><p>Update metadata without changing files or graph state.</p></div><button type="button" aria-label="Close" @click="closeDialog">×</button></header>
      <label>Name *<input v-model="form.name" required maxlength="255" /></label>
      <label>Description · optional<textarea v-model="form.description" maxlength="4000" rows="3" /></label>
      <label>Category *<AppSelect v-model="form.categoryId" control-label="Knowledge Space category" :options="categoryOptions" /></label>
      <p v-if="mutation.type === 'failed'" class="knowledge-form-error" role="alert">Could not save: {{ mutation.error.code }}</p>
      <footer><button type="button" class="knowledge-secondary-action" @click="closeDialog">Cancel</button><button type="submit" class="knowledge-primary-action" :disabled="mutation.type === 'saving'">{{ mutation.type === 'saving' ? 'Saving…' : 'Save changes' }}</button></footer>
    </form>
    <section v-else-if="dialog.type === 'delete'" class="knowledge-dialog knowledge-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-knowledge-space-title">
      <header><div><span>PERMANENT ACTION</span><h2 id="delete-knowledge-space-title">Delete {{ state.type === 'ready' ? state.detail.name : 'Knowledge Space' }}?</h2><p>This is only allowed when the archived Knowledge Space has no documents or references.</p></div><button type="button" aria-label="Close" @click="closeDialog">×</button></header>
      <p v-if="mutation.type === 'failed'" class="knowledge-form-error" role="alert">Could not delete: {{ mutation.error.code }}<span v-if="mutation.error.code === 'STATE_CONFLICT'"> · {{ mutation.error.reason }}</span></p>
      <footer><button type="button" class="knowledge-secondary-action" @click="closeDialog">Cancel</button><button type="button" class="knowledge-danger-action" :disabled="mutation.type === 'saving'" @click="confirmDelete">{{ mutation.type === 'saving' ? 'Deleting…' : 'Delete permanently' }}</button></footer>
    </section>
    <section v-else-if="dialog.type === 'delete-resource'" class="knowledge-dialog knowledge-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-knowledge-resource-title">
      <header><div><span>DELETE FILE</span><h2 id="delete-knowledge-resource-title">Delete {{ dialog.resourceName }}?</h2><p>This removes the file from this Knowledge Space. You can upload a replacement afterward.</p></div><button type="button" aria-label="Close" @click="closeDialog">×</button></header>
      <p v-if="mutation.type === 'failed'" class="knowledge-form-error" role="alert">Could not delete file: {{ mutation.error.code }}</p>
      <footer><button type="button" class="knowledge-secondary-action" @click="closeDialog">Cancel</button><button type="button" class="knowledge-danger-action" :disabled="mutation.type === 'saving'" @click="confirmDeleteResource">{{ mutation.type === 'saving' ? 'Deleting…' : 'Delete file' }}</button></footer>
    </section>
    <form v-if="dialog.type === 'folder'" class="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="create-folder-title" @submit.prevent="createFolder">
      <header><div><span>KNOWLEDGE SPACE</span><h2 id="create-folder-title">New folder</h2><p>Create a folder inside {{ selectedFolderLabel }}.</p></div><button type="button" aria-label="Close" @click="closeDialog">×</button></header>
      <label>Folder name *<input v-model="folderName" required maxlength="255" autofocus /></label>
      <p v-if="mutation.type === 'failed'" class="knowledge-form-error" role="alert">Could not create folder: {{ mutation.error.code }}</p>
      <footer><button type="button" class="knowledge-secondary-action" @click="closeDialog">Cancel</button><button type="submit" class="knowledge-primary-action" :disabled="mutation.type === 'saving'">{{ mutation.type === 'saving' ? 'Creating…' : 'Create folder' }}</button></footer>
    </form>
  </div>

  <KnowledgeManifestImportDialog v-if="state.type === 'ready' && isManifestImportOpen" :knowledge-space-id="state.detail.id" :revision="state.detail.revision" @close="isManifestImportOpen = false" @applied="finishManifestImport" />
  <div v-if="manifestToast" class="knowledge-toast" role="status">{{ manifestToast }}</div>

  <div v-if="folderContextMenu.type === 'open'" class="knowledge-folder-context-menu" role="menu" aria-label="Folder actions" :style="{ left: `${folderContextMenu.x}px`, top: `${folderContextMenu.y}px` }" @pointerdown.stop>
    <button type="button" role="menuitem" @click="openFolderDialog">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.75 6A1.75 1.75 0 0 1 4.5 4.25h3.1L9.15 6h6.35a1.75 1.75 0 0 1 1.75 1.75v6.5A1.75 1.75 0 0 1 15.5 16H4.5a1.75 1.75 0 0 1-1.75-1.75V6Z" /><path d="M10 9v4M8 11h4" /></svg>
      New folder inside
    </button>
  </div>
  <div v-if="resourceContextMenu.type === 'open'" class="knowledge-folder-context-menu knowledge-resource-context-menu" role="menu" aria-label="File actions" :style="{ left: `${resourceContextMenu.x}px`, top: `${resourceContextMenu.y}px` }" @pointerdown.stop>
    <button type="button" role="menuitem" class="is-danger" @click="openDeleteResource(resourceContextMenu.resourceId, resourceContextMenu.resourceName)">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6h11M8 3.5h4M6.5 6l.7 10h5.6l.7-10M8.5 8.5v5M11.5 8.5v5" /></svg>
      Delete file
    </button>
  </div>
</template>
