<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { KnowledgeSpaceCategorySummary, KnowledgeSpaceSummary, RepositoryError, UUID } from '@odyssey/schemas'
import { useEditorRepository } from '@/app/editorRepository'
import AppSelect, { type AppSelectOption } from '@/components/AppSelect.vue'
import { routeLocations } from '@/router/routeContracts'

type ListState =
  | { type: 'loading' }
  | { type: 'ready'; spaces: KnowledgeSpaceSummary[]; total: number }
  | { type: 'failed'; error: RepositoryError }

const repository = useEditorRepository()
const route = useRoute()
const router = useRouter()
const state = ref<ListState>({ type: 'loading' })
const categories = ref<KnowledgeSpaceCategorySummary[]>([])
const query = ref('')
const categoryFilter = ref('all')
const graphFilter = ref('all')
const lifecycleFilter = ref<'active' | 'archived' | 'all'>('active')
const sort = ref<'updated' | 'name' | 'created'>('updated')
const categoryOptions = computed<readonly AppSelectOption[]>(() => [
  { value: 'all', label: 'Category' },
  ...categories.value.map((category) => ({ value: category.id, label: category.name })),
])
const graphOptions = [
  { value: 'all', label: 'Graph status' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'not_indexed', label: 'Not indexed' },
  { value: 'error', label: 'Graph error' },
] as const satisfies readonly AppSelectOption[]
const sortOptions = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Created time' },
] as const satisfies readonly AppSelectOption[]
const lifecycleOptions = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All lifecycle states' },
] as const satisfies readonly AppSelectOption[]
const isCreateOpen = computed(() => route.name === 'knowledge-space-create')
let loadController: globalThis.AbortController | null = null

const form = reactive({ name: '', description: '', categoryId: '', newCategoryName: '' })
const creating = ref(false)
const createError = ref<RepositoryError | null>(null)
const isCreatingCategory = ref(false)

const visibleSpaces = computed(() => {
  if (state.value.type !== 'ready') return []
  const filtered = state.value.spaces.filter((space) =>
    (categoryFilter.value === 'all' || space.category.id === categoryFilter.value)
    && (graphFilter.value === 'all' || space.graphStatus === graphFilter.value)
    && (lifecycleFilter.value === 'all' || (lifecycleFilter.value === 'archived' ? space.lifecycleStatus === 'archived' : space.lifecycleStatus !== 'archived')),
  )
  return [...filtered].sort((left, right) => {
    if (sort.value === 'name') return left.name.localeCompare(right.name)
    if (sort.value === 'created') return right.createdAt.localeCompare(left.createdAt)
    return right.updatedAt.localeCompare(left.updatedAt)
  })
})

const groupedSpaces = computed(() => categories.value.map((category) => ({
  category,
  spaces: visibleSpaces.value.filter((space) => space.category.id === category.id),
})).filter((group) => group.spaces.length > 0))

function statusLabel(status: KnowledgeSpaceSummary['graphStatus']) {
  return ({ not_indexed: 'Not indexed', healthy: 'Healthy', needs_review: 'Needs review', error: 'Graph error' } as const)[status]
}

function relativeUpdated(value: string) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000))
  return hours < 1 ? 'Updated just now' : hours < 24 ? `Updated ${hours}h ago` : `Updated ${Math.round(hours / 24)}d ago`
}

function updateSort(value: string) {
  if (value === 'updated' || value === 'name' || value === 'created') sort.value = value
}

function updateLifecycleFilter(value: string) {
  if (value === 'active' || value === 'archived' || value === 'all') {
    lifecycleFilter.value = value
    void load()
  }
}

async function load() {
  loadController?.abort()
  const controller = new globalThis.AbortController()
  loadController = controller
  state.value = { type: 'loading' }
  const [spacesResult, categoriesResult] = await Promise.all([
    repository.listKnowledgeSpaces({ query: query.value, pageSize: 100, includeArchived: lifecycleFilter.value !== 'active' }, { signal: controller.signal }),
    repository.listKnowledgeSpaceCategories({ signal: controller.signal }),
  ])
  if (controller.signal.aborted || controller !== loadController) return
  if (!spacesResult.ok) { state.value = { type: 'failed', error: spacesResult.error }; return }
  if (!categoriesResult.ok) { state.value = { type: 'failed', error: categoriesResult.error }; return }
  categories.value = categoriesResult.value
  state.value = { type: 'ready', spaces: spacesResult.value.items, total: spacesResult.value.total }
  if (!form.categoryId && categories.value[0]) form.categoryId = categories.value[0].id
  isCreatingCategory.value = categories.value.length === 0
}

function resetForm() {
  form.name = ''; form.description = ''; form.categoryId = categories.value[0]?.id ?? ''; form.newCategoryName = ''
  createError.value = null; isCreatingCategory.value = categories.value.length === 0
}

async function closeCreate() {
  if (creating.value) return
  resetForm()
  await router.push(routeLocations.knowledgeSpaces())
}

async function submitCreate() {
  if (creating.value) return
  creating.value = true; createError.value = null
  let categoryId = form.categoryId as UUID | ''
  if (isCreatingCategory.value) {
    const categoryResult = await repository.createKnowledgeSpaceCategory({ name: form.newCategoryName, colorToken: null })
    if (!categoryResult.ok) { creating.value = false; createError.value = categoryResult.error; return }
    categories.value.push(categoryResult.value)
    categoryId = categoryResult.value.id
  }
  if (!categoryId) { creating.value = false; return }
  const result = await repository.createKnowledgeSpace({ name: form.name, description: form.description || null, categoryId })
  creating.value = false
  if (!result.ok) { createError.value = result.error; return }
  await router.replace(routeLocations.knowledgeSpace(result.value.id))
}

