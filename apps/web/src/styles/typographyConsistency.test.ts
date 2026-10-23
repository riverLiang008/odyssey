import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourceFiles = [
  'src/styles/app-shell.css',
  'src/features/knowledge-space/knowledge-space.css',
  'src/features/journey-editor/journey-editor.css',
  'src/features/workflow-editor/SystemToolPanel.vue',
]

describe('application typography', () => {
  it('uses one global sans-serif token instead of page-specific font stacks', () => {
    const mainCss = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf8')
    expect(mainCss).toContain('--odyssey-font-sans:')
    expect(mainCss).toContain('font-family: var(--odyssey-font-sans);')

    for (const relativePath of sourceFiles) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8')
      expect(source, relativePath).not.toMatch(/font(?:-family)?\s*:[^;}]*(?:Inter|Manrope)/)
    }
  })

  it('shares one collection-page header and toolbar rhythm across Journey and Knowledge Space lists', () => {
    const shellCss = readFileSync(resolve(process.cwd(), 'src/styles/app-shell.css'), 'utf8')
    const journeyView = readFileSync(resolve(process.cwd(), 'src/views/JourneyListView.vue'), 'utf8')
    const knowledgeView = readFileSync(resolve(process.cwd(), 'src/views/KnowledgeSpaceListView.vue'), 'utf8')

    for (const source of [journeyView, knowledgeView]) {
      expect(source).toContain('collection-list-page')
      expect(source).toContain('collection-page-heading')
      expect(source).toContain('collection-primary-action')
      expect(source).toContain('collection-toolbar')
    }
    expect(shellCss).toContain('.collection-page-heading h1 { margin:0 0 8px;')
    expect(shellCss).toContain('font-size:30px; font-weight:600;')
    expect(shellCss).toContain('.collection-page-heading p { margin:0; color:var(--odyssey-muted); font-size:13px; }')
  })
})
