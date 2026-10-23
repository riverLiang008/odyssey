import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { uuidSchema, type BranchNode } from '@odyssey/schemas'
import BranchNodeContent from './BranchNodeContent.vue'
vi.mock('@vue-flow/core', async importOriginal => ({ ...await importOriginal<typeof import('@vue-flow/core')>(), useVueFlow: () => ({ updateNodeInternals: vi.fn() }) }))
const id = (n: number) => uuidSchema.parse(`0195f076-b6e6-7ef0-98db-${String(n).padStart(12, '0')}`)
const node: BranchNode = { id: id(1), type: 'branch', name: 'Evidence', config: { cases: [{ id: id(2), label: 'Enough', match: 'all', conditions: [{ id: id(3), left: { kind: 'literal', value: 3 }, operator: 'gte', right: { kind: 'literal', value: 2 } }] }], defaultCase: { id: id(4), label: 'Default' } } }
describe('Branch node rows', () => {
  it('nests stable handles inside their case rows and retains the fallback in Flow', async () => {
    const wrapper = mount(BranchNodeContent, { props: { node, expanded: true, variables: [], connectedHandles: [id(2)] }, global: { stubs: { Handle: true } } })
    expect(wrapper.get(`[data-case-id="${id(2)}"] handle-stub`).attributes('id')).toBe(id(2))
    expect(wrapper.get(`[data-case-id="${id(2)}"]`).text()).toContain('3 ≥ At least 2')
    expect(wrapper.get(`[data-case-id="${id(4)}"]`).text()).toContain('Not connected')
    await wrapper.setProps({ expanded: false, readOnly: true })
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('At least')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('handle-stub').attributes('connectable')).toBe('false')
    wrapper.unmount()
  })
  it('retains inline rename with Enter and cancels with Escape', async () => {
    const wrapper = mount(BranchNodeContent, { props: { node, expanded: true, variables: [], connectedHandles: [] }, global: { stubs: { Handle: true } } })
    await wrapper.get('[aria-label="Edit branch name"]').trigger('click')
    await wrapper.get('input').setValue('Reviewed evidence')
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('rename')).toEqual([['Reviewed evidence']])
    await wrapper.get('[aria-label="Edit branch name"]').trigger('click')
    await wrapper.get('input').setValue('Cancelled')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('rename')).toHaveLength(1)
    wrapper.unmount()
  })
})
