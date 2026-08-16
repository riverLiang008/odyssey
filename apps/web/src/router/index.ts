import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import AppShell from '@/app/AppShell.vue'

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  return createRouter({
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
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  })
}

export const router = createAppRouter()

