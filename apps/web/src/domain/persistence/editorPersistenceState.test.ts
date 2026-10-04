import { describe, expect, it } from 'vitest'

import {
  applyPersistenceFailure,
  applyPersistenceSuccess,
  beginPersistenceSave,
  createCleanPersistenceState,
  hasUnsavedPersistenceChanges,
  markPersistenceDirty,
  preparePersistenceConflictOverwrite,
  resolvePersistenceConflictWithServer,
  schedulePersistenceSave,
} from './editorPersistenceState'

describe('editor persistence state', () => {
  it('moves clean edits into a debounced dirty state', () => {
    const clean = createCleanPersistenceState(3)
    const dirty = markPersistenceDirty(clean, 800)

    expect(dirty).toEqual({
      type: 'dirty',
      serverRevision: 3,
      mutationSeq: 1,
      savedMutationSeq: 0,
      scheduledAt: 800,
    })
    expect(schedulePersistenceSave(dirty, 900)).toMatchObject({ type: 'dirty', scheduledAt: 900 })
    expect(hasUnsavedPersistenceChanges(dirty)).toBe(true)
  })

  it('captures an immutable mutation sequence when a save begins', () => {
    const dirty = markPersistenceDirty(createCleanPersistenceState(2), 800)
    expect(beginPersistenceSave(dirty, 4)).toEqual({
      type: 'saving',
      serverRevision: 2,
      mutationSeq: 1,
      savedMutationSeq: 0,
      requestSeq: 4,
      snapshotSeq: 1,
    })
    expect(beginPersistenceSave(createCleanPersistenceState(2), 5)).toBeNull()
  })

  it('coalesces edits made during a save into one immediate follow-up', () => {
    const dirty = markPersistenceDirty(createCleanPersistenceState(5), 800)
    const saving = beginPersistenceSave(dirty, 1)
    expect(saving).not.toBeNull()
    const edited = markPersistenceDirty(saving!, 1600)
    const succeeded = applyPersistenceSuccess(edited, 1, 6, 1000)

    expect(succeeded).toEqual({
      type: 'dirty',
      serverRevision: 6,
      mutationSeq: 2,
      savedMutationSeq: 1,
      scheduledAt: 1000,
    })
  })

  it('becomes clean only when the saved snapshot is still current', () => {
    const dirty = markPersistenceDirty(createCleanPersistenceState(5), 800)
    const saving = beginPersistenceSave(dirty, 1)!

    expect(applyPersistenceSuccess(saving, 1, 6, 1000)).toEqual({
      type: 'clean',
      serverRevision: 6,
      mutationSeq: 1,
      savedMutationSeq: 1,
    })
  })

  it('ignores stale success and failure results', () => {
    const saving = beginPersistenceSave(
      markPersistenceDirty(createCleanPersistenceState(1), 800),
      7,
    )!

    expect(applyPersistenceSuccess(saving, 6, 2, 1000)).toBe(saving)
    expect(applyPersistenceFailure(saving, 6, { code: 'NETWORK_FAILED' })).toBe(saving)
  })

  it('keeps retryable failures unsaved and permits a new save attempt', () => {
    const saving = beginPersistenceSave(
      markPersistenceDirty(createCleanPersistenceState(1), 800),
      1,
    )!
    const failed = applyPersistenceFailure(saving, 1, { code: 'NETWORK_FAILED' })

    expect(failed).toMatchObject({ type: 'failed', failedSnapshotSeq: 1 })
    expect(hasUnsavedPersistenceChanges(failed)).toBe(true)
    expect(beginPersistenceSave(failed, 2)).toMatchObject({ type: 'saving', requestSeq: 2 })
  })

  it('blocks silent saves after a revision conflict until explicitly resolved', () => {
    const saving = beginPersistenceSave(
      markPersistenceDirty(createCleanPersistenceState(4), 800),
      1,
    )!
    const conflict = applyPersistenceFailure(saving, 1, {
      code: 'REVISION_CONFLICT',
      expectedRevision: 4,
      currentRevision: 8,
    })

    expect(conflict).toMatchObject({ type: 'conflict', conflictedSnapshotSeq: 1 })
    expect(beginPersistenceSave(conflict, 2)).toBeNull()
    expect(markPersistenceDirty(conflict, 1600)).toMatchObject({ type: 'conflict', mutationSeq: 2 })
    expect(resolvePersistenceConflictWithServer(conflict, 8)).toEqual(createCleanPersistenceState(8))
    expect(preparePersistenceConflictOverwrite(conflict, 8, 1000)).toMatchObject({
      type: 'dirty',
      serverRevision: 8,
      scheduledAt: 1000,
    })
  })

  it('does not report a pristine or absent document as unsaved', () => {
    expect(hasUnsavedPersistenceChanges(null)).toBe(false)
    expect(hasUnsavedPersistenceChanges(createCleanPersistenceState(1))).toBe(false)
  })
})
