import { describe, expect, it } from 'vitest'
import { uuidSchema, type AgentReusableTool, type WorkflowNode } from '@odyssey/schemas'

import { agentReusableToolReferenceCount, createAgentReusableToolFromTaskStep, deleteAgentReusableTool, instantiateAndBindAgentReusableTool } from './agentReusableToolCommands'
import { createAgentWorkflowEditorDocumentFixture } from '@/fixtures'

const id = (suffix: number) => uuidSchema.parse(`00000000-0000-4000-8000-${suffix.toString().padStart(12, '0')}`)
const node: WorkflowNode = {
  id: id(1),
  type: 'agent_action',
  name: 'Research',
  config: { model: 'gpt-5', goal: { kind: 'literal', value: 'Research' }, knowledgeSpaceIds: [], reusableToolIds: [] },
}
const tool: AgentReusableTool = {
  id: id(2),
  name: 'Script Execution',
  sourceTemplateId: null,
  kind: 'script_execution',
  configuration: { language: 'python', inputs: [], script: 'result = 1' },
  inputBindings: [],
  outputBinding: null,
}

describe('instantiateAndBindAgentReusableTool', () => {
  it('creates one owned reusable Tool and binds its identity atomically', () => {
    const sourceNodes = [structuredClone(node)]
    const result = instantiateAndBindAgentReusableTool(sourceNodes, [], { nodeId: node.id, tool })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.reusableTools).toEqual([tool])
    expect(result.value.nodes[0]?.type === 'agent_action' ? result.value.nodes[0].config.reusableToolIds : []).toEqual([tool.id])
    expect(sourceNodes[0]?.type === 'agent_action' ? sourceNodes[0].config.reusableToolIds : []).toEqual([])
  })

  it('rejects duplicate owned identities without returning partial state', () => {
    const result = instantiateAndBindAgentReusableTool([node], [tool], { nodeId: node.id, tool })
    expect(result).toEqual({ ok: false, error: { code: 'RESOURCE_ALREADY_BOUND', nodeId: node.id, resourceId: tool.id } })
  })
})

describe('reusable Tool library management', () => {
  it('copies a configured Task step into an independent Agent reusable Tool', () => {
    const step = {
      id: id(3),
      kind: 'script_execution' as const,
      label: 'Prepare result',
      configuration: { language: 'javascript' as const, inputs: [], script: 'return 1' },
      outputMapping: { sourceKey: 'result', targetVariableId: id(5) },
      failureBehavior: { kind: 'fail_task' as const },
    }
    const result = createAgentReusableToolFromTaskStep([], step, id(4))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.tool).toEqual({
      id: id(4),
      name: 'Prepare result',
      sourceTemplateId: null,
      kind: 'script_execution',
      configuration: step.configuration,
      inputBindings: [],
      outputBinding: null,
    })
    expect(step).toEqual({
      id: id(3), kind: 'script_execution', label: 'Prepare result', configuration: { language: 'javascript', inputs: [], script: 'return 1' }, outputMapping: { sourceKey: 'result', targetVariableId: id(5) }, failureBehavior: { kind: 'fail_task' },
    })
  })

  it('rejects an Agent reusable Tool identity collision without mutation', () => {
    const step = { id: id(3), kind: 'script_execution' as const, label: null, configuration: { language: 'python' as const, script: 'result = 1' }, outputMapping: null, failureBehavior: { kind: 'fail_task' as const } }
    expect(createAgentReusableToolFromTaskStep([tool], step, tool.id)).toEqual({ ok: false, error: { code: 'RESOURCE_ID_CONFLICT', resourceId: tool.id } })
  })

  it('counts Agent Action references but not independent Task snapshots', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const reusableToolId = document.reusableTools[0]!.id
    expect(agentReusableToolReferenceCount(document, reusableToolId)).toBe(1)
  })

  it('blocks deletion while the canonical Tool is referenced', () => {
    const document = createAgentWorkflowEditorDocumentFixture('research')
    const reusableToolId = document.reusableTools[0]!.id
    expect(deleteAgentReusableTool(document, reusableToolId)).toEqual({ ok: false, error: { code: 'RESOURCE_IN_USE', resourceId: reusableToolId, referenceCount: 1 } })
  })

  it('deletes an unreferenced canonical Tool without mutating the document', () => {
    const source = createAgentWorkflowEditorDocumentFixture('minimal')
    const document = {
      ...source,
      workflow: {
        ...source.workflow,
        nodes: source.workflow.nodes.map((candidate) => candidate.type === 'agent_action' ? { ...candidate, config: { ...candidate.config, reusableToolIds: [] } } : candidate),
      },
    }
    const reusableToolId = document.reusableTools[0]!.id
    const result = deleteAgentReusableTool(document, reusableToolId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual([])
    expect(document.reusableTools).toHaveLength(1)
  })
})
