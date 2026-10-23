import type { AgentWorkflowEditorDocument, AgentVariable, TaskLocalVariable, AgentReusableTool, ToolStep, ValueSource, WorkflowNode, LoopBodyNode, UUID } from '@odyssey/schemas'
import type { DslBaseline } from './compiler'
import { caseSymbolPath, collectNodeSignatures, nodeSymbolPath, parseDsl, dslReservedWords, normalizeDslName } from './syntax'

export interface PrintedDsl { readonly source: string; readonly baseline: DslBaseline }
const quote = (value: string) => JSON.stringify(value)
export function printWorkflowDsl(document: AgentWorkflowEditorDocument, knowledge: readonly { id: string; name: string }[], exitNames?: ReadonlyMap<string, string>): PrintedDsl {
  const symbols = new Map<string, UUID>()
  const references = new Map<string, string>()
  const variableAliases = new Map<string, string>()
  const toolAliases = new Map<string, string>()
  const lines: string[] = []
  const line = (depth: number, value: string) => lines.push(`${'  '.repeat(depth)}${value}`)
  const remember = (path: string, objectId: UUID) => { symbols.set(path, objectId) }
  const safeAlias = (name: string, index: number, prefix = 'node') => {
    const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]+/, '')
    return `${prefix}_${index}_${cleaned || 'item'}`
  }
  const variable = (entry: AgentVariable | TaskLocalVariable, depth: number, path: string, local: boolean) => {
    // User keys are schema strings; retain non-identifier keys through the identity section below.
    let alias = /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.key) && !dslReservedWords.has(entry.key) ? entry.key : safeAlias(entry.key, variableAliases.size, 'var')
    const used = new Set([...references.values()].filter((reference) => reference.startsWith(local ? 'task.' : 'agent.')).map((reference) => reference.slice(reference.indexOf('.') + 1)))
    const declaredKeys = new Set(local ? [] : document.variables.filter((variable) => variable.id !== entry.id).map((variable) => variable.key))
    if (alias !== entry.key) while (used.has(alias) || declaredKeys.has(alias)) alias += '_'
    remember(`${path}/variable/${alias}`, entry.id)
    variableAliases.set(entry.id, alias)
    references.set(entry.id, `${local ? 'task' : 'agent'}.${alias}`)
    const declaration = `${entry.dataType} ${'ownership' in entry ? `${entry.ownership} ` : ''}${alias} = ${JSON.stringify(entry.defaultValue)}`
    if ('ownership' in entry) {
      line(depth, `${declaration} {`)
      line(depth + 1, `display_name ${quote(entry.displayName)};`)
      if (entry.description !== null) line(depth + 1, `description ${quote(entry.description)};`)
      line(depth + 1, `read_only ${entry.readOnly};`)
      line(depth, '}')
    } else line(depth, `${declaration};`)
  }
  const identity = (entries: readonly (AgentVariable | TaskLocalVariable)[], depth: number) => {
    const overrides = entries.filter((entry) => variableAliases.get(entry.id) !== entry.key)
    if (!overrides.length) return
    line(depth, 'identity {')
    overrides.forEach((entry) => line(depth + 1, `variable_key ${variableAliases.get(entry.id)} ${quote(entry.key)};`))
    line(depth, '}')
  }
  const value = (entry: ValueSource): string => {
    if (entry.kind === 'variable') return references.get(entry.variableId) ?? `agent.unavailable_variable`
    if (entry.kind === 'literal') return typeof entry.value === 'string' && entry.value.includes('${') ? `literal(${quote(entry.value)})` : JSON.stringify(entry.value)
    const content = entry.segments.map((segment) => segment.kind === 'text'
      ? segment.text.replaceAll('${', '\uE000{') : `\${${references.get(segment.variableId) ?? 'agent.unavailable_variable'}}`).join('')
    return quote(content).replaceAll('\uE000', '\\$')
  }
  const record = (entries: readonly { name: string; value: ValueSource; id: UUID }[], path: string, key: string) => `[${entries.map((entry, index) => {
    remember(`${path}/${key}/${index}`, entry.id)
    return `{ name: ${quote(entry.name)}, value: ${value(entry.value)} }`
  }).join(', ')}]`
  const knowledgeNames = new Map(knowledge.map((entry) => [entry.id, normalizeDslName(entry.name)]))
  const config = (tool: ToolStep | AgentReusableTool, depth: number, path: string) => {
    const setting = (key: string, rendered: string) => line(depth + 1, `${key} = ${rendered};`)
    line(depth, 'config {')
    switch (tool.kind) {
      case 'knowledge_retrieval':
        setting('knowledgeSpaceId', quote(knowledgeNames.get(tool.configuration.knowledgeSpaceId) ?? 'Unavailable Knowledge Space'))
        if (tool.configuration.query) setting('query', value(tool.configuration.query))
        if (tool.configuration.topK !== undefined) setting('topK', String(tool.configuration.topK))
        break
      case 'script_execution':
        setting('language', tool.configuration.language)
        if (tool.configuration.inputs) setting('inputs', `[${tool.configuration.inputs.map((input) => `{ alias: ${quote(input.alias)}, variableId: ${references.get(input.variableId) ?? 'agent.unavailable_variable'} }`).join(', ')}]`)
        setting('script', quote(tool.configuration.script)); break
      case 'api_request': {
        setting('method', tool.configuration.method)
        setting('url', value(tool.configuration.url))
        setting('headers', record(tool.configuration.headers, path, 'header'))
        const body = tool.configuration.body
        setting('body', body.kind === 'none' ? '{ kind: none }' : body.kind === 'json' ? `{ kind: json, value: ${value(body.value)} }` : `{ kind: form_data, entries: ${record(body.entries, path, 'form')} }`)
        break
      }
      case 'set_variable':
        setting('targetVariableId', references.get(tool.configuration.targetVariableId) ?? 'agent.unavailable_variable')
        setting('operation', tool.configuration.operation)
        if ('value' in tool.configuration) setting('value', value(tool.configuration.value))
        break
      case 'llm_call':
        setting('model', quote(tool.configuration.model))
        if (tool.configuration.systemPrompt) setting('systemPrompt', value(tool.configuration.systemPrompt))
        setting('prompt', value(tool.configuration.prompt)); break
    }
    line(depth, '}')
  }
  line(0, `workflow ${quote(document.agent.name)} version "0.1" {`)
  line(1, 'variables {')
  document.variables.forEach((entry) => variable(entry, 2, 'root', false))
  line(1, '}')
  identity(document.variables, 1)
  if (document.reusableTools.length) {
    line(1, 'tools {')
    document.reusableTools.forEach((tool, index) => {
      const key = safeAlias(tool.name, index, 'tool')
      const path = `root/tool/${key}`
      toolAliases.set(tool.id, key); remember(path, tool.id)
      line(2, `reusable_tool ${key} using system_tool ${tool.kind} {`)
      line(3, `name ${quote(tool.name)};`)
      config(tool, 3, path)
      line(3, `input_bindings [${tool.inputBindings.map(value).join(', ')}];`)
      line(3, tool.outputBinding ? `output_binding { sourceKey: ${quote(tool.outputBinding.sourceKey)}, targetVariable: ${references.get(tool.outputBinding.targetVariableId) ?? 'agent.unavailable_variable'} };` : 'output_binding none;')
      line(2, '}')
    })
    line(1, '}')
  }
  const graph = (nodes: readonly (WorkflowNode | LoopBodyNode)[], edges: AgentWorkflowEditorDocument['workflow']['edges'], depth: number, path: string) => {
    const aliases = new Map<string, string>()
    const handleAliases = new Map<string, string>()
    const ends = nodes.filter((node) => node.type === 'end')
    nodes.forEach((node) => {
      const boundary = node.type === 'start' || node.type === 'loop_start' || node.type === 'loop_end' || (node.type === 'end' && ends.length === 1)
      const key = boundary ? node.type : normalizeDslName(node.name)
      aliases.set(node.id, boundary ? node.type : quote(node.name))
      remember(boundary ? `${path}/node/${key}` : nodeSymbolPath(path, node.name), node.id)
    })
    line(depth, 'nodes {')
    nodes.forEach((node) => {
      const boundary = node.type === 'start' || node.type === 'loop_start' || node.type === 'loop_end' || (node.type === 'end' && ends.length === 1)
      const nodePath = boundary ? `${path}/node/${node.type}` : nodeSymbolPath(path, node.name)
      if (node.type === 'start' || node.type === 'loop_start' || node.type === 'loop_end' || node.type === 'end') {
        const defaultName = node.type === 'start' ? 'Start' : node.type === 'end' ? 'End' : node.type === 'loop_start' ? 'Loop Start' : 'Loop End'
        if (boundary && node.name === defaultName) {
          line(depth + 1, `${node.type};`)
          return
        }
        line(depth + 1, `${node.type} ${quote(node.name)} {`)
        if (node.type === 'end' && ends.length > 1) line(depth + 2, `exit ${quote(exitNames?.get(node.id) ?? node.name)};`)
        line(depth + 1, '}'); return
      }
      line(depth + 1, `${node.type} ${quote(node.name)} {`)
      switch (node.type) {
        case 'agent_action':
          line(depth + 2, `model ${quote(node.config.model)};`)
          line(depth + 2, `goal ${value(node.config.goal)};`)
          line(depth + 2, `knowledge [${node.config.knowledgeSpaceIds.map((key) => quote(knowledgeNames.get(key) ?? 'Unavailable Knowledge Space')).join(', ')}];`)
          line(depth + 2, `toolbox [${node.config.reusableToolIds.map((key) => toolAliases.get(key) ?? 'unavailable_tool').join(', ')}];`)
          break
        case 'task':
          line(depth + 2, 'variables {')
          node.config.localVariables.forEach((entry) => variable(entry, depth + 3, nodePath, true))
          line(depth + 2, '}')
          line(depth + 2, 'steps {')
          node.config.steps.forEach((step, index) => {
            const stepKey = safeAlias(step.label ?? step.kind, index, 'step')
            const stepPath = `${nodePath}/step/${stepKey}`
            remember(stepPath, step.id)
            line(depth + 3, `step ${stepKey} using system_tool ${step.kind} {`)
            config(step, depth + 4, stepPath)
            if (step.outputMapping) line(depth + 4, `output ${quote(step.outputMapping.sourceKey)} -> ${references.get(step.outputMapping.targetVariableId) ?? 'agent.unavailable_variable'};`)
            line(depth + 4, `on_failure ${step.failureBehavior.kind === 'retry' ? 'retry 2' : 'fail_task'};`)
            line(depth + 3, '}')
          })
          line(depth + 2, '}')
          identity(node.config.localVariables, depth + 2)
          node.config.localVariables.forEach((entry) => references.delete(entry.id))
          break
        case 'branch':
          node.config.cases.forEach((entry) => {
            const caseKey = quote(entry.label)
            const casePath = caseSymbolPath(nodePath, entry.label)
            handleAliases.set(entry.id, caseKey); remember(casePath, entry.id)
            line(depth + 2, `case ${caseKey} {`)
            entry.conditions.forEach((condition, index) => {
              remember(`${casePath}/condition/${index}`, condition.id)
              const operator = ({ eq: '==', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' } as const)[condition.operator as 'eq'] ?? condition.operator
              line(depth + 3, `when ${value(condition.left)} ${operator}${'right' in condition ? ` ${value(condition.right)}` : ''};`)
            })
            line(depth + 2, '}')
          })
          handleAliases.set(node.config.defaultCase.id, 'default'); remember(`${nodePath}/case/default`, node.config.defaultCase.id)
          line(depth + 2, `default ${quote(node.config.defaultCase.label)};`)
          break
        case 'loop': {
          line(depth + 2, `max_turns ${node.config.maxTurns};`)
          const exit = node.config.exitCondition
          const operator = { eq: '==', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' }[exit.operator]
          line(depth + 2, `exit_when ${references.get(exit.variableId) ?? 'agent.unavailable_variable'} ${operator} ${JSON.stringify(exit.value)};`)
          graph(node.config.body.graph.nodes, node.config.body.graph.edges, depth + 2, nodePath)
          break
        }
      }
      line(depth + 1, '}')
    })
    line(depth, '}')
    line(depth, 'edges {')
    edges.forEach((edge) => {
      const from = aliases.get(edge.sourceNodeId) ?? 'unavailable_node'
      const to = aliases.get(edge.targetNodeId) ?? 'unavailable_node'
      const handle = edge.sourceHandleId ? handleAliases.get(edge.sourceHandleId) : undefined
      const symbol = (reference: string) => reference.startsWith('"') ? normalizeDslName(JSON.parse(reference) as string) : reference
      remember(`${path}/edge/${symbol(from)}.${handle ?? symbol(to)}->${symbol(to)}`, edge.id)
      line(depth + 1, `${from}${handle ? `.${handle}` : ''} -> ${to};`)
    })
    line(depth, '}')

  }
  graph(document.workflow.nodes, document.workflow.edges, 1, 'root')
  line(0, '}')
  const source = `${lines.join('\n')}\n`
  return { source, baseline: { document: structuredClone(document), symbols, nodeSignatures: collectNodeSignatures(parseDsl(source).syntax) } }
}


