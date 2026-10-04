import { describe, expect, it, vi } from 'vitest'

import { AutosaveCoordinator } from './autosaveCoordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => { resolve = settle })
  return { promise, resolve }
}

describe('AutosaveCoordinator', () => {
  it('debounces scheduled work and executes only the latest operation', async () => {
    vi.useFakeTimers()
    try {
      const coordinator = new AutosaveCoordinator()
      const first = vi.fn(async () => true)
      const latest = vi.fn(async () => true)
      coordinator.schedule(first, 800)
      coordinator.schedule(latest, 800)
      await vi.advanceTimersByTimeAsync(800)
      expect(first).not.toHaveBeenCalled()
      expect(latest).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns the same promise while an operation is in flight', async () => {
    const coordinator = new AutosaveCoordinator()
    const pending = deferred<boolean>()
    const operation = vi.fn(() => pending.promise)
    const first = coordinator.run(operation)
    const second = coordinator.run(operation)
    expect(first).toBe(second)
    expect(operation).toHaveBeenCalledTimes(1)
    pending.resolve(true)
    await first
  })

  it('cancels scheduled work on disposal', async () => {
    vi.useFakeTimers()
    try {
      const coordinator = new AutosaveCoordinator()
      const operation = vi.fn(async () => true)
      coordinator.schedule(operation, 800)
      coordinator.dispose()
      await vi.runAllTimersAsync()
      expect(operation).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
