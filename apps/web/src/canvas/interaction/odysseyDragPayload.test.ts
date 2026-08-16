import { uuidSchema } from '@odyssey/schemas'
import { describe, expect, it } from 'vitest'

import { parseOdysseyDragPayload, serializeOdysseyDragPayload, type OdysseyDragPayloadV1 } from './odysseyDragPayload'

const ID = uuidSchema.parse('0195f076-b6e6-7ef0-98db-111111111111')

describe('Odyssey drag payload boundary', () => {
  it.each<OdysseyDragPayloadV1>([
    { version: 1, kind: 'agent-template', templateId: ID },
    { version: 1, kind: 'assigned-agent', agentId: ID, sourceSlotId: ID },
    { version: 1, kind: 'pattern-slot', slotId: ID },
    { version: 1, kind: 'workflow-node-template', nodeType: 'task' },
    { version: 1, kind: 'resource', resourceType: 'knowledge-space', resourceId: ID },
  ])('round-trips $kind', (payload) => {
    expect(parseOdysseyDragPayload(serializeOdysseyDragPayload(payload))).toEqual({ ok: true, value: payload })
  })

  it.each([
    ['{', 'MALFORMED_JSON'],
    ['[]', 'PAYLOAD_NOT_OBJECT'],
    ['{"version":2,"kind":"pattern-slot","slotId":"0195f076-b6e6-7ef0-98db-111111111111"}', 'UNSUPPORTED_VERSION'],
    ['{"version":1,"kind":"foreign"}', 'UNKNOWN_KIND'],
    ['{"version":1,"kind":"agent-template","templateId":"bad"}', 'PAYLOAD_INVALID'],
    [`{"version":1,"kind":"agent-template","templateId":"${ID}","foreign":true}`, 'PAYLOAD_INVALID'],
  ])('returns a stable error for %s', (serialized, code) => {
    expect(parseOdysseyDragPayload(serialized)).toEqual({ ok: false, error: { code } })
  })
})
