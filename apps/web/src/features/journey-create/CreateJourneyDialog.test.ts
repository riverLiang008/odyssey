import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import { editorRepositoryKey } from '@/app/editorRepository'
import { InMemoryEditorRepository } from '@/repositories'
import CreateJourneyDialog from './CreateJourneyDialog.vue'

function mountDialog() {
  const journeyId = uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f9001')
  const repository = new InMemoryEditorRepository({ journeyIdFactory: () => journeyId })
  const wrapper = mount(CreateJourneyDialog, { attachTo: document.body, global: { provide: { [editorRepositoryKey as symbol]: repository } } })
  return { journeyId, repository, wrapper }
}

describe('CreateJourneyDialog', () => {
  it('starts without a selected Pattern and requires both name and Pattern', async () => {
    const { wrapper } = mountDialog()
    const create = wrapper.get('button[type="submit"]')
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(0)
    expect(create.attributes('disabled')).toBeDefined()
    await wrapper.get('input').setValue('Review Loop')
    expect(create.attributes('disabled')).toBeDefined()
    await wrapper.findAll('[role="radio"]')[1]?.trigger('click')
    expect(create.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('creates the explicitly selected immutable Pattern', async () => {
    const { journeyId, repository, wrapper } = mountDialog()
    await wrapper.get('input').setValue(' Review Loop ')
    await wrapper.get('textarea').setValue(' Iterative review ')
    await wrapper.findAll('[role="radio"]')[1]?.trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('created')?.[0]).toEqual([journeyId])
    const loaded = await repository.loadJourney(journeyId)
    expect(loaded.ok && loaded.value.pattern.kind).toBe('diamond_loop')
    expect(loaded.ok && loaded.value.journey.name).toBe('Review Loop')
    wrapper.unmount()
  })

  it('supports radio arrow keys and Escape cancellation', async () => {
    const { wrapper } = mountDialog()
    const first = wrapper.findAll('[role="radio"]')[0]
    await first?.trigger('click')
    await first?.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.findAll('[role="radio"]')[1]?.attributes('aria-checked')).toBe('true')
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})
