/** Library-independent concrete syntax with original UTF-16 source locations. */
export interface DslSpan { readonly start: number; readonly end: number }
export interface DslDiagnostic {
  readonly code: string
  readonly severity: 'error' | 'warning' | 'info'
  readonly messageKey: string
  readonly span: DslSpan
}
export interface DslToken extends DslSpan {
  readonly kind: 'word' | 'string' | 'number' | 'symbol' | 'binding'
  readonly text: string
  readonly value: string
}
export type DslSyntax =
  | { readonly kind: 'statement'; readonly head: readonly DslToken[]; readonly span: DslSpan }
  | { readonly kind: 'block'; readonly head: readonly DslToken[]; readonly children: readonly DslSyntax[]; readonly span: DslSpan }

export const normalizeDslName = (name: string): string => name.trim().normalize('NFC')
export const caseSymbolPath = (path: string, name: string): string => `${path}/case/name/${encodeURIComponent(JSON.stringify(normalizeDslName(name)))}`
export const nodeSymbolPath = (path: string, name: string): string => `${path}/node/name/${encodeURIComponent(JSON.stringify(normalizeDslName(name)))}`

/** Names are excluded so an otherwise unchanged declaration can retain its identity on rename. */
export function nodeSignature(item: DslSyntax): string {
  const content = (entry: DslSyntax): unknown => [entry.head.map((token) => [token.kind, token.value]), entry.kind === 'block' ? entry.children.map(content) : null]
  return JSON.stringify([item.head[0]?.value, item.kind === 'block' ? item.children.map(content) : null])
}

export function collectNodeSignatures(syntax: readonly DslSyntax[]): ReadonlyMap<string, string> {
  const result = new Map<string, string>()
  function visit(owner: DslSyntax, path: string) {
    if (owner.kind !== 'block') return
    const nodes = owner.children.find((item) => item.head[0]?.value === 'nodes')
    if (nodes?.kind !== 'block') return
    for (const node of nodes.children) {
      if (node.head[1]?.kind !== 'string') continue
      const key = nodeSymbolPath(path, node.head[1].value)
      result.set(key, nodeSignature(node))
      if (node.head[0]?.value === 'loop') visit(node, key)
      if (node.head[0]?.value === 'branch' && node.kind === 'block') {
        for (const entry of node.children) if (entry.head[0]?.value === 'case' && entry.head[1]?.kind === 'string') result.set(caseSymbolPath(key, entry.head[1].value), nodeSignature(entry))
      }
    }
  }
  if (syntax[0]) visit(syntax[0], 'root')
  return result
}
export const dslReservedWords = new Set(['workflow', 'variables', 'nodes', 'edges', 'tools', 'task', 'agent_action', 'branch', 'loop', 'end', 'start', 'loop_start', 'loop_end', 'default', 'agent', 'sys', 'config', 'steps', 'case', 'when', 'exit'])

export function sourcePosition(source: string, offset: number) {
  const before = source.slice(0, offset).split(/\r\n|\r|\n/)
  return { offset, line: before.length, column: (before.at(-1)?.length ?? 0) + 1 }
}

