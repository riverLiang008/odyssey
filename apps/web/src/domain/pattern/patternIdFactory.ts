import { uuidSchema, type UUID } from '@odyssey/schemas'

export interface PatternIdFactory {
  patternId(): UUID
  slotId(): UUID
  routeId(): UUID
}

function newUuid(): UUID {
  return uuidSchema.parse(crypto.randomUUID())
}

export const cryptoPatternIdFactory: PatternIdFactory = {
  patternId: newUuid,
  slotId: newUuid,
  routeId: newUuid,
}

