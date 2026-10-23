import { describe, expect, it } from 'vitest'
import { agentWorkflowExportSchema } from './workflowExport'

const exportCandidate = {
  kind: 'odyssey.agent-workflow',
  formatVersion: 1,
  exportedAt: '2026-10-18T06:00:00.000Z',
  source: {
    journeyId: '00000000-0000-4000-8000-000000000001',
    agentId: '00000000-0000-4000-8000-000000000002',
    agentName: 'Demo Agent',
  },
  document: {
    workflow: {
      schemaVersion: '1.0.0',
      nodes: [
        { id: '00000000-0000-4000-8000-000000000003', name: 'Start', type: 'start', config: {} },
        { id: '00000000-0000-4000-8000-000000000004', name: 'End', type: 'end', config: {} },
      ],
      edges: [{ id: '00000000-0000-4000-8000-000000000005', sourceNodeId: '00000000-0000-4000-8000-000000000003', targetNodeId: '00000000-0000-4000-8000-000000000004' }],
    },
    layout: {
      schemaVersion: '1.0.0',
      nodePlacements: [
        { nodeId: '00000000-0000-4000-8000-000000000003', x: 0, y: 0 },
        { nodeId: '00000000-0000-4000-8000-000000000004', x: 240, y: 0 },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    variables: [],
    reusableTools: [],
  },
} as const

describe('agentWorkflowExportSchema', () => {
  it('accepts the versioned V1 envelope', () => {
    expect(agentWorkflowExportSchema.parse(exportCandidate)).toEqual(exportCandidate)
  })

  it('fails closed for unknown fields and unsupported versions', () => {
    expect(agentWorkflowExportSchema.safeParse({ ...exportCandidate, unknown: true }).success).toBe(false)
    expect(agentWorkflowExportSchema.safeParse({ ...exportCandidate, formatVersion: 2 }).success).toBe(false)
  })
})
