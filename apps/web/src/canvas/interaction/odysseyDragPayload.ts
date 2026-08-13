import {
  jsonObjectSchema,
  patternTemplateKeySchema,
  uuidSchema,
  type PatternTemplateKey,
  type UUID,
  type WorkflowNode,
} from '@odyssey/schemas'

export const ODYSSEY_DRAG_MIME = 'application/x-odyssey-drag+json'

export type OdysseyDragPayloadV1 =
  | { version: 1; kind: 'pattern-template'; templateKey: PatternTemplateKey }
  | { version: 1; kind: 'agent-template'; templateId: UUID }
  | { version: 1; kind: 'assigned-agent'; agentId: UUID; sourceSlotId: UUID }
  | { version: 1; kind: 'pattern-slot'; slotId: UUID }
  | { version: 1; kind: 'workflow-node-template'; nodeType: WorkflowNode['type'] }
  | { version: 1; kind: 'resource'; resourceType: 'tool' | 'knowledge-space'; resourceId: UUID }

export type PatternDragPayload = Extract<
  OdysseyDragPayloadV1,
  { kind: 'pattern-template' | 'agent-template' | 'assigned-agent' | 'pattern-slot' }
>

export type DragPayloadParseErrorCode =
  | 'MALFORMED_JSON'
  | 'PAYLOAD_NOT_OBJECT'
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN_KIND'
  | 'PAYLOAD_INVALID'

export type DragPayloadParseResult =
  | { ok: true; value: OdysseyDragPayloadV1 }
  | { ok: false; error: { code: DragPayloadParseErrorCode } }

function uuid(value: unknown): UUID | null {
  const parsed = uuidSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => actual.includes(key))
}

export function serializeOdysseyDragPayload(payload: OdysseyDragPayloadV1): string {
  return JSON.stringify(payload)
}

export function parseOdysseyDragPayload(serialized: unknown): DragPayloadParseResult {
  if (typeof serialized !== 'string') return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
  let candidate: unknown
  try {
    candidate = JSON.parse(serialized)
  } catch {
    return { ok: false, error: { code: 'MALFORMED_JSON' } }
  }
  const object = jsonObjectSchema.safeParse(candidate)
  if (!object.success) return { ok: false, error: { code: 'PAYLOAD_NOT_OBJECT' } }
  const value = object.data
  if (value.version !== 1) return { ok: false, error: { code: 'UNSUPPORTED_VERSION' } }
  if (typeof value.kind !== 'string') return { ok: false, error: { code: 'UNKNOWN_KIND' } }

  switch (value.kind) {
    case 'pattern-template': {
      if (!hasExactKeys(value, ['version', 'kind', 'templateKey'])) return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      const templateKey = patternTemplateKeySchema.safeParse(value.templateKey)
      return templateKey.success
        ? { ok: true, value: { version: 1, kind: value.kind, templateKey: templateKey.data } }
        : { ok: false, error: { code: 'PAYLOAD_INVALID' } }
    }
    case 'agent-template': {
      if (!hasExactKeys(value, ['version', 'kind', 'templateId'])) return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      const templateId = uuid(value.templateId)
      return templateId ? { ok: true, value: { version: 1, kind: value.kind, templateId } } : { ok: false, error: { code: 'PAYLOAD_INVALID' } }
    }
    case 'assigned-agent': {
      if (!hasExactKeys(value, ['version', 'kind', 'agentId', 'sourceSlotId'])) return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      const agentId = uuid(value.agentId)
      const sourceSlotId = uuid(value.sourceSlotId)
      return agentId && sourceSlotId
        ? { ok: true, value: { version: 1, kind: value.kind, agentId, sourceSlotId } }
        : { ok: false, error: { code: 'PAYLOAD_INVALID' } }
    }
    case 'pattern-slot': {
      if (!hasExactKeys(value, ['version', 'kind', 'slotId'])) return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      const slotId = uuid(value.slotId)
      return slotId ? { ok: true, value: { version: 1, kind: value.kind, slotId } } : { ok: false, error: { code: 'PAYLOAD_INVALID' } }
    }
    case 'workflow-node-template':
      if (!hasExactKeys(value, ['version', 'kind', 'nodeType'])) return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      switch (value.nodeType) {
        case 'start': case 'end': case 'agent_action': case 'task': case 'branch': case 'loop':
          return { ok: true, value: { version: 1, kind: value.kind, nodeType: value.nodeType } }
        default:
          return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      }
    case 'resource': {
      if (!hasExactKeys(value, ['version', 'kind', 'resourceType', 'resourceId'])) return { ok: false, error: { code: 'PAYLOAD_INVALID' } }
      const resourceId = uuid(value.resourceId)
      return resourceId && (value.resourceType === 'tool' || value.resourceType === 'knowledge-space')
        ? { ok: true, value: { version: 1, kind: value.kind, resourceType: value.resourceType, resourceId } }
        : { ok: false, error: { code: 'PAYLOAD_INVALID' } }
    }
    default:
      return { ok: false, error: { code: 'UNKNOWN_KIND' } }
  }
}
