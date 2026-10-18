export type MarkdownInline =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string }
  | { type: 'strong'; content: string }
  | { type: 'emphasis'; content: string }
  | { type: 'link'; content: string; href: string }

export type MarkdownBlock =
  | { type: 'heading'; level: number; content: MarkdownInline[] }
  | { type: 'paragraph'; content: MarkdownInline[] }
  | { type: 'quote'; content: MarkdownInline[] }
  | { type: 'list'; ordered: boolean; items: MarkdownInline[][] }
  | { type: 'code'; language: string | null; content: string }
  | { type: 'rule' }

const inlinePattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? ''
    if (!line.trim()) { index += 1; continue }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || null
      const content: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        content.push(lines[index] ?? '')
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', language, content: content.join('\n') })
      continue
    }
    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { blocks.push({ type: 'rule' }); index += 1; continue }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) { blocks.push({ type: 'heading', level: heading[1]?.length ?? 1, content: parseInline(heading[2] ?? '') }); index += 1; continue }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { blocks.push({ type: 'quote', content: parseInline(quote[1] ?? '') }); index += 1; continue }
    const list = /^\s*(?:(\d+)\.|[-+*])\s+(.+)$/.exec(line)
    if (list) {
      const ordered = Boolean(list[1])
      const items: MarkdownInline[][] = []
      while (index < lines.length) {
        const item = /^\s*(?:(\d+)\.|[-+*])\s+(.+)$/.exec(lines[index] ?? '')
        if (!item || Boolean(item[1]) !== ordered) break
        items.push(parseInline(item[2] ?? ''))
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    const paragraph = [line.trim()]
    index += 1
    while (index < lines.length && (lines[index] ?? '').trim() && !isBlockStart(lines[index] ?? '')) {
      paragraph.push((lines[index] ?? '').trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) })
  }
  return blocks
}

function isBlockStart(line: string): boolean {
  return /^(#{1,6})\s+|^>\s?|^```|^\s*(?:(?:\d+)\.|[-+*])\s+|^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)
}

function parseInline(source: string): MarkdownInline[] {
  const result: MarkdownInline[] = []
  let cursor = 0
  for (const match of source.matchAll(inlinePattern)) {
    const start = match.index ?? 0
    if (start > cursor) result.push({ type: 'text', content: source.slice(cursor, start) })
    const token = match[0]
    if (token.startsWith('`')) result.push({ type: 'code', content: token.slice(1, -1) })
    else if (token.startsWith('**') || token.startsWith('__')) result.push({ type: 'strong', content: token.slice(2, -2) })
    else if (token.startsWith('*') || token.startsWith('_')) result.push({ type: 'emphasis', content: token.slice(1, -1) })
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (link && safeHref(link[2] ?? '')) result.push({ type: 'link', content: link[1] ?? '', href: link[2] ?? '' })
      else result.push({ type: 'text', content: token })
    }
    cursor = start + token.length
  }
  if (cursor < source.length) result.push({ type: 'text', content: source.slice(cursor) })
  return result.reduce<MarkdownInline[]>((tokens, token) => {
    const previous = tokens.at(-1)
    if (previous?.type === 'text' && token.type === 'text') previous.content += token.content
    else tokens.push(token)
    return tokens
  }, [])
}

function safeHref(value: string): boolean {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(value)
}
