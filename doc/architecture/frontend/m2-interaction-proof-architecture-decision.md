# ADR — M2 Interaction Proof Architecture

> Status: Proposed for acceptance  
> Date: 2026-08-30  
> Scope: M2.1–M2.9 frontend interaction proof

## Context

M2 established two related but materially different editors: a system-level Journey Pattern editor and an Agent-level Workflow editor. Both now persist through revision-CAS Web APIs and must support nested Loop ownership, resource binding, autosave races, failure recovery, and future M3–M5 configuration surfaces without leaking view-library state into canonical contracts.

## Decision

### 1. Retain Vue Flow behind the Workflow Canvas adapter boundary

Vue Flow remains the rendering and pointer-interaction engine for Agent Workflow Canvas. Its nodes, edges, handles, viewport events, and component state remain presentation-only. The retained direction is:

```text
WorkflowGraph + CanvasLayout
          ↓ projection
canvas/workflow adapter
          ↓
Vue Flow view model
          ↓ typed intent
application transaction / domain command
          ↓
canonical graph + layout
```

No Vue Flow object is persisted, returned by a repository, or used as the source of truth.

### 2. Keep System Pattern Canvas and Agent Workflow Canvas distinct

System Pattern Canvas has four constrained execution topologies, dynamic typed Slots, fixed Pattern identity, and lifecycle commands that may atomically create or delete Agents. It therefore uses deterministic topology/layout strategies and capability-driven Slot interactions.

Agent Workflow Canvas is a freeform DAG editor with graph validation, placement, viewport, nested Loop bodies, node configuration, and resource binding. It therefore uses Vue Flow through adapters. Forcing both surfaces into one Canvas model would erase useful domain constraints and increase synchronization risk.

### 3. Retain canonical graph/layout/session separation

- graph: executable semantic ownership;
- layout: persisted presentation coordinates and viewport;
- session: selection, panels, mode, focus, drag state, open drafts, and active Canvas context.

Only graph/layout and explicitly canonical resources enter save payloads. Session state is disposable and never restored as business data.

### 4. Treat Loop as a compound node with namespaced child ownership

The root Workflow owns one Loop node. The Loop node owns a child `LoopBodyDocument`, including its own graph and layout with immutable Loop Start/End boundaries. Root and child Canvas sessions use separate namespace keys. Nested Loops remain unsupported until a later ADR defines recursion, execution semantics, validation limits, and UX.

### 5. Retain typed DnD arbitration

All drag payloads cross a versioned runtime-validated boundary. Target compatibility is evaluated before mutation. Views emit typed intent; domain/application commands own canonical changes. Invalid and duplicate drops are session feedback only and cannot expose partial candidates.

### 6. Standardize persistence on runtime validation plus revision CAS

Journey and Agent Workflow repositories return schema-validated aggregates and structured errors. Local mutations use a shared discriminated persistence state machine and autosave coordinator:

```text
clean → dirty → saving → clean
                   ↘ failed
                   ↘ conflict
```

The coordinator uses 800 ms debounce, per-document single-flight saves, immutable snapshots, edit-during-save coalescing, and one follow-up save using the newly returned revision. A success only updates revision metadata; it never replaces newer local canonical content.

Server-authoritative Journey lifecycle commands first flush local dirty state, then use the newest revision, and finally replace the aggregate baseline once. They never trigger a second autosave.

Conflict is blocking. Reload and overwrite are explicit choices with application-owned confirmation dialogs; V1 does not perform semantic merge. Failed internal navigation uses the same application-owned confirmation pattern after flush, while browser unload necessarily uses native protection and does not bypass CAS with `sendBeacon`.

This boundary is sufficient for subsequent milestones, provided new canonical fields continue to use typed commands, runtime schemas, and the same persistence pipeline.

## Proof-only UI and fixtures

- Unit fixtures remain test-only and must never be selected as a production repository fallback.
- “Coming soon” surfaces may remain only when the corresponding milestone is explicitly out of scope; they must not fabricate resources or persist placeholder identifiers.
- Manual Save remains an immediate flush action over the autosave pipeline, not a separate persistence implementation.
- M2 acceptance aggregates remain development data until explicitly authorized for deletion.

## Stable extension points

### M3 — Behavior

Add typed Behavior policy commands and schemas. Behavior remains horizontal across Input Guardrail, main Execution, and Output Guardrail and must not be encoded as Pattern topology.

### M4 — Agent configuration

Extend node/config domain commands and inspector panels. Model/provider credentials and other secrets must use dedicated backend contracts and must not enter Canvas session or diagnostics.

### M5 — Variables, Tools, and Knowledge resources

Extend canonical resource schemas and repositories, then bind by stable UUID through existing resource commands and DnD preflight. Inventory/query UI remains derived state.

## Consequences

Positive:

- canonical ownership is deterministic;
- view-library upgrades do not migrate persisted documents;
- race behavior is shared and testable without Vue;
- revision conflict cannot silently overwrite another session;
- M3–M5 can add commands and panels without replacing Canvas architecture.

Costs:

- adapter/application layers add code compared with direct component mutation;
- V1 conflict recovery is coarse-grained reload/overwrite rather than merge;
- Loop recursion and collaboration require later decisions;
- real browser E2E still requires a running frontend/API and retained acceptance aggregate.

## Known limitations and new-ADR triggers

A new ADR is required before introducing any of the following:

- collaborative editing, OT, CRDT, or cross-tab synchronization;
- nested Loop recursion;
- offline mutation queues;
- semantic conflict merge or version history;
- server-driven execution visualization that changes canonical ownership;
- replacement of Vue Flow or convergence of the two Canvas interaction models.
