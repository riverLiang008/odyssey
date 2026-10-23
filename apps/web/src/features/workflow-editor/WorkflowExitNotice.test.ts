import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { uuidSchema } from '@odyssey/schemas'
import WorkflowExitNotice from './WorkflowExitNotice.vue'

const agentId = uuidSchema.parse('10000000-0000-4000-8000-000000000002')
const wrappers: VueWrapper[] = []
function render(status: { synchronized: boolean; missingTargets: number; unconnected: number } | null) {
  const wrapper = mount(WorkflowExitNotice, {
    props: { agentId, status },
  })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => { wrappers.splice(0).forEach((wrapper) => wrapper.unmount()) })

describe('Workflow exit notice', () => {
  it('shows actionable configuration diagnostics outside the Canvas', () => {
    const wrapper = render({ synchronized: true, missingTargets: 0, unconnected: 1 })
    const notice = document.body.querySelector('.workflow-exit-notice')
    expect(document.body.contains(notice)).toBe(true)
    expect(wrapper.find('.workflow-exit-notice').exists()).toBe(false)
    expect(notice?.textContent).toContain('1 exits need internal connections')
    expect(notice?.querySelector('[role="status"]')).not.toBeNull()
    expect(notice?.querySelector('a')).toBeNull()
  })

  it('stays dismissed for unchanged diagnostics and reopens when the condition changes', async () => {
    const wrapper = render({ synchronized: true, missingTargets: 0, unconnected: 1 })
    document.body.querySelector<HTMLButtonElement>('[aria-label="Dismiss exit notice"]')?.click()
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.workflow-exit-notice')).toBeNull()
    await wrapper.setProps({ status: { synchronized: true, missingTargets: 0, unconnected: 1 } })
    expect(document.body.querySelector('.workflow-exit-notice')).toBeNull()
    await wrapper.setProps({ status: { synchronized: true, missingTargets: 2, unconnected: 1 } })
    expect(document.body.textContent).toContain('1 exits need internal connections · 2 target Slots need an Agent.')
    expect(document.body.textContent).not.toContain('have not been synchronized')
  })

  it('does not show an empty notice for legacy, healthy or non-Pattern workflows', async () => {
    const wrapper = render({ synchronized: true, missingTargets: 0, unconnected: 0 })
    expect(document.body.querySelector('.workflow-exit-notice')).toBeNull()
    await wrapper.setProps({ status: { synchronized: false, missingTargets: 0, unconnected: 1 } })
    expect(document.body.querySelector('.workflow-exit-notice')).toBeNull()
    await wrapper.setProps({ status: null })
    expect(document.body.querySelector('.workflow-exit-notice')).toBeNull()
  })
})
