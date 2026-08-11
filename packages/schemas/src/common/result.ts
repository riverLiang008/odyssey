export type Result<TValue, TError> =
  | { ok: true; value: TValue }
  | { ok: false; error: TError }

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`)
}
