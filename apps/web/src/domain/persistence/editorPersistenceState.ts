import type { RepositoryError } from '@odyssey/schemas'

interface PersistenceBase {
  serverRevision: number
  mutationSeq: number
  savedMutationSeq: number
}

export interface CleanPersistenceState extends PersistenceBase {
  type: 'clean'
}

export interface DirtyPersistenceState extends PersistenceBase {
  type: 'dirty'
  scheduledAt: number
}

export interface SavingPersistenceState extends PersistenceBase {
  type: 'saving'
  requestSeq: number
  snapshotSeq: number
}

export interface FailedPersistenceState extends PersistenceBase {
  type: 'failed'
  failedSnapshotSeq: number
  error: Exclude<RepositoryError, { code: 'REVISION_CONFLICT' }>
}

export interface ConflictPersistenceState extends PersistenceBase {
  type: 'conflict'
  conflictedSnapshotSeq: number
  error: Extract<RepositoryError, { code: 'REVISION_CONFLICT' }>
}

export type EditorPersistenceState =
  | CleanPersistenceState
  | DirtyPersistenceState
  | SavingPersistenceState
  | FailedPersistenceState
  | ConflictPersistenceState

export function createCleanPersistenceState(serverRevision: number): CleanPersistenceState {
  return {
    type: 'clean',
    serverRevision,
    mutationSeq: 0,
    savedMutationSeq: 0,
  }
}

export function markPersistenceDirty(
  state: EditorPersistenceState,
  scheduledAt: number,
): EditorPersistenceState {
  const mutationSeq = state.mutationSeq + 1

  if (state.type === 'saving') {
    return { ...state, mutationSeq }
  }

  if (state.type === 'conflict') {
    return { ...state, mutationSeq }
  }

  return {
    type: 'dirty',
    serverRevision: state.serverRevision,
    mutationSeq,
    savedMutationSeq: state.savedMutationSeq,
    scheduledAt,
  }
}

export function schedulePersistenceSave(
  state: EditorPersistenceState,
  scheduledAt: number,
): EditorPersistenceState {
  if (state.type !== 'dirty') return state
  return { ...state, scheduledAt }
}

export function beginPersistenceSave(
  state: EditorPersistenceState,
  requestSeq: number,
): SavingPersistenceState | null {
  if (state.type !== 'dirty' && state.type !== 'failed') return null

  return {
    type: 'saving',
    serverRevision: state.serverRevision,
    mutationSeq: state.mutationSeq,
    savedMutationSeq: state.savedMutationSeq,
    requestSeq,
    snapshotSeq: state.mutationSeq,
  }
}

export function applyPersistenceSuccess(
  state: EditorPersistenceState,
  requestSeq: number,
  serverRevision: number,
  followUpScheduledAt: number,
): EditorPersistenceState {
  if (state.type !== 'saving' || state.requestSeq !== requestSeq) return state

  if (state.mutationSeq > state.snapshotSeq) {
    return {
      type: 'dirty',
      serverRevision,
      mutationSeq: state.mutationSeq,
      savedMutationSeq: state.snapshotSeq,
      scheduledAt: followUpScheduledAt,
    }
  }

  return {
    type: 'clean',
    serverRevision,
    mutationSeq: state.mutationSeq,
    savedMutationSeq: state.snapshotSeq,
  }
}

export function applyPersistenceFailure(
  state: EditorPersistenceState,
  requestSeq: number,
  error: RepositoryError,
): EditorPersistenceState {
  if (state.type !== 'saving' || state.requestSeq !== requestSeq) return state

  const base = {
    serverRevision: state.serverRevision,
    mutationSeq: state.mutationSeq,
    savedMutationSeq: state.savedMutationSeq,
  }

  if (error.code === 'REVISION_CONFLICT') {
    return {
      type: 'conflict',
      ...base,
      conflictedSnapshotSeq: state.snapshotSeq,
      error,
    }
  }

  return {
    type: 'failed',
    ...base,
    failedSnapshotSeq: state.snapshotSeq,
    error,
  }
}

export function resolvePersistenceConflictWithServer(
  state: EditorPersistenceState,
  serverRevision: number,
): CleanPersistenceState | null {
  if (state.type !== 'conflict') return null
  return createCleanPersistenceState(serverRevision)
}

export function preparePersistenceConflictOverwrite(
  state: EditorPersistenceState,
  latestServerRevision: number,
  scheduledAt: number,
): DirtyPersistenceState | null {
  if (state.type !== 'conflict') return null
  return {
    type: 'dirty',
    serverRevision: latestServerRevision,
    mutationSeq: state.mutationSeq,
    savedMutationSeq: state.savedMutationSeq,
    scheduledAt,
  }
}

export function hasUnsavedPersistenceChanges(state: EditorPersistenceState | null): boolean {
  if (state === null) return false
  return state.type !== 'clean' || state.mutationSeq !== state.savedMutationSeq
}
