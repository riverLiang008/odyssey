# Journey Persistence Vertical Slice — Backend Handoff

> Status: Superseded by `m2.4b-journey-persistence-api-implementation-plan.md`  
> Proposed milestone: M2.4B  
> Owner: Backend Codex  
> Scope: Enable a real `New OdyJourney → choose Pattern → edit → save → reload` path

## 1. Why this work starts now

The M2 frontend currently proves Journey and Pattern interactions through an
in-memory repository and a deterministic fixture. This is now blocking product
acceptance:

- the Journey list contains one fixture;
- `New OdyJourney` is disabled;
- users cannot create separate Journeys to inspect all four built-in Patterns;
- Journey deletion and occupied-Slot deletion need trustworthy backend transaction
  boundaries;
- browser refresh cannot prove real persistence or revision-conflict behavior.

The next useful step is a thin, production-shaped backend vertical slice rather
than more frontend-only fixtures. M2.5 remains the read-only Workflow Preview
milestone and must not absorb this persistence work.

## 2. Repository facts

- API application: `apps/api`.
- Stack: Python 3.12, FastAPI, Pydantic Settings, SQLAlchemy asyncio, asyncpg,
  Alembic, pytest, pytest-asyncio and Ruff.
- Current API surface contains health routing and database foundations, but no
  Journey CRUD/service layer.
- The initial migration and SQLAlchemy models already contain `ody_journey`,
  `agent_workflow`, revision columns and related template/resource tables.
- Canonical frontend/runtime contracts live in `packages/schemas`; the backend
  must implement compatible Pydantic boundary models rather than accepting
  unvalidated arbitrary JSON.
- The frontend repository boundary currently has an in-memory implementation.
  The backend Codex should coordinate its HTTP DTOs with that port, but should
  not place frontend view state or canvas geometry in database contracts.

## 3. Required reading, in order

Read these files completely before designing endpoints or migrations:

1. [`Odyssey V1 design constraints`](../../../architecture/domain/odyssey-v1-design-constraints.md)
   — accepted product, ownership, revision and persistence constraints.
2. [`Diamond/Circular Loop decision`](../../../architecture/domain/diamond-loop-pattern-decision.md)
   — `diamond_loop` compatibility key and the new circular semantics; avoid
   baking legacy branch roles into new APIs.
3. [`Canonical JSON contracts`](../../../architecture/data/contracts/canonical-json-contracts-draft.md)
   — aggregate shapes and reference boundaries.
4. [`Contract source mapping`](../../../architecture/data/contracts/v1-contract-source-mapping.md)
   — which source is authoritative when documents disagree.
5. [`V1 database implementation baseline`](../../../architecture/data/database/reviews/v1-database-design-review-draft.md)
   — current tables, JSONB ownership and transaction expectations.
6. [`V1 object storage design`](../../../architecture/data/storage/v1-object-storage-design.md)
   — relevant when resource fields appear in aggregate validation; object
   storage implementation itself is not required for this slice.
7. [`M2.1 contracts/repository plan`](../frontend/m2.1-contracts-fixtures-repository-implementation-plan.md)
   and [`M2.1 completion report`](../frontend/m2.1-completion-report.md) — existing
   frontend repository contracts, fixtures and runtime-validation assumptions.
8. [`M2.4 remediation plan`](../frontend/m2.4-pattern-presentation-dynamic-slot-remediation-plan.md)
   — current Slot creation/removal requirements (its replacement proposal is superseded).
9. Source files: `apps/api/src/odyssey_api/db/models.py`,
   `apps/api/migrations/versions/20260806_0001_initial_foundation.py`,
   `apps/api/src/odyssey_api/db/session.py`, `apps/api/src/odyssey_api/main.py`,
   `packages/schemas/src/editor/editor.ts`,
   `packages/schemas/src/pattern/pattern.ts`, and
   `packages/schemas/src/repository/repository.ts`.

When historical plans conflict with accepted constraints or the Circular Loop
decision, the accepted documents above win.

## 4. Target user path

```text
Journey list
→ New OdyJourney
→ enter minimal metadata and choose a built-in Pattern
→ POST creates one valid Journey aggregate atomically
→ response returns journeyId and revision
→ frontend navigates to Journey Editor
→ GET returns the selected Pattern and Agent summaries
→ Slot/Agent edits save with expected revision
→ refresh reloads the same canonical state
```

Built-in choices are `solo_component`, `linear_sequence`, `hub_and_spoke`, and
`diamond_loop`. Keep `diamond_loop` as the persisted key; its user-facing name
may become Circular Loop.

## 5. Minimum backend scope

### 5.1 Journey endpoints

Define exact request/response contracts before implementation. The minimum
capabilities are:

- create a Journey and instantiate the selected built-in Pattern;
- list Journeys in the current Workspace;
- load one Journey editor aggregate;
- save one Journey aggregate using optimistic revision checking;
- return stable not-found, validation and revision-conflict errors.

Suggested resource shapes, subject to contract review:

```text
POST /journeys
GET  /journeys
GET  /journeys/{journey_id}
PUT  /journeys/{journey_id}
```

Journey deletion can be deferred unless it is required to complete the first
frontend path. Do not implement broad generic CRUD merely for symmetry.

