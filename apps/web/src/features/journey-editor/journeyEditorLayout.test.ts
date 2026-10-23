import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(resolve('src/features/journey-editor/journey-editor.css'), 'utf8')

describe('Journey editor layout', () => {
  it('keeps Execution Behavior in normal content flow on desktop', () => {
    expect(stylesheet).toContain(
      '.system-configuration-grid{height:auto;min-height:0;grid-template-rows:minmax(420px,480px) 112px;align-content:start;',
    )
    expect(stylesheet).not.toContain('grid-template-rows:minmax(300px,1fr) 112px')
  })
})
