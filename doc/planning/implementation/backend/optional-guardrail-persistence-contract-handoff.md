# Optional Guardrail Persistence Contract — Backend Handoff

> Status: Frontend blocked pending backend contract and implementation  
> Scope: Journey-owned optional Input/Output Guardrail persistence and atomic lifecycle commands  
> Frontend plan: [`../frontend/guardrail-single-agent-interaction-implementation-plan.md`](../frontend/guardrail-single-agent-interaction-implementation-plan.md)  
> Authoritative engineering guideline: [`backend-engineering-guidelines.md`](../../../backend-engineering-guidelines.md)

## 1. Confirmed product contract

- Input and Output Guardrail are independently optional and inactive by default.
- A Guardrail is not a user-selectable Pattern.
- Enabling a side creates exactly one Journey-owned Guardrail Agent.
- Its structural kind is fixed `single` and must not be represented as the Journey's Main Execution Pattern.
- The Agent receives the same minimal `Start → End` Workflow as a normal minimal Agent.
- Removing a Guardrail permanently deletes its Agent and Workflow.
- Removal never saves an Agent Template.
- Add/Remove are destructive aggregate commands and must be atomic, Workspace-scoped and revision-aware.

## 2. Current OpenAPI gap (verified 2026-08-22)

The running `http://127.0.0.1:8000/openapi.json` currently exposes:

- `JourneyEditorDocument = journey + pattern + agents` only;
- ordinary Pattern Slot Agent creation;
- occupied Pattern Slot removal;
- no Guardrail projection;
- no Guardrail Add command;
- no Guardrail Remove command.

The frontend cannot implement refresh-safe Guardrails without these contracts. Ordinary Pattern Slot endpoints and `PUT /journeys/{id}` are not acceptable substitutes because Guardrails are outside Main Execution Pattern and lifecycle operations require a single transaction.

## 3. Required response projection

Freeze a strict discriminated representation equivalent to:

```text
inputGuardrail:
  { state: "inactive" }
  | { state: "active", structure: "single", agentId: UUID }

outputGuardrail:
  { state: "inactive" }
  | { state: "active", structure: "single", agentId: UUID }
```

Requirements:

- Both fields are explicit in `JourneyEditorDocument`; do not overload `pattern.configuration`.
- `structure` accepts only `single` in V1.
- An active projection must reference exactly one Agent present in `agents`.
- An inactive projection cannot retain an Agent reference.
- Stored JSON and assembled response must receive canonical validation.
- TypeScript schema, Python DTO, canonical fixtures and OpenAPI examples must remain in parity.

Exact naming may follow established repository conventions, but the inactive/active distinction must not be encoded as several unrelated optional booleans/IDs.

## 4. Required Add command

Recommended transport:

```http
POST /api/v1/journeys/{journey_id}/guardrails/{side}/commands/add
Content-Type: application/json

{
  "expectedRevision": 3
}
```

where `side` is strictly `input | output`.

Successful response (`201`) should include:

```text
journey: latest JourneyEditorDocument
agent: created AgentWorkflowEditorDocument
```

One application transaction must:

1. resolve Current Workspace server-side;
2. load/CAS the Journey at `expectedRevision`;
3. reject an already-active side with `STATE_CONFLICT`;
4. create the Journey-owned Agent identity with a stable default display name;
5. create a valid minimal Start node, End node, connecting edge and initial CanvasLayout;
6. bind the Agent to the requested Guardrail side with fixed `single` structure;
7. increment Journey revision exactly once;
8. validate and return the latest aggregate plus Agent workflow.

Any failure must roll back Agent, Workflow, binding and revision together.

## 5. Required Remove command

Recommended transport:

```http
POST /api/v1/journeys/{journey_id}/guardrails/{side}/commands/remove
Content-Type: application/json

{
  "expectedRevision": 4,
  "expectedAgentId": "..."
}
```

Successful response (`200`) should return the latest `JourneyEditorDocument`.

One transaction must:

1. resolve Current Workspace server-side;
2. CAS the Journey at `expectedRevision`;
3. reject an inactive side or mismatched Agent with `STATE_CONFLICT`;
4. remove the Guardrail binding;
5. permanently delete the owned Agent and Workflow graph/layout/configuration;
6. not create an Agent Template;
7. increment Journey revision exactly once;
8. validate and return the latest aggregate.

## 6. Stable errors

Both commands must expose the existing canonical envelope and distinguish:

- `VALIDATION_FAILED`: invalid side/body/header shape;
- `NOT_FOUND`: Journey is not visible in Current Workspace;
- `REVISION_CONFLICT`: stale expected revision with current revision details;
- `STATE_CONFLICT`: already active, already inactive, expected Agent mismatch, or corrupted binding;
- `CURRENT_WORKSPACE_UNAVAILABLE`.

Suggested stable `STATE_CONFLICT.details.reason` values:

```text
GUARDRAIL_ALREADY_ACTIVE
GUARDRAIL_ALREADY_INACTIVE
GUARDRAIL_AGENT_MISMATCH
GUARDRAIL_STATE_INVALID
```

## 7. Required backend proof

- DTO strict positive/negative tests for side, add and remove bodies;
- canonical schema parity tests;
- pure domain invariant tests for both sides and illegal state combinations;
- PostgreSQL transaction tests proving Add rollback at each failure stage;
- PostgreSQL transaction tests proving Remove rollback and owned deletion;
- concurrent CAS test: only one of two Add requests succeeds;
- stale Remove cannot delete the newer Guardrail;
- cross-Workspace Add/Remove return `NOT_FOUND` without leakage;
- response aggregate validation catches corrupted active references;
- OpenAPI examples for success, state conflict and revision conflict;
- Ruff and full backend pytest suite pass.

## 8. Frontend unblock signal

Frontend implementation can resume only when the running OpenAPI exposes:

1. Guardrail projection in `JourneyEditorDocument`;
2. atomic Add command;
3. atomic Remove command;
4. strict request/response DTOs and canonical error envelopes.

Once ready, notify the frontend Codex to regenerate/extend runtime schemas and repository adapters from the final contract. Do not ask the frontend to infer Guardrail state from Agent names, Pattern configuration, or hidden Slot roles.