### 5.2 Minimum Agent creation transaction

Provide one atomic operation for clicking an empty Slot:

```text
validate Journey + Slot + expected revision
→ create Agent identity and AgentWorkflow
→ create minimum Start → End graph and layout
→ append/update the Journey Agent summary
→ assign the Agent to the Slot
→ increment revision(s)
→ commit once
```

Failure must not leave an orphan Agent, partial Slot assignment or advanced
revision. The response must contain enough canonical data for the frontend to
replace its local snapshot and navigate to the new Agent Workflow.

### 5.3 Pattern immutability

This original handoff's Pattern replacement proposal is superseded. In V1,
`pattern.id`, `pattern.kind`, and `pattern.templateKey` are immutable after Journey
creation. There is no replacement endpoint. A user who needs another Pattern deletes the
Journey and creates a new one, following the confirmed destructive Journey-delete path.

Do not silently reinterpret legacy stored `diamond_loop` documents. Migration
or compatibility handling must be explicit.

### 5.4 Occupied Slot removal

Removing a configured Slot may affect both Journey Pattern state and an
AgentWorkflow. It requires confirmation data and an atomic service operation.
Empty-Slot removal may continue through ordinary Journey save if the domain
candidate has already been validated.

## 6. Consistency and security requirements

- Scope every query and mutation to the authenticated/current Workspace. If
  authentication is not yet wired, use an explicit development Workspace
  dependency; do not trust a client-supplied unrestricted `workspace_id`.
- Validate UUIDs and complete request bodies at the API boundary.
- Validate stored/returned JSON aggregates against backend canonical models.
- Use optimistic concurrency: update only when the expected revision matches,
  increment exactly once per committed aggregate mutation, and return a stable
  conflict response containing the current server revision.
- Keep selection, open menus, drag state, preview state, pixel coordinates and
  other frontend session data out of persistence.
- Do not expose SQLAlchemy models directly as response DTOs.
- Transactions that touch Journey and AgentWorkflow must use one database
  session/transaction and roll back completely on failure.
- Produce stable machine-readable error codes; final localized UI copy belongs
  to the frontend.

## 7. Suggested backend layering

```text
FastAPI router / validated DTO
→ application service / transaction boundary
→ Pattern and aggregate domain helpers
→ repository queries
→ SQLAlchemy models + PostgreSQL
```

Routers should remain thin. Pattern instantiation and topology validation must
not be duplicated ad hoc across create, replace and Slot endpoints. If Python
cannot directly reuse the TypeScript implementation, establish parity fixtures
and contract tests against `packages/schemas` examples.

## 8. Deliverables for the backend Codex

1. Write an implementation plan in this `backend/` directory before coding.
2. Record the final endpoint/DTO/error/revision contract.
3. Add Pydantic boundary models and runtime validation.
4. Add repository/application services with explicit transaction boundaries.
5. Add routers and register them in the FastAPI application.
6. Add or adjust Alembic migration only when the existing schema cannot support
   the accepted contract; explain why before changing the schema.
7. Add unit, service transaction and HTTP integration tests.
8. Provide frontend handoff examples for success, validation failure, not found
   and revision conflict.

## 9. Acceptance criteria

- A user can create at least four independent Journeys, one for each built-in
  Pattern, and reload them from PostgreSQL.
- Create returns a valid canonical Pattern with generated UUID identities and
  revision `>= 1`.
- Concurrent save with a stale revision cannot overwrite newer state.
- Minimum Agent creation and Slot assignment are atomic.
- Pattern identity is immutable after creation and no replacement endpoint exists.
- Transaction failure tests prove no partial Journey/Agent state remains.
- Workspace isolation tests prevent cross-Workspace reads and writes.
- API tests cover successful and structured failure responses.
- Ruff and the complete `apps/api` pytest suite pass.

## 10. Resolved implementation decisions

The contract review and M2.4B implementation plan resolve the original coordination gates:

- Current Workspace comes from an explicit server-side development dependency and is never
  accepted from the client; production without a real identity source fails closed.
- Journey creation accepts `name`, nullable `description`, and one built-in
  `patternTemplateKey`.
- Pattern identity and provenance are immutable after Journey creation. Changing Pattern
  requires confirmed Journey deletion followed by creation of another Journey.
- Journey deletion uses quoted `If-Match`, returns `204`, cascades Journey-owned data, and
  preserves independent Templates and Knowledge Spaces.
- Occupied Slot removal is an explicit atomic command. It either discards the Agent or saves
  a complete Agent Template and then discards it; it never silently creates an unassigned
  Agent. Ordinary Journey save may unassign an Agent while retaining its Slot, but may not
  remove an occupied Slot.
- Circular Loop entry deletion promotes its execution-order successor. Legacy four-role
  `diamond_loop` data returns `LEGACY_PATTERN_UNSUPPORTED` and is never silently migrated.
- Stable HTTP error envelopes and 404/409/422 mappings are frozen in the implementation
  plan; transport-only failures remain frontend adapter concerns.

See [`m2.4b-journey-persistence-api-implementation-plan.md`](./m2.4b-journey-persistence-api-implementation-plan.md)
for the executable batches, DTOs, transaction boundaries and verification gates.
