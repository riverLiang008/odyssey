import { describe, expect, it } from 'vitest'
import { parseMarkdown } from './markdown'

describe('parseMarkdown', () => {
  it('parses common block syntax without emitting HTML', () => {
    expect(parseMarkdown('# Title\n\n> Note\n\n- one\n- two\n\n```ts\nconst ok = true\n```')).toEqual([
      { type: 'heading', level: 1, content: [{ type: 'text', content: 'Title' }] },
      { type: 'quote', content: [{ type: 'text', content: 'Note' }] },
      { type: 'list', ordered: false, items: [[{ type: 'text', content: 'one' }], [{ type: 'text', content: 'two' }]] },
      { type: 'code', language: 'ts', content: 'const ok = true' },
    ])
  })

  it('keeps unsafe links as text', () => {
    expect(parseMarkdown('[bad](javascript:alert(1))')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', content: '[bad](javascript:alert(1))' }] },
    ])
  })
})
