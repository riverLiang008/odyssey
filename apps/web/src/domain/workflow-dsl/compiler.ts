import {
  uuidSchema, systemValueKeySchema, systemValueType, knowledgeReferenceKey, type KnowledgeSpaceReference, agentWorkflowExportDocumentSchema, createAgentWorkflowEditorDocumentSchema,
  agentVariableSchema, taskLocalVariableSchema, toolStepSchema, agentReusableToolSchema,
  type AgentWorkflowEditorDocument, type AgentWorkflowExportDocument, type AgentVariable,
  type TaskLocalVariable, type AgentReusableTool, type WorkflowNode, type LoopBodyNode,
  type WorkflowEdge, type CanvasLayout, type EndNode, type UUID, type ValueSource, type JsonValue,
} from '@odyssey/schemas'
import { validateWorkflowGraph } from '../workflow/workflowValidation'
import { caseSymbolPath, nodeSymbolPath, nodeSignature, dslReservedWords as reserved, normalizeDslName, parseDsl, type DslDiagnostic, type DslSyntax, type DslToken, type DslSpan } from './syntax'

export interface DslInventory {
  readonly knowledge: readonly { readonly id: UUID; readonly name: string }[]
  readonly ready: boolean
  readonly systemVariables?: readonly TaskLocalVariable[]
}
export interface DslBaseline {
  readonly symbols: ReadonlyMap<string, UUID>
  readonly document: AgentWorkflowEditorDocument
  readonly nodeSignatures?: ReadonlyMap<string, string>
}
export interface DslContext {
  readonly inventory: DslInventory
  readonly baseline: DslBaseline
  readonly createId: () => UUID
  readonly exitNames?: ReadonlyMap<UUID, string>
  readonly allowIdentityReplacement?: boolean
}
export type DslCompileResult =
  | { readonly status: 'checked'; readonly document: AgentWorkflowExportDocument; readonly diagnostics: readonly DslDiagnostic[]; readonly symbols: ReadonlyMap<string, UUID> }
  | { readonly status: 'invalid' | 'context-required'; readonly diagnostics: readonly DslDiagnostic[] }

