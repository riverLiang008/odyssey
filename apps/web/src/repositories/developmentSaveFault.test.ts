import { afterEach, describe, expect, it } from 'vitest'

import { consumeDevelopmentSaveFailure, installDevelopmentSaveFaultController } from './developmentSaveFault'

afterEach(() => globalThis.window.__ODYSSEY_ACCEPTANCE__?.clear())

describe('development save fault controller', () => {
  it('fails exactly the next save when explicitly armed', () => {
    installDevelopmentSaveFaultController()
    globalThis.window.__ODYSSEY_ACCEPTANCE__?.failNextSave()
    expect(consumeDevelopmentSaveFailure()).toBe(true)
    expect(consumeDevelopmentSaveFailure()).toBe(false)
  })
})
