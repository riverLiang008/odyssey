import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import RevisionConflictDialog from './RevisionConflictDialog.vue'

afterEach(() => globalThis.document.body.replaceChildren())

describe('RevisionConflictDialog', () => {
  it('focuses recovery, exposes all explicit choices, and treats Escape as Stay', async () => {
    const wrapper = mount(RevisionConflictDialog, { props: { subject: 'Workflow' }, attachTo: globalThis.document.body })
    const buttons = [...globalThis.document.body.querySelectorAll<HTMLButtonElement>('.persistence-dialog button')]
    expect(globalThis.document.body.textContent).toContain('Workflow changed on the server')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Stay and review',
      'Reload server version',
      'Overwrite with local version',
    ])
    expect(globalThis.document.activeElement).toBe(buttons[1])
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('stay')).toHaveLength(1)
    wrapper.unmount()
  })

  it('requires an in-app confirmation before emitting a destructive recovery intent', async () => {
    const wrapper = mount(RevisionConflictDialog, { props: { subject: 'Journey' }, attachTo: globalThis.document.body })
    const reload = [...globalThis.document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Reload server version')!
    reload.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('reload')).toBeUndefined()
    expect(globalThis.document.body.textContent).toContain('discarded')
    const confirmReload = [...globalThis.document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Reload server version')!
    confirmReload.click()
    await vi.waitFor(() => {
      expect(wrapper.emitted('reload')).toHaveLength(1)
    })
    wrapper.unmount()
  })

  it('returns to the recovery choices when Escape cancels a staged confirmation', async () => {
    const wrapper = mount(RevisionConflictDialog, { props: { subject: 'Workflow' }, attachTo: globalThis.document.body })
    const overwrite = [...globalThis.document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Overwrite with local version')!
    overwrite.click()
    await wrapper.vm.$nextTick()
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('stay')).toBeUndefined()
    expect(globalThis.document.body.textContent).toContain('Workflow changed on the server')
    wrapper.unmount()
  })
})
