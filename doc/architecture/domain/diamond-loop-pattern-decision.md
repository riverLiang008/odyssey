# Diamond Loop Built-in Pattern Decision

> Status: Accepted  
> Accepted by: Product owner  
> Accepted date: 2026-08-15  
> Applies from: M2.4 remediation onward

## Decision

The built-in Pattern whose persisted compatibility key is `diamond_loop` is a
directed circular loop. It is not a branch-and-merge Pattern.

- One Slot is explicitly designated as the entry.
- All Slots participate in one directed cycle.
- Execution follows the ordered cycle and the final Slot routes back to the entry.
- Routes are system-derived and display direction arrows.
- Slot count is dynamic, subject to a minimum of two Slots.
- Users may add or remove Slots through Pattern commands; route topology is
  regenerated atomically by the Pattern strategy.
- Removing a non-entry Slot preserves the current entry.
- Removing the entry requires a single atomic rule that promotes an adjacent
  Slot to entry. The implementation must freeze and test which adjacent Slot is
  promoted before exposing this action; UI components must not choose it.
- Reordering changes cycle execution order but does not change Slot identity or
  Agent assignment.

Branching, parallel paths, merge/convergence, multiple entries, and arbitrary
route editing belong to a future user-defined Custom Pattern and are out of
scope for this built-in Pattern.

## Naming and compatibility

- Keep the persisted `PatternKind` and built-in `templateKey` as `diamond_loop`
  for schema, fixture, and stored-document compatibility.
- Change the user-facing label to `Loop` or `Circular Loop` when the UI copy is
  updated. New product documentation should prefer `Circular Loop`.
- Do not rename persisted keys without a separately designed data migration.

## Presentation contract

- Lay out Slots around a ring; the entry must have a distinct, accessible
  indicator that does not rely on color alone.
- Connect each Slot to its successor and connect the final Slot to the entry.
- Every visible connection has an arrow indicating execution direction.
- There is no trailing route from the loop to the Pattern container boundary.
- Geometry is derived presentation state and must not be persisted in
  `PatternConfig`.

## Implementation handoff

Before implementing dynamic Circular Loop behavior, update the Pattern strategy,
validator, fixtures, commands, adapter geometry, context-menu capabilities, and
tests together. The previous fixed roles `upper_branch`, `exit`, and
`lower_branch` are legacy implementation assumptions, not the accepted product
model. Do not extend those roles or build branch/merge behavior on top of them.

Existing stored M2 fixtures using the legacy four-role representation require an
explicit compatibility/migration decision. Until that migration is implemented,
do not silently reinterpret or mutate persisted legacy documents during render.

