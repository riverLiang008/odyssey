import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import EndMappingFields from './EndMappingFields.vue'

const id = (last: string) => uuidSchema.parse(`10000000-0000-4000-8000-${last.padStart(12, '0')}`)

describe('explicit exit mapping', () => {
  it('does not preselect a target and emits a complete mapping only after every choice', async () => {
    const sources = [{ id: id('1'), name: 'Research path' }, { id: id('2'), name: 'Writing path' }]
    const targets = [{ id: id('3'), name: 'Research Slot' }, { id: id('4'), name: 'Writing Slot' }]
    const wrapper = mount(EndMappingFields, { props: { sources, targets } })
    expect(wrapper.emitted('update')).toBeUndefined()
    await wrapper.get('select[aria-label="Destination for Research path"]').setValue(targets[0]!.id)
    expect(wrapper.emitted('update')?.at(-1)).toEqual([null])
    await wrapper.get('select[aria-label="Destination for Writing path"]').setValue(targets[1]!.id)
    expect(wrapper.emitted('update')?.at(-1)).toEqual([[{ sourceEndId: sources[0]!.id, targetEndId: targets[0]!.id }, { sourceEndId: sources[1]!.id, targetEndId: targets[1]!.id }]])
  })
})
