import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workflowEditorCss = readFileSync(resolve(process.cwd(), 'src/features/workflow-editor/workflow-editor.css'), 'utf8')
const workflowViewSource = readFileSync(resolve(process.cwd(), 'src/views/AgentWorkflowView.vue'), 'utf8')

describe('Workflow editor responsive persistence status', () => {
  it('never hides the only visible save status at narrow viewports', () => {
    expect(workflowEditorCss).not.toMatch(/\.save-state\s*\{[^}]*display\s*:\s*none/)
    expect(workflowEditorCss).not.toMatch(/\.is-focus-mode \.workflow-toolbar-actions\s*\{[^}]*display\s*:\s*none/)
    expect(workflowEditorCss).toMatch(/\.workflow-toolbar-actions \.save-state\s*\{\s*min-width:\s*72px/)
    expect(workflowEditorCss).toContain('.workflow-context-path>a')
  })

  it('keeps resources in a collapsible right column instead of a horizontal shelf', () => {
    expect(workflowEditorCss).toContain('--workflow-side-panel-width:384px')
    expect(workflowEditorCss).toContain('position:relative; display:block; grid-template-columns:none; gap:0')
    expect(workflowEditorCss).toContain('.workflow-canvas-panel { position:absolute; inset:14px 24px 24px')
    expect(workflowEditorCss).toContain('.workflow-node-palette { position:absolute; z-index:20')
    expect(workflowEditorCss).toContain('.workflow-right-panel-host { position:absolute; z-index:20')
    expect(workflowEditorCss).not.toContain('grid-template-columns:var(--workflow-palette-width) minmax(360px,1fr) var(--workflow-side-panel-width)')
    expect(workflowEditorCss).not.toContain('overflow-x:auto; padding-bottom:2px')
    expect(workflowEditorCss).not.toContain('.workflow-node-palette.is-mode-disabled')
  })

  it('uses the Figma Nodes rail and removes a collapsed resource panel from the layout', () => {
    expect(workflowEditorCss).toContain('.workflow-editor-layout.is-palette-collapsed { --workflow-palette-width:78px; }')
    expect(workflowEditorCss).toContain('.workflow-node-palette.is-collapsed { padding:12px; overflow:visible; border-radius:16px; }')
    expect(workflowEditorCss).toContain('.compact-palette-item { position:relative; width:38px; height:38px;')
    expect(workflowViewSource).toContain('<div v-if="rightPanelVisible" class="workflow-right-panel-host">')
    expect(workflowViewSource).not.toContain("'is-resource-collapsed': session.resourceBrowser.collapsed")
  })

  it('matches the compact Figma canvas controls', () => {
    expect(workflowEditorCss).toContain('.workflow-canvas-controls .mode-toggle { width:174px; height:34px')
    expect(workflowEditorCss).toContain('.workflow-canvas-controls .mode-toggle button:first-child { width:68px; }')
    expect(workflowEditorCss).toContain('.workflow-canvas-controls .mode-toggle button:last-child { width:98px; }')
    expect(workflowEditorCss).toContain('.workflow-canvas-controls .focus-button,.workflow-canvas-controls .workflow-tools__trigger { width:36px; height:34px')
    expect(workflowEditorCss).toContain('.workflow-canvas-controls .focus-button img { width:18px; height:18px')
    expect(workflowViewSource).toContain('<WorkflowToolsMenu @import="openWorkflowImport" @export="exportWorkflow" />')
  })

  it('uses text-only highlighting for the active resource category', () => {
    expect(workflowEditorCss).toContain('.editor-page.workflow-editor-page .workflow-toolbar .workflow-resource-nav button.is-active')
    expect(workflowEditorCss).toMatch(/\.workflow-resource-nav button\.is-active \{[^}]*color:#4d72f2; background:transparent;/)
  })
})
