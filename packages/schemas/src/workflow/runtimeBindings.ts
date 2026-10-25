import type { AgentReusableTool, ToolStep } from './tools'
import type { ValueSource } from './values'
import type { WorkflowNode, LoopBodyNode } from './workflow'

export function valueHasRuntimeBinding(value: ValueSource | undefined): boolean {
  return value?.kind === 'system' || (value?.kind === 'template' && value.segments.some(segment => segment.kind === 'system'))
}
export function toolHasRuntimeBinding(tool: ToolStep | AgentReusableTool): boolean {
  if ('inputBindings' in tool && tool.inputBindings.some(valueHasRuntimeBinding)) return true
  switch (tool.kind) {
    case 'knowledge_retrieval': return typeof tool.configuration.knowledgeSpaceId !== 'string' || valueHasRuntimeBinding(tool.configuration.query)
    case 'script_execution': return false
    case 'set_variable': return 'value' in tool.configuration && valueHasRuntimeBinding(tool.configuration.value)
    case 'llm_call': return valueHasRuntimeBinding(tool.configuration.prompt) || valueHasRuntimeBinding(tool.configuration.systemPrompt)
    case 'api_request': {
      const config = tool.configuration
      return valueHasRuntimeBinding(config.url) || config.headers.some(entry => valueHasRuntimeBinding(entry.value)) ||
        (config.body.kind === 'json' ? valueHasRuntimeBinding(config.body.value) : config.body.kind === 'form_data' && config.body.entries.some(entry => valueHasRuntimeBinding(entry.value)))
    }
  }
}
export function nodesHaveRuntimeBinding(nodes: readonly (WorkflowNode | LoopBodyNode)[]): boolean {
  return nodes.some(node => {
    switch (node.type) {
      case 'agent_action': return node.config.knowledgeSpaceIds.some(reference => typeof reference !== 'string') || valueHasRuntimeBinding(node.config.goal)
      case 'task': return node.config.steps.some(toolHasRuntimeBinding)
      case 'branch': return node.config.cases.some(entry => entry.conditions.some(condition => valueHasRuntimeBinding(condition.left) || ('right' in condition && valueHasRuntimeBinding(condition.right))))
      case 'loop': return nodesHaveRuntimeBinding(node.config.body.graph.nodes)
      default: return false
    }
  })
}
