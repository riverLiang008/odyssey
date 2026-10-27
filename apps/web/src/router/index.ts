import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import AppShell from '@/app/AppShell.vue'
import { isPublicDemo } from '@/app/appMode'


export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
  history,
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: 'journeys', name: 'journeys', component: () => import('@/views/JourneyListView.vue') },
        { path: 'journeys/new', name: 'journey-create', component: () => import('@/views/JourneyListView.vue') },
        { path: 'journeys/:journeyId', name: 'journey-editor', component: () => import('@/views/JourneyEditorView.vue') },
        { path: 'journeys/:journeyId/agents/:agentId', name: 'agent-workflow', component: () => import('@/views/AgentWorkflowView.vue') },
        { path: 'assets/knowledge-spaces', name: 'knowledge-spaces', component: () => import('@/views/KnowledgeSpaceListView.vue') },
        { path: 'assets/knowledge-spaces/new', name: 'knowledge-space-create', component: () => import('@/views/KnowledgeSpaceListView.vue') },
        { path: 'assets/knowledge-spaces/:knowledgeSpaceId', name: 'knowledge-space-detail', component: () => import('@/views/KnowledgeSpaceDetailView.vue') },
        { path: 'assets/knowledge-spaces/:knowledgeSpaceId/documents/:resourceId', name: 'knowledge-document-detail', component: () => import('@/views/KnowledgeSpaceDetailView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  })
  if (isPublicDemo) router.beforeEach(to => {
    if (to.name === 'journey-create') return { name: 'journeys' }
    if (to.name === 'knowledge-space-create') return { name: 'knowledge-spaces' }
  })
  return router
}

export const router = createAppRouter()

