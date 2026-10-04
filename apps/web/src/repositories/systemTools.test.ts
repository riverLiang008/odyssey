import { describe, expect, it } from 'vitest'
import fixtures from '../../../../packages/schemas/fixtures/system-tools.json'
import { HttpEditorRepository } from './httpEditorRepository'
describe('HTTP System Tool inventory', () => {
  it('runtime validates all five definitions', async () => {
    const definitions = fixtures.valid.map((s) => ({ id: s.id, kind: s.kind, source: 'built_in', name: s.label, category: 'test', description: null, configurationSchema: { type: 'object' }, inputSchema: {}, outputSchema: {} }))
    const repo = new HttpEditorRepository({ baseUrl: 'http://localhost/api/v1', fetchImplementation: async (url) => { expect(String(url)).toBe('http://localhost/api/v1/tool-definitions'); return new Response(JSON.stringify(definitions)) } })
    const result = await repo.listSystemToolDefinitions()
    expect(result.ok && result.value).toEqual(definitions)
  })
  it('does not admit unvalidated inventory', async () => {
    const repo = new HttpEditorRepository({ baseUrl: 'http://localhost/api/v1', fetchImplementation: async () => new Response(JSON.stringify([{ kind: 'web_search' }])) })
    expect(await repo.listSystemToolDefinitions()).toEqual({ ok: false, error: { code: 'RESPONSE_INVALID' } })
  })
})
