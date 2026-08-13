import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { FIXTURE_IDS } from '@/fixtures'
import { createAppRouter } from './index'

describe('application router', () => {
  it('resolves direct editor navigation and browser-style back navigation', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/journeys')
    await router.push(`/journeys/${FIXTURE_IDS.journey}?tab=agent`)
    expect(router.currentRoute.value.name).toBe('journey-editor')
    expect(router.currentRoute.value.query.tab).toBe('agent')
    router.back()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.currentRoute.value.name).toBe('journeys')
  })

  it('routes unknown addresses to the explicit not-found page', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/does-not-exist')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('resolves direct nested Agent workflow navigation', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push(`/journeys/${FIXTURE_IDS.journey}/agents/${FIXTURE_IDS.researchAgent}`)
    expect(router.currentRoute.value.name).toBe('agent-workflow')
  })
})
