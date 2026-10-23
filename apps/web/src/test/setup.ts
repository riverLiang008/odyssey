// jsdom does not implement layout observation. Geometry is verified in a browser;
// component tests still mount the real Vue Flow and node renderers.
import { vi } from 'vitest'
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})