export function parseDsl(source: string): { readonly syntax: readonly DslSyntax[]; readonly diagnostics: readonly DslDiagnostic[] } {
  const diagnostics: DslDiagnostic[] = []
  const tokens: DslToken[] = []
  const report = (code: string, start: number, end = start) => {
    if (diagnostics.length < 200) diagnostics.push({ code, severity: 'error', messageKey: code, span: { start, end } })
  }
  if (source.length > 1_000_000) return { syntax: [], diagnostics: [{ code: 'ODSL604', severity: 'error', messageKey: 'ODSL604', span: { start: 0, end: 0 } }] }
  let offset = 0
  while (offset < source.length) {
    const start = offset
    const character = source[offset] ?? ''
    if (/\s|\uFEFF/.test(character)) { offset++; continue }
    if (source.startsWith('//', offset)) { while (offset < source.length && !/[\r\n]/.test(source[offset] ?? '')) offset++; continue }
    if (source.startsWith('/*', offset)) {
      const end = source.indexOf('*/', offset + 2)
      if (end < 0) { report('ODSL004', start, source.length); break }
      offset = end + 2; continue
    }
    if (character === '$') {
      const binding = /^\$(agent|task|sys)\.([A-Za-z_][A-Za-z0-9_]*)\$/.exec(source.slice(offset))
      if (binding) {
        offset += binding[0].length
        tokens.push({ kind: 'binding', text: binding[0], value: `${binding[1]}.${binding[2]}`, start, end: offset })
      } else {
        while (offset < source.length && !/[;\r\n{}]/.test(source[offset] ?? '')) offset++
        report('ODSL007', start, offset)
      }
      continue
    }
    if (character === '"') {
      const raw = source.startsWith('"""', offset)
      const quote = raw ? '"""' : '"'
      offset += quote.length
      let value = ''
      let closed = false
      while (offset < source.length) {
        if (source.startsWith(quote, offset)) { offset += quote.length; closed = true; break }
        const next = source[offset] ?? ''
        if (!raw && /[\r\n]/.test(next)) break
        if (!raw && next === '\\') {
          const escaped = source[offset + 1] ?? ''
          if (escaped === '$') { value += '\uE000'; offset += 2; continue }
          const escapeText = escaped === 'u' ? source.slice(offset, offset + 6) : source.slice(offset, offset + 2)
          try { value += JSON.parse(`"${escapeText}"`) as string } catch { report('ODSL003', offset, offset + escapeText.length) }
          offset += Math.max(1, escapeText.length); continue
        }
        if (!raw && next.charCodeAt(0) < 32) report('ODSL001', offset, offset + 1)
        value += next; offset++
      }
      if (!closed) report('ODSL002', start, offset)
      tokens.push({ kind: 'string', text: source.slice(start, offset), value, start, end: offset }); continue
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(offset))?.[0]
    if (word) { offset += word.length; tokens.push({ kind: 'word', text: word, value: word, start, end: offset }); continue }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(offset))?.[0]
    if (number) {
      offset += number.length
      if (!Number.isFinite(Number(number))) report('ODSL005', start, offset)
      tokens.push({ kind: 'number', text: number, value: number, start, end: offset }); continue
    }
    const symbol = ['->', '==', '!=', '>=', '<='].find((candidate) => source.startsWith(candidate, offset)) ?? character
    offset += symbol.length
    if (!['->', '==', '!=', '>=', '<=', '{', '}', '[', ']', '(', ')', ';', ',', ':', '.', '=', '>', '<'].includes(symbol)) report('ODSL001', start, offset)
    else tokens.push({ kind: 'symbol', text: symbol, value: symbol, start, end: offset })
  }
  let cursor = 0
  const parseItems = (depth: number): DslSyntax[] => {
    const items: DslSyntax[] = []
    if (depth > 64) { report('ODSL604', tokens[cursor]?.start ?? source.length); cursor = tokens.length; return items }
    while (cursor < tokens.length) {
      if (tokens[cursor]?.text === '}') {
        if (depth === 0) { report('ODSL102', tokens[cursor]?.start ?? 0); cursor++; continue }
        break
      }
      const head: DslToken[] = []
      const start = tokens[cursor]?.start ?? source.length
      let brackets = 0
      let braces = 0
      let assignment = false
      let finished = false
      while (cursor < tokens.length) {
        const token = tokens[cursor]
        if (!token) break
        if (brackets === 0 && braces === 0 && token.text === '}') break
        if (head.length >= 2 && token.kind === 'word' && ['model', 'goal', 'knowledge', 'toolbox', 'name', 'step', 'when', 'case', 'default', 'on_failure', 'output', 'max_turns', 'exit_when'].includes(token.text) && brackets === 0 && braces === 0 && /\r|\n/.test(source.slice(head.at(-1)?.end ?? start, token.start))) {
          report('ODSL101', token.start)
          items.push({ kind: 'statement', head, span: { start, end: head.at(-1)?.end ?? start } }); finished = true; break
        }
        cursor++
        if (token.text === '=' && brackets === 0 && braces === 0) assignment = true
        const variableMetadata = ['string', 'number', 'boolean', 'json'].includes(head[0]?.text ?? '') && assignment && head.at(-1)?.text !== '='
        if (token.text === '{' && brackets === 0 && braces === 0 && (!assignment || variableMetadata) && head[0]?.text !== 'output_binding') {
          const children = parseItems(depth + 1)
          const close = tokens[cursor]
          if (close?.text === '}') cursor++
          else report('ODSL101', source.length)
          items.push({ kind: 'block', head, children, span: { start, end: close?.end ?? source.length } }); finished = true; break
        }
        if (token.text === ';' && brackets === 0 && braces === 0) {
          items.push({ kind: 'statement', head, span: { start, end: token.end } }); finished = true; break
        }
        if (['[', '('].includes(token.text)) brackets++
        if ([']', ')'].includes(token.text)) { brackets--; if (brackets < 0) { report('ODSL102', token.start, token.end); brackets = 0 } }
        if (token.text === '{') braces++
        if (token.text === '}') braces--
        head.push(token)
      }
      if (!finished) {
        report('ODSL101', tokens[cursor]?.start ?? source.length)
        if (head.length) items.push({ kind: 'statement', head, span: { start, end: head.at(-1)?.end ?? start } })
      }
      if (!head.length && !finished && tokens[cursor]?.text !== '}') cursor++
    }
    return items
  }
  const syntax = parseItems(0)
  if (!syntax.length) report('ODSL101', source.length)
  if (diagnostics.length >= 200) diagnostics.push({ code: 'ODSL604', severity: 'info', messageKey: 'ODSL604', span: { start: source.length, end: source.length } })
  return { syntax, diagnostics }
}
