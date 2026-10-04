export class AutosaveCoordinator {
  #timer: ReturnType<typeof setTimeout> | null = null
  #inFlight: Promise<boolean> | null = null

  get inFlight(): Promise<boolean> | null { return this.#inFlight }

  schedule(operation: () => Promise<boolean>, delayMs: number) {
    this.cancelScheduled()
    this.#timer = setTimeout(() => {
      this.#timer = null
      void this.run(operation)
    }, delayMs)
  }

  run(operation: () => Promise<boolean>): Promise<boolean> {
    this.cancelScheduled()
    if (this.#inFlight) return this.#inFlight
    const pending = operation()
    this.#inFlight = pending
    void pending.finally(() => {
      if (this.#inFlight === pending) this.#inFlight = null
    })
    return pending
  }

  cancelScheduled() {
    if (this.#timer !== null) clearTimeout(this.#timer)
    this.#timer = null
  }

  dispose() {
    this.cancelScheduled()
    this.#inFlight = null
  }
}
