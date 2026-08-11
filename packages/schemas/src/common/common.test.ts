import { describe, expect, it } from 'vitest'

import {
  V1_SCHEMA_VERSION,
  jsonObjectSchema,
  jsonValueSchema,
  revisionSchema,
  schemaVersionSchema,
  utcTimestampSchema,
  uuidSchema,
} from './index'

describe('UUID schema', () => {
  it('accepts canonical UUID strings', () => {
    expect(uuidSchema.parse('0195f076-b6e6-7ef0-98db-d721990f8800')).toBe(
      '0195f076-b6e6-7ef0-98db-d721990f8800',
    )
  })

  it.each(['agent-1', '', '0195f076-b6e6-7ef0-98db-d721990f880'])('rejects %j', (value) => {
    expect(uuidSchema.safeParse(value).success).toBe(false)
  })
})

describe('schema version and revision', () => {
  it('accepts only the frozen V1 schema version', () => {
    expect(schemaVersionSchema.parse(V1_SCHEMA_VERSION)).toBe('1.0.0')
    expect(schemaVersionSchema.safeParse('1.0.1').success).toBe(false)
  })

  it.each([1, 2, 42])('accepts positive integer revision %d', (revision) => {
    expect(revisionSchema.parse(revision)).toBe(revision)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid revision %s',
    (revision) => {
      expect(revisionSchema.safeParse(revision).success).toBe(false)
    },
  )
})

describe('UTC timestamp schema', () => {
  it.each(['2026-08-11T00:00:00Z', '2026-08-11T00:00:00.123Z'])(
    'accepts %s',
    (timestamp) => {
      expect(utcTimestampSchema.parse(timestamp)).toBe(timestamp)
    },
  )

  it.each(['2026-08-11', '2026-08-11T08:00:00+08:00', 'not-a-date'])(
    'rejects %s',
    (timestamp) => {
      expect(utcTimestampSchema.safeParse(timestamp).success).toBe(false)
    },
  )
})

describe('JSON schemas', () => {
  it('accepts nested canonical JSON values and objects', () => {
    const value = {
      enabled: true,
      count: 3,
      nested: { name: 'research', nullable: null },
      items: ['one', 2, false],
    }

    expect(jsonValueSchema.parse(value)).toEqual(value)
    expect(jsonObjectSchema.parse(value)).toEqual(value)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, undefined, new Date()])(
    'rejects non-JSON value %s',
    (value) => {
      expect(jsonValueSchema.safeParse(value).success).toBe(false)
    },
  )

  it('requires an object at JSON object boundaries', () => {
    expect(jsonObjectSchema.safeParse([]).success).toBe(false)
    expect(jsonObjectSchema.safeParse('value').success).toBe(false)
  })
})