onMounted(load)
onBeforeUnmount(() => loadController?.abort())
</script>

<template>
  <section class="knowledge-list-page" aria-labelledby="knowledge-list-title" :inert="isCreateOpen || undefined">
    <header class="knowledge-page-heading">
      <div><span class="knowledge-breadcrumb">OdyJourney / Assets / Knowledge Spaces</span><h1 id="knowledge-list-title">Knowledge Spaces</h1><p>Your file workspaces, organized by category and maintained as knowledge graphs.</p></div>
      <RouterLink class="knowledge-primary-action" :to="routeLocations.newKnowledgeSpace()">＋ New Knowledge Space</RouterLink>
    </header>

    <form class="knowledge-toolbar" aria-label="Knowledge Space list controls" @submit.prevent="load">
      <input v-model="query" aria-label="Search Knowledge Spaces" placeholder="⌕  Search knowledge spaces" />
      <AppSelect v-model="categoryFilter" control-label="Category filter" :options="categoryOptions" />
      <AppSelect v-model="graphFilter" control-label="Graph status filter" :options="graphOptions" />
      <AppSelect :model-value="lifecycleFilter" control-label="Lifecycle filter" :options="lifecycleOptions" @update:model-value="updateLifecycleFilter" />
      <AppSelect :model-value="sort" control-label="Sort Knowledge Spaces" :options="sortOptions" @update:model-value="updateSort" />
      <button type="submit">Search</button>
      <span v-if="state.type === 'ready'">{{ state.total }} knowledge spaces</span>
    </form>

    <div v-if="state.type === 'loading'" class="knowledge-loading" role="status"><i v-for="index in 3" :key="index" /></div>
    <div v-else-if="state.type === 'failed'" class="knowledge-empty" role="alert"><strong>Knowledge Spaces could not be loaded.</strong><span>{{ state.error.code }}</span><button type="button" @click="load">Retry</button></div>
    <div v-else-if="state.spaces.length === 0" class="knowledge-empty" role="status"><strong>Create your first Knowledge Space</strong><span>Organize files and expose them safely to Agents and Tools.</span><RouterLink :to="routeLocations.newKnowledgeSpace()">Create Knowledge Space</RouterLink></div>
    <div v-else-if="visibleSpaces.length === 0" class="knowledge-empty" role="status"><strong>No matching Knowledge Spaces</strong><span>Try another search or clear the filters.</span><button type="button" @click="categoryFilter = 'all'; graphFilter = 'all'; lifecycleFilter = 'active'; query = ''; load()">Clear filters</button></div>
    <section v-for="group in groupedSpaces" v-else :key="group.category.id" class="knowledge-category-section">
      <header><h2>{{ group.category.name.toLocaleUpperCase() }}</h2><i :style="group.category.colorToken ? { background: `var(--knowledge-category-${group.category.colorToken}, #5073f3)` } : undefined" /></header>
      <div class="knowledge-card-grid">
        <RouterLink v-for="space in group.spaces" :key="space.id" class="knowledge-space-card" :to="routeLocations.knowledgeSpace(space.id)">
          <div><h3>{{ space.name }}</h3><span class="knowledge-status" :data-status="space.graphStatus"><i />{{ statusLabel(space.graphStatus) }}</span></div>
          <p>{{ space.description || 'No description yet.' }}</p>
          <small>{{ space.fileCount }} files · {{ space.knowledgeFamilyCount }} families</small>
          <small v-if="space.openIssueCount">{{ space.openIssueCount }} issues · {{ relativeUpdated(space.updatedAt) }}</small><small v-else>{{ relativeUpdated(space.updatedAt) }}</small>
        </RouterLink>
      </div>
    </section>
  </section>

  <div v-if="isCreateOpen" class="knowledge-dialog-backdrop" @mousedown.self="closeCreate">
    <form class="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="new-knowledge-space-title" @submit.prevent="submitCreate">
      <header><div><span>NEW ASSET</span><h2 id="new-knowledge-space-title">Create Knowledge Space</h2><p>Create the file workspace first. Uploads will be added in the next step.</p></div><button type="button" aria-label="Close" :disabled="creating" @click="closeCreate">×</button></header>
      <label>Name *<input v-model="form.name" required maxlength="255" autofocus placeholder="Research knowledge" /></label>
      <label>Description · optional<textarea v-model="form.description" maxlength="4000" rows="3" placeholder="What belongs in this Knowledge Space?" /></label>
      <label v-if="!isCreatingCategory && categories.length">Category *<select v-model="form.categoryId" required><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
      <label v-else>New category *<input v-model="form.newCategoryName" required maxlength="255" placeholder="Research" /></label>
      <button v-if="categories.length" class="knowledge-text-button" type="button" @click="isCreatingCategory = !isCreatingCategory">{{ isCreatingCategory ? 'Choose an existing category' : '+ Create a new category' }}</button>
      <p v-if="createError" class="knowledge-form-error" role="alert">Could not create Knowledge Space: {{ createError.code }}</p>
      <footer><button type="button" class="knowledge-secondary-action" :disabled="creating" @click="closeCreate">Cancel</button><button type="submit" class="knowledge-primary-action" :disabled="creating">{{ creating ? 'Creating…' : 'Create Knowledge Space' }}</button></footer>
    </form>
  </div>
</template>
