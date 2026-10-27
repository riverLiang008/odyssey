import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { knowledgeGraphOverviewSchema } from '@odyssey/schemas'
import KnowledgeGraphInspector from './KnowledgeGraphInspector.vue'

const graph = knowledgeGraphOverviewSchema.parse({
  knowledgeSpaceId: '00000000-0000-4000-8000-000000000001',
  status: 'needs_review',
  generatedAt: '2026-10-23T00:00:00Z',
  nodes: [
    { id: '00000000-0000-4000-8000-000000000002', name: 'Getting started', status: 'indexed', summary: 'Begin here.', guide: 'Read first.', tags: [{ id: '00000000-0000-4000-8000-000000000041', name: 'Basics', colorToken: null }], issueIds: ['00000000-0000-4000-8000-000000000031'] },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Crops', status: 'indexed', summary: null, guide: null, tags: [], issueIds: [] },
  ],
  edges: [{ id: '00000000-0000-4000-8000-000000000011', sourceResourceId: '00000000-0000-4000-8000-000000000002', targetResourceId: '00000000-0000-4000-8000-000000000003', kind: 'explains', status: 'active', confidence: 0.9, description: null }],
  families: [{ id: '00000000-0000-4000-8000-000000000021', name: 'Onboarding', colorToken: null, resourceIds: ['00000000-0000-4000-8000-000000000002'] }],
  issues: [{ id: '00000000-0000-4000-8000-000000000031', kind: 'missing_metadata', severity: 'warning', resolutionStatus: 'open', title: 'Review guide', message: 'Check this guide.', resourceIds: ['00000000-0000-4000-8000-000000000002'], relationIds: [] }],
})

describe('KnowledgeGraphInspector', () => {
  it('shows graph metadata and emits close/open intents', async () => {
    const node = graph.nodes[0]
    if (!node) throw new Error('Fixture node missing')
    const wrapper = mount(KnowledgeGraphInspector, { props: { graph, node } })
    expect(wrapper.text()).toContain('Begin here.')
    expect(wrapper.text()).toContain('Onboarding')
    expect(wrapper.text()).toContain('Getting started')
    expect(wrapper.text()).toContain('explains')
    expect(wrapper.text()).toContain('Review guide')

    await wrapper.get('header button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.get('footer button').trigger('click')
    expect(wrapper.emitted('openDocument')).toEqual([[node.id]])
  })
})
