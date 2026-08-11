# Odyssey V1 Contract Source Mapping

> Status: M2.1 implementation baseline  
> Schema version: `1.0.0`  
> Frozen: 2026-08-11  
> Canonical source: [`canonical-json-contracts-draft.md`](./canonical-json-contracts-draft.md)

## 1. Purpose

This document fixes the source-of-truth order used while implementing `@odyssey/schemas`. It prevents database rows, ORM implementation details, Vue Flow objects, and Figma layers from silently redefining the frozen V1 JSON contract.

## 2. Source precedence

When sources disagree, use this order:

1. Accepted V1 domain constraints.
2. Frozen Canonical JSON Schema `1.0.0`.
3. Approved V1 database implementation baseline for aggregate and relational boundaries.
4. Pydantic API DTOs once they exist.
5. SQLAlchemy models and Alembic migrations as implementation evidence only.
6. Figma as visual and interaction evidence only.

The current Alembic foundation migration is not a contract source. It still contains superseded fields such as `agent_workflow.current_version_id` and does not yet represent the approved database baseline.

## 3. Contract layers

| Layer | Owns | Must not contain |
| --- | --- | --- |
| Canonical persistence JSON | PatternConfig, WorkflowGraph, CanvasLayout, typed node/tool configuration | Vue Flow state, component state, database column names |
| Database persistence | Aggregate columns, JSONB/row split, FK/index/delete constraints, revision CAS | Canvas view model, editor selection and panels |
| API transport | Request/response representation, links/summaries, error transport | SQLAlchemy objects, ZIP paths in normal CRUD |
| Editor projection | Page-oriented aggregate plus summaries | `normalized_name`, JSONB naming, reference-index rows |
| Canvas view model | Vue Flow nodes/edges/viewport adapters | Repository payload and public contract authority |
| UI session | Selection, panel, focus, mode, drag session | Persisted document payload |

## 4. Aggregate mapping

| Canonical/editor concept | Database implementation boundary | Frontend contract rule |
| --- | --- | --- |
| Journey metadata | `ody_journey` columns | camelCase editor/API projection; no ORM field names |
| PatternConfig | `ody_journey.pattern_config` JSONB | canonical JSON is authoritative |
| Journey revision | `ody_journey.revision` | integer `>= 1`; independent from Agent revision |
| Agent identity | `agent_workflow` columns | omit `normalized_name` from editor projection |
| WorkflowGraph | `agent_workflow.workflow_graph` JSONB | semantic nodes/edges only; no coordinates |
| CanvasLayout | `agent_workflow.canvas_layout` JSONB | placements and viewport only; no node config/UI state |
| Agent revision | `agent_workflow.revision` | independent compare-and-swap aggregate |
| Agent variables | `agent_variable` rows | projected into Agent editor document as canonical array |
| Agent reusable tools | `agent_reusable_tool` rows | projected into Agent editor document as canonical array |
| Task-local variables | owning Task node JSON | never promoted to `agent_variable` rows |
| Task tool steps | owning Task node JSON | array order is execution order |
| KS references | typed Workflow/Tool JSON + derived relation indexes | typed JSON is editable truth; index rows are not editor DTOs |
| Templates | template row + snapshot JSONB | template snapshot follows canonical schema; DB ownership fields map to API/editor names |

## 5. Frozen naming decisions

| Existing/threatened name | Frozen contract name | Reason |
| --- | --- | --- |
| `nodePositions` | `nodePlacements` | canonical layout field |
| `sourceHandle` | `sourceHandleId` | stable Branch Case UUID, not Vue Flow naming |
| `targetHandle` | no persisted field unless canonical review adds it | must not be introduced for library convenience |
| `slotId` as object identity field | `PatternSlot.id` | canonical nested UUID convention |
| `agentInstanceId` | `agentId` | frozen Pattern contract |
| `draft_graph` | `workflowGraph` / `workflow_graph` by boundary | V1 has one current configuration, not versioned drafts |
| `current_version_id` | absent | Workflow Version is out of V1 scope |
| `normalized_name` | absent from editor contract | persistence-only uniqueness support |
| Vue Flow `position` | CanvasLayout placement | third-party view-model field cannot enter domain JSON |

## 6. Closed sets to keep aligned

| Concept | Frozen values |
| --- | --- |
| Schema version | `1.0.0` |
| Journey status | `draft`, `archived` |
| Pattern kind | `hub_and_spoke`, `diamond_loop`, `linear_sequence`, `solo_component` |
| Variable ownership | `user_managed`, `shared`, `agent_managed` |
| Variable data type | `string`, `number`, `boolean`, `json` |
| Top-level Workflow node | `start`, `end`, `agent_action`, `task`, `branch`, `loop` |
| Loop boundary node | `loop_start`, `loop_end` |
| Built-in Tool kind | `set_variable`, `api_request`, `knowledge_retrieval`, `script_execution`, `llm_call` |

Database `VARCHAR + CHECK`, Python/Pydantic enums, and TypeScript runtime schemas must use the same allowed values. Adding a value requires a coordinated contract change; it must not be accepted only by one layer.

## 7. M2.1 freeze scope

Frozen for M2.1:

- identifiers, schema version, revision and timestamps;
- Pattern, Workflow, Loop, Variable, Tool and Layout JSON structures;
- editor aggregate ownership and revision boundaries;
- Knowledge Space reference locations;
- repository error categories and expected-revision semantics.

Not frozen by M2.1:

- HTTP endpoint paths;
- JSON Patch versus aggregate replacement on the wire;
- Pinia state shape;
- Vue Flow node data;
- component props/emits;
- autosave debounce duration;
- import/export package and single-file size limits.

## 8. Change rule

Any implementation-discovered mismatch must be resolved by updating the authoritative contract through explicit review. Do not fix a mismatch by weakening runtime validation, adding `any`, copying ORM fields into editor types, or persisting component/Canvas state.