const valueFields = new Set(['query', 'url', 'value', 'prompt', 'systemPrompt'])
const operators = new Map([['==', 'eq'], ['!=', 'neq'], ['>', 'gt'], ['>=', 'gte'], ['<', 'lt'], ['<=', 'lte'], ['contains', 'contains'], ['not_contains', 'not_contains'], ['is_empty', 'is_empty'], ['is_not_empty', 'is_not_empty']])
const unresolvedId = uuidSchema.parse('00000000-0000-4000-8000-000000000000')
const types = new Set(['string', 'number', 'boolean', 'json'])
export function compileDsl(source: string, context: DslContext): DslCompileResult {
  const parsed = parseDsl(source)
  const diagnostics: DslDiagnostic[] = [...parsed.diagnostics]
  const symbols = new Map<string, UUID>()
  const identitySymbols = new Map(context.baseline.symbols)
  const locations = new Map<UUID, DslSpan>()
  let needsContext = false
  const report = (code: string, span: DslSpan, severity: DslDiagnostic['severity'] = 'error') => {
    if (diagnostics.length < 200) diagnostics.push({ code, messageKey: code, severity, span })
  }
  const fallback: DslSpan = { start: 0, end: 0 }
  const text = (item: DslSyntax, index = 0) => item.head[index]?.value ?? ''
  const children = (item: DslSyntax): readonly DslSyntax[] => item.kind === 'block' ? item.children : []
  const id = (path: string): UUID => {
    const previous = symbols.get(path) ?? identitySymbols.get(path)
    const value = previous ?? context.createId()
    symbols.set(path, value)
    return value
  }
  const fields = (item: DslSyntax, allowed: readonly string[]) => {
    const result = new Map<string, DslSyntax>()
    for (const child of children(item)) {
      const key = text(child)
      if (!allowed.includes(key)) report('ODSL102', child.span)
      if (result.has(key)) report('ODSL103', child.span)
      result.set(key, child)
    }
    return result
  }
  const requireField = (map: ReadonlyMap<string, DslSyntax>, key: string, owner: DslSyntax) => {
    const field = map.get(key)
    if (!field) report('ODSL104', { start: owner.span.end - 1, end: owner.span.end - 1 })
    return field
  }
  const alias = (item: DslSyntax) => {
    const token = item.head[1]
    if (token?.kind !== 'word' || reserved.has(token.value)) report('ODSL105', token ?? item.span)
    return token?.value ?? ''
  }
  const uniqueName = (name: string, span: DslSpan) => { if (!normalizeDslName(name)) report('ODSL508', span) }
  const root = parsed.syntax[0]
  if (!root || root.kind !== 'block' || text(root) !== 'workflow' || root.head[1]?.kind !== 'string' || text(root, 2) !== 'version' || root.head.length !== 4) {
    report('ODSL102', root?.span ?? fallback)
    return { status: 'invalid', diagnostics }
  }
  if (parsed.syntax.length !== 1) report('ODSL102', parsed.syntax[1]?.span ?? root.span)
  const modern = text(root, 3) === '0.2'
  if (!['0.1', '0.2'].includes(text(root, 3))) report('ODSL601', root.head[3] ?? root.span)
  const sections = fields(root, ['variables', 'nodes', 'edges', 'tools', 'identity'])
  const variables: AgentVariable[] = []
  const variableByRef = new Map<string, AgentVariable | TaskLocalVariable>()
  for (const variable of context.inventory.systemVariables ?? []) variableByRef.set(`sys.${variable.key}`, variable)
  const resource = (name: string, category: 'knowledge' | 'tool', span: DslSpan): UUID => {
    if (!context.inventory.ready && category === 'knowledge') { needsContext = true; report('ODSL504', span, 'info'); return unresolvedId }
    const inventory = category === 'knowledge' ? context.inventory.knowledge : context.baseline.document.reusableTools
    const matches = inventory.filter((entry) => normalizeDslName(entry.name) === normalizeDslName(name))
    uniqueName(name, span)
    if (matches.length !== 1) report(matches.length ? 'ODSL502' : 'ODSL501', span)
    return matches[0]?.id ?? unresolvedId
  }
  const knowledgeBinding = (token: DslToken): KnowledgeSpaceReference => {
    if (!modern) report('ODSL601', token)
    if (token.value !== 'sys.target_knowledge_space') report('ODSL206', token)
    return { kind: 'system_knowledge_space', key: 'target_knowledge_space' }
  }
  const resolveVariable = (ref: string, span: DslSpan, write = false): UUID => {
    if (ref.startsWith('sys.') && write) { report('ODSL302', span); return unresolvedId }
    if (ref.startsWith('sys.') && !context.inventory.systemVariables) { needsContext = true; report('ODSL504', span, 'info'); return unresolvedId }
    const variable = variableByRef.get(ref)
    if (!variable) { report(ref.startsWith('task.') ? 'ODSL203' : 'ODSL202', span); return unresolvedId }
    if (write && 'ownership' in variable && (variable.readOnly || variable.ownership === 'agent_managed')) report('ODSL302', span)
    return variable.id
  }
  // Transient unknown emission values cross a single Zod boundary below; never persist an unchecked config.
  const read = (tokens: readonly DslToken[], mode: 'source' | 'literal' | 'config' | 'reference' = 'literal', write = false): unknown => {
    let at = 0
    const parseValue = (currentMode: typeof mode, depth = 0): unknown => {
      if (depth > 64) { report('ODSL604', tokens[at] ?? fallback); at = tokens.length; return null }
      const token = tokens[at++]
      if (!token) { report('ODSL101', tokens.at(-1) ?? fallback); return null }
      const expect = (symbol: string) => { if (tokens[at]?.text === symbol) at++; else report('ODSL101', tokens[at] ?? token) }
      if (token.kind === 'binding') {
        if (!modern) report('ODSL601', token)
        if (currentMode === 'literal') report('ODSL309', token)
        if (token.value.startsWith('sys.')) {
          if (write || currentMode === 'reference') { report('ODSL302', token); return unresolvedId }
          const key = systemValueKeySchema.safeParse(token.value.slice(4))
          if (!key.success) { report('ODSL206', token); return null }
          return { kind: 'system', key: key.data }
        }
        const variableId = resolveVariable(token.value, token, write)
        return currentMode === 'reference' ? variableId : { kind: 'variable', variableId }
      }
      if (token.text === 'literal' && tokens[at]?.text === '(') {
        at++; const value = parseValue('literal', depth + 1); expect(')'); return { kind: 'literal', value }
      }
      if (token.kind === 'word' && tokens[at]?.text === '.') {
        if (modern) report('ODSL008', token)
        at++; const key = tokens[at++]
        const reference = `${token.value}.${key?.value ?? ''}`
        if (currentMode === 'literal') report('ODSL309', token)
        const variableId = resolveVariable(reference, { start: token.start, end: key?.end ?? token.end }, write)
        return currentMode === 'reference' ? variableId : { kind: 'variable', variableId }
      }
      let literal: unknown
      if (token.text === '[') {
        const entries: unknown[] = []
        while (at < tokens.length && tokens[at]?.text !== ']') {
          const previous = at; entries.push(parseValue(currentMode === 'config' ? 'config' : 'literal', depth + 1))
          if (tokens[at]?.text !== ',') break
          at++; if (at === previous) break
        }
        expect(']'); literal = entries
      } else if (token.text === '{') {
        const object: Record<string, unknown> = {}
        while (at < tokens.length && tokens[at]?.text !== '}') {
          const key = tokens[at++]
          if (!key) break
          expect(':')
          if (Object.hasOwn(object, key.value)) report('ODSL103', key)
          const nestedMode = currentMode === 'config'
            ? valueFields.has(key.value) ? 'source' : ['variableId', 'targetVariable'].includes(key.value) ? 'reference' : 'config'
            : 'literal'
          Object.defineProperty(object, key.value, { value: parseValue(nestedMode, depth + 1), enumerable: true, configurable: true })
          if (tokens[at]?.text !== ',') break
          at++
        }
        expect('}'); literal = object
      } else if (token.kind === 'string') literal = token.value.replaceAll('\uE000', '$')
      else if (token.kind === 'number') literal = Number(token.value)
      else if (token.text === 'true' || token.text === 'false') literal = token.text === 'true'
      else if (token.text === 'null') literal = null
      else if (currentMode === 'config' && token.kind === 'word') literal = token.value
      else { report('ODSL303', token); literal = null }
      if (currentMode !== 'source') return literal
      if (token.kind !== 'string') return { kind: 'literal', value: literal }
      const segments: Array<{ kind: 'text'; text: string } | { kind: 'variable'; variableId: UUID } | { kind: 'system'; key: 'change_event' | 'document_id' | 'document_revision' }> = []
      const expression = /\$\{([^}]*)\}/g
      let end = 0
      for (const match of token.value.matchAll(expression)) {
        const start = match.index
        if (start > end) segments.push({ kind: 'text', text: token.value.slice(end, start).replaceAll('\uE000', '$') })
        const reference = match[1] ?? ''
        if (!/^(agent|task|sys)\.[A-Za-z_][A-Za-z0-9_]*$/.test(reference)) report('ODSL006', token)
        if (modern && reference.startsWith('sys.')) {
          const key = systemValueKeySchema.safeParse(reference.slice(4))
          if (key.success) segments.push({ kind: 'system', key: key.data }); else report('ODSL206', token)
        } else segments.push({ kind: 'variable', variableId: resolveVariable(reference, token) })
        end = start + match[0].length
      }
      if (token.value.slice(end).includes('${')) report('ODSL006', token)
      if (!segments.length) return { kind: 'literal', value: literal }
      if (end < token.value.length) segments.push({ kind: 'text', text: token.value.slice(end).replaceAll('\uE000', '$') })
      return { kind: 'template', segments }
    }
    const value = parseValue(mode)
    if (at < tokens.length) report('ODSL106', tokens[at] ?? fallback)
    return value
  }
  const stringField = (item: DslSyntax | undefined, fallbackValue: string): string => {
    if (!item) return fallbackValue
    if (item.head.length !== 2 || item.head[1]?.kind !== 'string') report('ODSL303', item.span)
    return text(item, 1)
  }
  const parseVariables = (block: DslSyntax | undefined, path: string, local: boolean, identity?: DslSyntax) => {
    const output: Array<AgentVariable | TaskLocalVariable> = []
    const overrides = new Map<string, string>()
    for (const entry of identity ? children(identity) : []) {
      if (text(entry) !== 'variable_key' || entry.head.length !== 3 || entry.head[2]?.kind !== 'string' || overrides.has(text(entry, 1))) report('ODSL205', entry.span)
      overrides.set(text(entry, 1), text(entry, 2))
    }
    const seenAliases = new Set<string>()
    for (const item of block ? children(block) : []) {
      const aliasToken = item.head[local ? 1 : 2]
      const key = aliasToken?.value ?? ''
      if (seenAliases.has(key)) report('ODSL201', item.span)
      seenAliases.add(key)
      const canonicalKey = overrides.get(key) ?? key
      if (aliasToken?.kind !== 'word' || reserved.has(key)) report('ODSL105', aliasToken ?? item.span)
      if (!types.has(text(item))) report('ODSL303', item.span)
      if (output.some((variable) => variable.key === canonicalKey)) report('ODSL201', item.span)
      const metadata = fields(item, local ? [] : ['display_name', 'description', 'read_only'])
      const valueIndex = local ? 2 : 3
      const defaultValue = item.head[valueIndex]?.text === '=' ? read(item.head.slice(valueIndex + 1)) : null
      if (item.head.length > valueIndex && item.head[valueIndex]?.text !== '=') report('ODSL102', item.span)
      if (defaultValue !== null && text(item) !== 'json' && typeof defaultValue !== text(item)) report('ODSL301', item.span)
      const base = { id: id(`${path}/variable/${key}`), key: canonicalKey, dataType: text(item), defaultValue }
      const candidate = local ? taskLocalVariableSchema.safeParse(base) : agentVariableSchema.safeParse({ ...base, ownership: text(item, 1), displayName: stringField(metadata.get('display_name'), key), description: metadata.has('description') ? stringField(metadata.get('description'), '') : null, readOnly: metadata.has('read_only') ? read(metadata.get('read_only')?.head.slice(1) ?? []) : false })
      if (!candidate.success) report('ODSL303', item.span)
      else { output.push(candidate.data); variableByRef.set(`${local ? 'task' : 'agent'}.${key}`, candidate.data) }
    }
    for (const key of overrides.keys()) if (!seenAliases.has(key)) report('ODSL205', identity?.span ?? root.span)
    return output
  }
  for (const variable of parseVariables(sections.get('variables'), 'root', false, sections.get('identity'))) if ('ownership' in variable) variables.push(variable)
  const config = (owner: DslSyntax, path: string) => {
    const result: Record<string, unknown> = {}
    for (const field of children(owner)) {
      const key = text(field)
      if (Object.hasOwn(result, key)) report('ODSL103', field.span)
      if (field.kind !== 'statement' || field.head[1]?.text !== '=') { report('ODSL102', field.span); continue }
      const tokens = field.head.slice(2)
      const value = key === 'knowledgeSpaceId' ? tokens[0]?.kind === 'binding' && tokens.length === 1 ? knowledgeBinding(tokens[0]) : resource(String(read(tokens)), 'knowledge', field.span)
        : read(tokens, valueFields.has(key) ? 'source' : key === 'targetVariableId' ? 'reference' : 'config', key === 'targetVariableId')
      Object.defineProperty(result, key, { value, enumerable: true, configurable: true })
    }
    const addEntryIds = (entries: unknown, key: string) => {
      if (Array.isArray(entries)) entries.forEach((entry: unknown, index) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) Object.assign(entry, { id: id(`${path}/${key}/${index}`) })
      })
    }
    addEntryIds(result.headers, 'header')
    if (result.body && typeof result.body === 'object' && 'entries' in result.body) addEntryIds(result.body.entries, 'form')
    return result
  }
  const reusableTools: AgentReusableTool[] = structuredClone(context.baseline.document.reusableTools)
  const sourceList = (tokens: readonly DslToken[]) => {
    if (tokens[0]?.text !== '[' || tokens.at(-1)?.text !== ']') { report('ODSL102', tokens[0] ?? root.span); return [] }
    const parts: unknown[] = []
    let depth = 0
    let start = 1
    for (let index = 1; index < tokens.length; index++) {
      const token = tokens[index]
      if (!token) break
      if (depth === 0 && (token.text === ',' || index === tokens.length - 1)) {
        if (index > start) parts.push(read(tokens.slice(start, index), 'source'))
        start = index + 1
      } else if (['{', '[', '('].includes(token.text)) depth++
      else if (['}', ']', ')'].includes(token.text)) depth--
    }
    return parts
  }
  const toolAliases = new Map<string, UUID>()
  const toolDeclarations = sections.has('tools') ? children(sections.get('tools') as DslSyntax) : []
  const claimedToolIds = new Set(toolDeclarations.flatMap(item => {
    const existing = identitySymbols.get(`root/tool/${text(item, 1)}`)
    return existing ? [existing] : []
  }))
  for (const item of toolDeclarations) {
    const key = alias(item)
    if (text(item) !== 'reusable_tool' || text(item, 2) !== 'using' || text(item, 3) !== 'system_tool' || item.head.length !== 5) report('ODSL102', item.span)
    const path = `root/tool/${key}`
    const map = fields(item, ['name', 'config', 'input_bindings', 'output_binding'])
    const configBlock = requireField(map, 'config', item)
    const bindings = map.get('input_bindings')
    const output = map.get('output_binding')
    const outputValue = output && text(output, 1) !== 'none' ? read(output.head.slice(1), 'config', true) : null
    const outputBinding = outputValue && typeof outputValue === 'object' && 'sourceKey' in outputValue && 'targetVariable' in outputValue
      ? { sourceKey: outputValue.sourceKey, targetVariableId: outputValue.targetVariable } : null
    // A pasted case may use different local aliases from the current printer.
    // Reconcile by the unique business name only when no declaration already
    // claims that tool's identity. Duplicate declarations still fail validation.
    if (!identitySymbols.has(path)) {
      const name = normalizeDslName(stringField(map.get('name'), key))
      const matches = context.baseline.document.reusableTools.filter(tool => normalizeDslName(tool.name) === name && tool.kind === text(item, 4))
      const match = matches.length === 1 ? matches[0] : undefined
      if (match && !claimedToolIds.has(match.id)) {
        identitySymbols.set(path, match.id)
        claimedToolIds.add(match.id)
        for (const [oldPath, oldId] of context.baseline.symbols) {
          if (oldId !== match.id || !oldPath.startsWith('root/tool/')) continue
          for (const [childPath, childId] of context.baseline.symbols) {
            if (childPath.startsWith(`${oldPath}/`)) identitySymbols.set(`${path}${childPath.slice(oldPath.length)}`, childId)
          }
        }
      }
    }
    const toolId = id(path)
    const previous = context.baseline.document.reusableTools.find((tool) => tool.id === toolId)
    const candidate = agentReusableToolSchema.safeParse({ id: toolId, name: previous && stringField(map.get('name'), key) === previous.name ? previous.name : normalizeDslName(stringField(map.get('name'), key)), kind: text(item, 4), sourceTemplateId: previous?.sourceTemplateId ?? null, configuration: configBlock ? config(configBlock, path) : {}, inputBindings: bindings ? sourceList(bindings.head.slice(1)) : [], outputBinding })
    if (!candidate.success) report('ODSL303', item.span)
    else {
      if (toolAliases.has(key)) report('ODSL201', item.span)
      toolAliases.set(key, candidate.data.id)
      const existing = reusableTools.findIndex((tool) => tool.id === candidate.data.id)
      if (existing >= 0) reusableTools.splice(existing, 1)
      reusableTools.push(candidate.data)
    }
  }
  const toolNames = new Set<string>()
  for (const tool of reusableTools) {
    const key = normalizeDslName(tool.name)
    if (!key || toolNames.has(key)) report(key ? 'ODSL503' : 'ODSL508', root.span)
    toolNames.add(key)
  }
  const parseGraph = (owner: DslSyntax, path: string, body: boolean): { nodes: Array<WorkflowNode | LoopBodyNode>; edges: WorkflowEdge[]; layout: CanvasLayout } => {
    const map = fields(owner, body ? ['max_turns', 'exit_when', 'nodes', 'edges'] : ['variables', 'nodes', 'edges', 'tools', 'identity'])
    const nodeBlock = requireField(map, 'nodes', owner)
    const edgeBlock = requireField(map, 'edges', owner)
    const nodeSymbols = new Map<string, UUID>()
    const handles = new Map<string, UUID>()
    const nodes: Array<WorkflowNode | LoopBodyNode> = []
    const entries = nodeBlock ? children(nodeBlock) : []
    const startKey = body ? 'loop_start' : 'start'
    const endKey = body ? 'loop_end' : 'end'
    const oldRoot = context.baseline.document.workflow.nodes
    const oldEnds = oldRoot.filter((node): node is EndNode => node.type === 'end')
    const namedEnds = !body && oldEnds.length !== 1
    const startId = id(`${path}/node/${startKey}`)
    nodes.push({ id: startId, name: body ? 'Loop Start' : 'Start', type: body ? 'loop_start' : 'start', config: {} })
    nodeSymbols.set(startKey, startId)
    if (body || !namedEnds) {
      if (!body && oldEnds.length !== 1) report('ODSL408', owner.span)
      const endId = body ? id(`${path}/node/${endKey}`) : oldEnds[0]?.id ?? id(`${path}/node/end`)
      symbols.set(`${path}/node/${endKey}`, endId)
      nodes.push(body ? { id: endId, name: 'Loop End', type: 'loop_end', config: {} } : { id: endId, name: oldEnds[0]?.name ?? 'End', type: 'end', config: structuredClone(oldEnds[0]?.config ?? {}) })
      nodeSymbols.set(endKey, endId)
    }
    const boundarySymbols = new Map(nodeSymbols)
    const isBoundary = (item: DslSyntax) => text(item) === startKey || (text(item) === endKey && (body || !namedEnds))
    const declarationPath = (item: DslSyntax) => isBoundary(item) ? `${path}/node/${text(item)}` : nodeSymbolPath(path, text(item, 1))
    const declaredPaths = new Set(entries.map(declarationPath))
    // Match only unique unchanged declarations. Ambiguous replacements retain the review gate.
    for (const item of entries) {
      const nextPath = declarationPath(item)
      if (isBoundary(item) || identitySymbols.has(nextPath) || item.head[1]?.kind !== 'string') continue
      const signature = nodeSignature(item)
      const candidates = [...(context.baseline.nodeSignatures ?? [])].filter(([oldPath, value]) => oldPath.startsWith(`${path}/node/name/`) && !oldPath.slice(`${path}/node/name/`.length).includes('/') && !declaredPaths.has(oldPath) && value === signature && identitySymbols.has(oldPath))
      const competing = entries.filter((entry) => !identitySymbols.has(declarationPath(entry)) && nodeSignature(entry) === signature)
      if (candidates.length !== 1 || competing.length !== 1) continue
      const oldPath = candidates[0]?.[0]
      if (!oldPath) continue
      for (const [key, value] of [...identitySymbols]) {
        if (key === oldPath || key.startsWith(`${oldPath}/`)) identitySymbols.set(`${nextPath}${key.slice(oldPath.length)}`, value)
      }
    }
    const declaredNames = new Set<string>()
    const declaredBoundaries = new Set<string>()
    for (const item of entries) {
      const kind = text(item)
      const boundary = isBoundary(item)
      const shorthand = boundary && item.kind === 'statement' && item.head.length === 1
      if (!shorthand && (item.kind !== 'block' || (boundary ? item.head.length > 2 : item.head.length !== 2) || (item.head[1] && item.head[1].kind !== 'string'))) report('ODSL102', item.head[1] ?? item.span)
      const key = normalizeDslName(text(item, 1))
      if (!boundary || item.head[1]) {
        uniqueName(key, item.head[1] ?? item.span)
        if (declaredNames.has(key)) report('ODSL201', item.head[1] ?? item.span)
        declaredNames.add(key)
      }
      if (boundary) {
        if (declaredBoundaries.has(kind)) report('ODSL103', item.span)
        declaredBoundaries.add(kind)
        const options = fields(item, kind === 'end' ? ['exit'] : [])
        const node = nodes.find((node) => node.id === boundarySymbols.get(kind))
        if (node && shorthand) node.name = kind === 'start' ? 'Start' : kind === 'end' ? 'End' : kind === 'loop_start' ? 'Loop Start' : 'Loop End'
        if (node && item.head[1]?.kind === 'string') node.name = text(item, 1)
        const selectedExit = options.get('exit')
        if (selectedExit && node?.type === 'end' && normalizeDslName(stringField(selectedExit, '')) !== normalizeDslName(context.exitNames?.get(node.id) ?? oldEnds[0]?.name ?? '')) report('ODSL408', selectedExit.span)
        if (node) nodeSymbols.set(normalizeDslName(node.name), node.id)
        continue
      }
      nodeSymbols.set(key, id(declarationPath(item)))
    }
    for (const item of entries) {
      const kind = text(item)
      if (isBoundary(item)) continue
      const key = normalizeDslName(text(item, 1))
      const nodePath = declarationPath(item)
      const nodeId = nodeSymbols.get(key) ?? id(nodePath)
      locations.set(nodeId, item.span)
      const common = { id: nodeId, name: text(item, 1) }
      if (kind === 'end' && !body) {
        const options = fields(item, ['exit'])
        const exit = requireField(options, 'exit', item)
        const exitName = stringField(exit, '')
        // Existing Pattern-owned End names are the available boundary labels. No topology is created here.
        const matches = oldEnds.filter((node) => normalizeDslName(context.exitNames?.get(node.id) ?? node.name) === normalizeDslName(exitName))
        if (matches.length !== 1) report(matches.length ? 'ODSL502' : 'ODSL501', exit?.span ?? item.span)
        const old = matches[0]
        if (old) { nodes.push({ ...structuredClone(old), name: text(item, 1) }); nodeSymbols.set(key, old.id); symbols.set(nodePath, old.id) }
      } else if (kind === 'agent_action') {
        const options = fields(item, ['model', 'goal', 'knowledge', 'toolbox'])
        const model = requireField(options, 'model', item)
        const goal = requireField(options, 'goal', item)
        const list = (field: DslSyntax | undefined, category: 'knowledge' | 'tool') => {
          if (!field) return []
          const parts = field.head.slice(1)
          if (parts[0]?.text !== '[' || parts.at(-1)?.text !== ']') report('ODSL102', field.span)
          const ids = parts.filter((token) => !['[', ']', ','].includes(token.text)).map((token) => {
            if (category === 'tool' && token.kind === 'word') {
              const toolId = toolAliases.get(token.value)
              if (!toolId) report('ODSL202', token)
              return toolId ?? unresolvedId
            }
            if (category === 'knowledge' && token.kind === 'binding') return knowledgeBinding(token)
            if (token.kind !== 'string') report('ODSL303', token)
            return resource(token.value, category, token)
          })
          if (new Set(ids.map(knowledgeReferenceKey)).size !== ids.length) report('ODSL204', field.span)
          return ids
        }
        nodes.push({ ...common, type: 'agent_action', name: text(item, 1), config: { model: stringField(model, ''), goal: (goal ? read(goal.head.slice(1), 'source') : { kind: 'literal', value: '' }) as ValueSource, knowledgeSpaceIds: list(options.get('knowledge'), 'knowledge'), reusableToolIds: list(options.get('toolbox'), 'tool').filter((reference): reference is UUID => typeof reference === 'string') } })
      } else if (kind === 'task') {
        const options = fields(item, ['variables', 'steps', 'identity'])
        const locals = parseVariables(options.get('variables'), nodePath, true, options.get('identity')).filter((variable): variable is TaskLocalVariable => !('ownership' in variable))
        const stepsBlock = requireField(options, 'steps', item)
        const steps: ReturnType<typeof toolStepSchema.parse>[] = []
        for (const step of stepsBlock ? children(stepsBlock) : []) {
          const stepKey = alias(step)
          if (text(step) !== 'step' || text(step, 2) !== 'using' || text(step, 3) !== 'system_tool') report('ODSL102', step.span)
          const stepPath = `${nodePath}/step/${stepKey}`
          const settings = fields(step, ['config', 'output', 'on_failure'])
          const configBlock = requireField(settings, 'config', step)
          const output = settings.get('output')
          const failure = settings.get('on_failure')
          if (output && output.head[2]?.text !== '->') report('ODSL102', output.span)
          const stepConfiguration = configBlock ? config(configBlock, stepPath) : {}
          const stepId = id(stepPath)
          const findPreviousStep = (nodes: readonly (WorkflowNode | LoopBodyNode)[]): { label?: string | null } | undefined => {
            for (const node of nodes) {
              if (node.type === 'task') { const previous = node.config.steps.find((entry) => entry.id === stepId); if (previous) return previous }
              if (node.type === 'loop') { const previous = findPreviousStep(node.config.body.graph.nodes); if (previous) return previous }
            }
          }
          const previousStep = findPreviousStep(context.baseline.document.workflow.nodes)
          const parsedStep = toolStepSchema.safeParse({ id: stepId, ...(previousStep && 'label' in previousStep ? { label: previousStep.label } : {}), kind: text(step, 4), configuration: stepConfiguration, outputMapping: output ? { sourceKey: text(output, 1), targetVariableId: read(output.head.slice(3), 'reference', true) } : null, failureBehavior: failure && text(failure, 1) === 'retry' ? { kind: 'retry', maxAttempts: Number(text(failure, 2)) } : { kind: 'fail_task' } })
          if (failure && !(failure.head.length === 2 && text(failure, 1) === 'fail_task') && !(failure.head.length === 3 && text(failure, 1) === 'retry' && text(failure, 2) === '2')) report('ODSL305', failure.span)
          if (!parsedStep.success) {
            for (const issue of parsedStep.error.issues) {
              const field = configBlock ? children(configBlock).find((entry) => text(entry) === issue.path[1]) : undefined
              const outputError = issue.path[0] === 'outputMapping'
              const code = outputError ? 'ODSL304' : issue.path[0] === 'failureBehavior' ? 'ODSL305' : issue.code === 'custom' && (issue.path.includes('headers') || issue.path.includes('inputs')) ? 'ODSL308' : issue.code === 'invalid_type' && !field ? 'ODSL104' : 'ODSL303'
              report(code, outputError ? output?.span ?? step.span : field?.span ?? configBlock?.span ?? step.span)
            }
          }
          else {
            if (parsedStep.data.kind === 'set_variable') {
              const setting = parsedStep.data.configuration
              const target = [...variableByRef.values()].find((variable) => variable.id === setting.targetVariableId)
              if ((setting.operation === 'increment' && target?.dataType !== 'number') || (setting.operation === 'toggle' && target?.dataType !== 'boolean') || (setting.operation === 'append' && !['string', 'json'].includes(target?.dataType ?? ''))) report('ODSL307', step.span)
              if ('value' in setting && setting.operation === 'assign' && target) {
                const assigned = setting.value
                const assignedType = assigned.kind === 'literal' ? assigned.value === null ? null : typeof assigned.value : assigned.kind === 'template' ? 'string' : assigned.kind === 'system' ? systemValueType(assigned.key) : [...variableByRef.values()].find((variable) => variable.id === assigned.variableId)?.dataType
                if (assignedType && target.dataType !== 'json' && assignedType !== 'json' && assignedType !== target.dataType) report('ODSL301', step.span)
              }
            }
            if (steps.some((entry) => entry.id === parsedStep.data.id)) report('ODSL201', step.span)
            steps.push(parsedStep.data)
          }
        }
        nodes.push({ ...common, type: 'task', name: text(item, 1), config: { localVariables: locals, steps } })
        for (const ref of variableByRef.keys()) if (ref.startsWith('task.')) variableByRef.delete(ref)
      } else if (kind === 'branch') {
        const cases: Array<{ id: UUID; label: string; match: 'all'; conditions: Array<{ id: UUID; left: ValueSource; operator: 'is_empty' | 'is_not_empty' } | { id: UUID; left: ValueSource; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains'; right: ValueSource }> }> = []
        let defaultCase = { id: id(`${nodePath}/case/default`), label: 'Default' }
        let defaultCount = 0
        for (const branchItem of children(item)) {
          if (text(branchItem) === 'default') { defaultCount++; defaultCase = { ...defaultCase, label: text(branchItem, 1) || 'Default' }; handles.set(`${key}.default`, defaultCase.id); continue }
          if (text(branchItem) !== 'case') { report('ODSL102', branchItem.span); continue }
          if (branchItem.kind !== 'block' || branchItem.head.length !== 2 || branchItem.head[1]?.kind !== 'string') report('ODSL102', branchItem.head[1] ?? branchItem.span)
          const caseKey = normalizeDslName(text(branchItem, 1))
          uniqueName(caseKey, branchItem.head[1] ?? branchItem.span)
          const casePath = caseSymbolPath(nodePath, caseKey)
          if (!identitySymbols.has(casePath)) {
            const declared = new Set(children(item).filter((entry) => text(entry) === 'case').map((entry) => caseSymbolPath(nodePath, text(entry, 1))))
            const candidates = [...(context.baseline.nodeSignatures ?? [])].filter(([oldPath, signature]) => oldPath.startsWith(`${nodePath}/case/name/`) && !declared.has(oldPath) && signature === nodeSignature(branchItem) && identitySymbols.has(oldPath))
            const competing = children(item).filter((entry) => text(entry) === 'case' && !identitySymbols.has(caseSymbolPath(nodePath, text(entry, 1))) && nodeSignature(entry) === nodeSignature(branchItem))
            if (candidates.length === 1 && competing.length === 1) {
              const oldPath = candidates[0]?.[0]
              if (oldPath) for (const [key, value] of [...identitySymbols]) if (key === oldPath || key.startsWith(`${oldPath}/`)) identitySymbols.set(`${casePath}${key.slice(oldPath.length)}`, value)
            }
          }
          const caseId = id(casePath)
          if (handles.has(`${key}.${JSON.stringify(caseKey)}`) || defaultCount) report('ODSL201', branchItem.head[1] ?? branchItem.span)
          handles.set(`${key}.${JSON.stringify(caseKey)}`, caseId)
          const conditions: typeof cases[number]['conditions'] = []
          children(branchItem).forEach((condition, index) => {
            if (text(condition) !== 'when') report('ODSL102', condition.span)
            const operatorIndex = condition.head.findIndex((token) => operators.has(token.text))
            const operator = operators.get(condition.head[operatorIndex]?.text ?? '')
            const left = read(condition.head.slice(1, operatorIndex), 'source') as ValueSource
            const conditionId = id(`${casePath}/condition/${index}`)
            if (operator === 'is_empty' || operator === 'is_not_empty') conditions.push({ id: conditionId, left, operator })
            else if (operator) conditions.push({ id: conditionId, left, operator: operator as 'eq', right: read(condition.head.slice(operatorIndex + 1), 'source') as ValueSource })
            else report('ODSL106', condition.span)
          })
          if (!conditions.length) report('ODSL104', branchItem.span)
          cases.push({ id: caseId, label: text(branchItem, 1), match: 'all', conditions })
        }
        if (defaultCount !== 1) report(defaultCount ? 'ODSL103' : 'ODSL104', item.span)
        nodes.push({ ...common, type: 'branch', config: { cases, defaultCase } })
      } else if (kind === 'loop' && !body) {
        const options = fields(item, ['max_turns', 'exit_when', 'nodes', 'edges'])
        const turns = requireField(options, 'max_turns', item)
        const exit = requireField(options, 'exit_when', item)
        const exitTokens = exit?.head.slice(1) ?? []
        const operatorIndex = exitTokens.findIndex((token) => operators.has(token.text))
        const operator = operators.get(exitTokens[operatorIndex]?.text ?? '')
        const graph = parseGraph(item, nodePath, true)
        const { schemaVersion: _bodyVersion, ...bodyLayout } = graph.layout
        void _bodyVersion
        nodes.push({ ...common, type: 'loop', name: text(item, 1), config: { maxTurns: Number(turns?.head[1]?.value), exitCondition: { kind: 'variable_comparison', variableId: read(exitTokens.slice(0, operatorIndex), 'reference') as UUID, operator: (operator ?? 'eq') as 'eq', value: read(exitTokens.slice(operatorIndex + 1)) as JsonValue }, body: { graph: { nodes: graph.nodes.filter((node): node is LoopBodyNode => node.type !== 'start' && node.type !== 'end' && node.type !== 'loop'), edges: graph.edges }, layout: bodyLayout } } })
        if (!operator || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(operator) || !Number.isInteger(Number(turns?.head[1]?.value)) || Number(turns?.head[1]?.value) <= 0) report('ODSL406', item.span)
      } else report('ODSL405', item.span)
    }
    if (!body) {
      const actualEnds = nodes.filter((node) => node.type === 'end')
      if (actualEnds.length !== oldEnds.length || oldEnds.some((end) => !actualEnds.some((node) => node.id === end.id))) report('ODSL408', owner.span)
    }
    const names = new Set<string>()
    for (const node of nodes) {
      const name = normalizeDslName(node.name)
      if (names.has(name)) report('ODSL201', locations.get(node.id) ?? owner.span)
      names.add(name)
    }
    const edges: WorkflowEdge[] = []
    for (const edge of edgeBlock ? children(edgeBlock) : []) {
      const arrow = edge.head.findIndex((token) => token.text === '->')
      if (edge.head.filter((token) => token.text === '->').length !== 1 || arrow < 1 || edge.head.length !== arrow + 2) { report('ODSL106', edge.span); continue }
      const validEndpoint = (token: DslToken | undefined) => token?.kind === 'string' || (token?.kind === 'word' && [startKey, ...(!namedEnds ? [endKey] : [])].includes(token.value))
      if (!validEndpoint(edge.head[0]) || !validEndpoint(edge.head[arrow + 1])) report('ODSL102', edge.span)
      const from = normalizeDslName(text(edge))
      const to = normalizeDslName(text(edge, arrow + 1))
      const resolveEndpoint = (name: string, token: DslToken | undefined) => token?.kind === 'string' ? nodes.find((node) => normalizeDslName(node.name) === name)?.id : boundarySymbols.get(name)
      const sourceNodeId = resolveEndpoint(from, edge.head[0])
      const targetNodeId = resolveEndpoint(to, edge.head[arrow + 1])
      if (!sourceNodeId || !targetNodeId) { report('ODSL202', edge.span); continue }
      if (arrow === 3 && !(edge.head[2]?.kind === 'string' || (edge.head[2]?.kind === 'word' && text(edge, 2) === 'default'))) report('ODSL102', edge.head[2] ?? edge.span)
      const sourceHandleId = arrow === 3 && text(edge, 1) === '.' ? handles.get(`${from}.${edge.head[2]?.kind === 'string' ? JSON.stringify(normalizeDslName(text(edge, 2))) : text(edge, 2)}`) : undefined
      const sourceNode = nodes.find((node) => node.id === sourceNodeId)
      if ((sourceNode?.type === 'branch' && !sourceHandleId) || (sourceNode?.type !== 'branch' && arrow !== 1)) report('ODSL402', edge.span)
      const edgePath = `${path}/edge/${from}.${arrow === 1 ? to : edge.head[2]?.kind === 'string' ? JSON.stringify(normalizeDslName(text(edge, 2))) : text(edge, 2)}->${to}`
      const previousEdges = context.baseline.document.workflow.edges.concat(context.baseline.document.workflow.nodes.flatMap((node) => node.type === 'loop' ? node.config.body.graph.edges : []))
      const previousEdge = previousEdges.find((entry) => entry.sourceNodeId === sourceNodeId && entry.targetNodeId === targetNodeId && entry.sourceHandleId === sourceHandleId)
      if (previousEdge) identitySymbols.set(edgePath, previousEdge.id)
      const edgeId = id(edgePath)
      locations.set(edgeId, edge.span)
      edges.push({ id: edgeId, sourceNodeId, targetNodeId, ...(sourceHandleId ? { sourceHandleId } : {}) })
    }
    // Presentation belongs to Canvas. Reuse the latest baseline, including Loop bodies.
    const baselineLoopId = identitySymbols.get(path)
    const baselineLoop = context.baseline.document.workflow.nodes.find((node) => node.id === baselineLoopId && node.type === 'loop')
    const previousGraph = body ? baselineLoop?.type === 'loop' ? baselineLoop.config.body.graph : undefined : context.baseline.document.workflow
    const previousLayout = body ? baselineLoop?.type === 'loop' ? baselineLoop.config.body.layout : undefined : context.baseline.document.layout
    const existingIds = new Set(previousGraph?.nodes.map((node) => node.id) ?? [])
    const currentIds = new Set(nodes.map((node) => node.id))
    const placements = (previousLayout?.nodePlacements ?? []).filter((placement) => currentIds.has(placement.nodeId)).map((placement) => ({ ...placement }))
    let nextX = placements.length ? Math.max(...placements.map((placement) => placement.x + (placement.width ?? 0))) + 360 : 0
    for (const node of nodes) {
      if (existingIds.has(node.id)) continue
      const bodyIndex = placements.length
      const bodyFloor = previousLayout?.nodePlacements.length
        ? Math.max(...previousLayout.nodePlacements.map((placement) => placement.y)) + 160
        : 100
      const point = body
        ? { x: 40 + (bodyIndex % 2) * 320, y: bodyFloor + Math.floor(bodyIndex / 2) * 160 }
        : { x: nextX, y: 0 }
      const bodyHeight = node.type === 'loop'
        ? Math.max(480, ...node.config.body.layout.nodePlacements.map((placement) => placement.y + 140))
        : 480
      placements.push({ nodeId: node.id, ...point, ...(node.type === 'loop' ? { width: 720, height: Math.min(1200, bodyHeight) } : {}) })
      nextX += node.type === 'loop' ? 1080 : 360
    }
    const layout: CanvasLayout = { schemaVersion: '1.0.0', nodePlacements: placements, viewport: { ...(previousLayout?.viewport ?? { x: 0, y: 0, zoom: 1 }) } }
    const declarationOrder = new Map(entries.map((item, index) => [isBoundary(item) ? boundarySymbols.get(text(item)) : nodeSymbols.get(normalizeDslName(text(item, 1))), index]))
    nodes.sort((a, b) => (declarationOrder.get(a.id) ?? (a.type === 'start' || a.type === 'loop_start' ? -1 : nodes.length)) - (declarationOrder.get(b.id) ?? (b.type === 'start' || b.type === 'loop_start' ? -1 : nodes.length)))
    return { nodes, edges, layout }
  }
  const graph = parseGraph(root, 'root', false)
  const payload = agentWorkflowExportDocumentSchema.safeParse({ workflow: { schemaVersion: modern ? '1.2.0' : context.baseline.document.workflow.schemaVersion, nodes: graph.nodes, edges: graph.edges }, layout: graph.layout, variables, reusableTools })
  if (payload.success) {
    if (!context.allowIdentityReplacement) {
      const ownedIds = (value: unknown, output = new Set<string>()): Set<string> => {
        if (!value || typeof value !== 'object') return output
        if ('id' in value && typeof value.id === 'string') output.add(value.id)
        Object.values(value).forEach((child) => ownedIds(child, output))
        return output
      }
      const beforeIds = ownedIds({ workflow: context.baseline.document.workflow, variables: context.baseline.document.variables, reusableTools: context.baseline.document.reusableTools })
      const afterIds = ownedIds(payload.data)
      if ([...beforeIds].some((key) => !afterIds.has(key)) && [...afterIds].some((key) => !beforeIds.has(key))) {
        needsContext = true
        report('ODSL507', root.span, 'info')
      }
    }
    const allVariables = new Map(variables.map((entry) => [entry.id, entry.dataType]))
    const sourceType = (value: ValueSource): string | null | undefined => value.kind === 'system' ? systemValueType(value.key) : value.kind === 'template' ? 'string' : value.kind === 'variable' ? allVariables.get(value.variableId) : value.value === null ? null : typeof value.value === 'object' ? 'json' : typeof value.value
    const stringSource = (value: ValueSource) => {
      const type = sourceType(value)
      if (type && type !== 'string' && type !== 'json') report('ODSL301', root.span)
    }
    const inspectNodes = (nodes: readonly (WorkflowNode | LoopBodyNode)[]) => {
      for (const node of nodes) {
        if (node.type === 'agent_action') stringSource(node.config.goal)
        if (node.type === 'task') {
          node.config.localVariables.forEach((entry) => allVariables.set(entry.id, entry.dataType))
          for (const step of node.config.steps) {
            if (step.kind === 'knowledge_retrieval') stringSource(step.configuration.query)
            if (step.kind === 'api_request') stringSource(step.configuration.url)
            if (step.kind === 'llm_call') { stringSource(step.configuration.prompt); if (step.configuration.systemPrompt) stringSource(step.configuration.systemPrompt) }
          }
        }
        if (node.type === 'branch') for (const entry of node.config.cases) for (const condition of entry.conditions) {
          const left = sourceType(condition.left)
          const right = 'right' in condition ? sourceType(condition.right) : undefined
          if ((['gt', 'gte', 'lt', 'lte'].includes(condition.operator) && (left !== 'number' || right !== 'number'))
            || (['eq', 'neq'].includes(condition.operator) && left && right && left !== 'json' && right !== 'json' && left !== right)
            || (['contains', 'not_contains', 'is_empty', 'is_not_empty'].includes(condition.operator) && left && !['string', 'json'].includes(left))) report('ODSL306', root.span)
        }
        if (node.type === 'loop') inspectNodes(node.config.body.graph.nodes)
      }
    }
    inspectNodes(payload.data.workflow.nodes)
    const aggregate = createAgentWorkflowEditorDocumentSchema({ systemVariableIds: context.inventory.systemVariables?.map((variable) => variable.id) }).safeParse({ agent: context.baseline.document.agent, ...payload.data })
    if (!aggregate.success && !needsContext && !diagnostics.some((entry) => entry.severity === 'error')) report('ODSL506', root.span)
    const validation = validateWorkflowGraph(payload.data.workflow)
    for (const issue of validation.structuralErrors) {
      const code = issue.code === 'SELF_EDGE' || issue.code === 'DUPLICATE_EDGE' ? 'ODSL401' : issue.code === 'CYCLE_DETECTED' ? 'ODSL404' : issue.code === 'START_HAS_INCOMING' || issue.code === 'END_HAS_OUTGOING' ? 'ODSL403' : issue.code.includes('BRANCH') || issue.code === 'INVALID_SOURCE_HANDLE' ? 'ODSL402' : 'ODSL407'
      report(code, (issue.edgeId ? locations.get(issue.edgeId) : issue.nodeId ? locations.get(issue.nodeId) : undefined) ?? sections.get('edges')?.span ?? root.span)
    }
    for (const issue of validation.readinessErrors) report(issue.code === 'BRANCH_ROUTE_INCOMPLETE' ? 'ODSL451' : issue.code === 'UNREACHABLE_FROM_START' ? 'ODSL452' : 'ODSL453', (issue.nodeId ? locations.get(issue.nodeId) : undefined) ?? root.span, 'warning')
  } else if (!diagnostics.some((entry) => entry.severity === 'error')) report('ODSL603', root.span)
  diagnostics.sort((a, b) => a.span.start - b.span.start || a.code.localeCompare(b.code))
  if (diagnostics.some((entry) => entry.severity === 'error') || !payload.success) return { status: 'invalid', diagnostics }
  if (needsContext) return { status: 'context-required', diagnostics }
  return { status: 'checked', document: payload.data, diagnostics, symbols }
}




