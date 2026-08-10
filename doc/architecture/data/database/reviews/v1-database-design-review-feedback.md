# Odyssey V1 Database Design Review Feedback

> Review target: [`doc/architecture/data/database/reviews/v1-database-design-review-draft.md`](./v1-database-design-review-draft.md)  
> Purpose: provide actionable requirements for the next Codex to revise and finalize the V1 database design  
> Review date: 2026-08-10  
> Scope: database design and persistence contracts only; this document does not request implementation of migrations or ORM models

> Product decision update (2026-08-10): a Knowledge Space is fundamentally a graph. `KnowledgeTag` and resource-tag assignments are the persisted, flexible grouping mechanism. A “Knowledge Family” is a read-only UI projection derived from Tags, not a first-class database entity. This confirmed decision supersedes older documents that model Family and Family membership as independent records.

> Follow-up review update (2026-08-10): the latest revised draft has closed the original Template lineage, KS reference protection, Journey publication, constraint-strategy, public-Template sanitization, Tag/Family modeling, virtual-root Folder, `graph_status`, document-status, default-Category, outbox-schema, and affected-object Issue findings. The design is now conditionally approved. Before implementation, only the outbox worker lease/recovery contract in Section 3.8 remains required; the accompanying P2 constraints should be frozen while writing the migration.

## 1. Review conclusion

The current draft has a sound core direction for Journey editing:

- `PatternConfig`, `WorkflowGraph`, and `CanvasLayout` use schema-validated JSONB;
- semantic workflow data and Canvas presentation data remain separate;
- Agent Variables and AgentReusableTools are first-class records;
- Task-local Variables and Task-owned Tool steps remain inside the owning Task Node JSON;
- Knowledge Space references remain in canonical JSON while relational reference tables support deletion protection and reverse lookup;
- V1 persists the current configuration with optimistic concurrency and does not require Workflow Version, Journey Release, or runtime execution tables;
- Template instantiation creates independent snapshots rather than live-linked instances;
- uploaded file binaries use object storage rather than PostgreSQL.

However, the draft is **not yet sufficient as the final Odyssey V1 database design**. It covers most of the Journey/Agent/Workflow editing aggregate, but it does not fully cover the accepted Knowledge Space product specification, and several deletion, integrity, publication, and security rules remain ambiguous.

The next revision should resolve every P1 item below before generating SQLAlchemy models or Alembic migrations.

## 2. Source-of-truth precedence

The repository contains older documents whose versioning recommendations conflict with the accepted V1 constraints. Use the following precedence when revising the design:

1. [`doc/architecture/domain/odyssey-v1-design-constraints.md`](../../../domain/odyssey-v1-design-constraints.md) — accepted V1 product and persistence constraints.
2. [`doc/architecture/data/contracts/canonical-json-contracts-draft.md`](../../contracts/canonical-json-contracts-draft.md) — current canonical JSON boundaries and reference semantics.
3. [`doc/product/feature-specifications/knowledge-space/knowledge-space-specification.md`](../../../../product/feature-specifications/knowledge-space/knowledge-space-specification.md) — Knowledge Space UI-facing domain requirements.
4. Other detail-design documents for node, Tool, Variable, and UI requirements.
5. [`doc/planning/implementation/v1-implementation-plan.md`](../../../../planning/implementation/v1-implementation-plan.md) and [`doc/architecture/data/database/Odyssey Database Design.md`](../Odyssey%20Database%20Design.md) — useful historical context, but their Workflow Version/Publish recommendations are superseded where they conflict with accepted constraints.

In particular, V1 uses the current configuration plus `revision`; it does not require Workflow Version history or Journey Release records.

For Knowledge Space grouping, the confirmed product decision is authoritative over the older `knowledge-space-specification.md` distinction between Tag and Family:

- persist `knowledge_tag` and the many-to-many Resource/Tag assignment;
- allow one Resource to carry multiple Tags and therefore participate in multiple projected graph regions;
- derive the Family label, member count, graph container, and other read-only presentation from a Tag and its assigned Resources;
- do not create `knowledge_family` or `knowledge_family_resource` tables in V1;
- do not introduce a second Family membership truth alongside Tag assignments;
- if the UI continues to use the term “Knowledge Family,” document that it is a projection, not an independently editable domain object.

## 3. P1 — required corrections

### 3.1 Complete the Knowledge Space persistence model

The current draft only defines a simplified Knowledge Space/file tree/graph model. It must be reconciled with `knowledge-space-specification.md`.

At minimum, the final design must explicitly decide and document persistence for the following concepts.

#### Knowledge Space lifecycle and graph quality

Do not use one status field for both operational lifecycle and graph quality.

Required fields or equivalent representations:

```text
knowledge_space.lifecycle_status
  INITIALIZING | READY | SYNCING | FAILED | ARCHIVED

knowledge_space.graph_status
  NOT_INDEXED | HEALTHY | NEEDS_REVIEW | ERROR
```

Also define:

- `archived_at`, if archive time is displayed or audited;
- `last_document_indexed_at`;
- `last_steward_run_at`;
- `latest_graph_snapshot_id`, if graph snapshots are retained;
- `revision` for concurrent metadata edits.

#### Workspace categories

The Knowledge Space list requires categories. Add a `workspace_category` table or explicitly revise the product specification if categories are being removed from V1.

Recommended minimum structure:

```text
workspace_category
  id
  workspace_id
  name
  normalized_name
  color_token
  sort_order
  created_at
  updated_at
```

Each active Knowledge Space must reference exactly one category. Define the behavior when a category is deleted: normally `RESTRICT` while Knowledge Spaces still reference it, or an atomic move to a default category.

#### Document metadata

Extend `knowledge_resource` or justify an alternative model for:

- index status;
- summary and guide/description produced for the Inspector;
- `last_indexed_at`;
- content hash/checksum;
- storage provider, bucket, and object key, or a documented invariant that provider/bucket are deployment-global;
- MIME type and byte size.

Only `file` must be implemented as a resource type in V1, but the schema may retain an extensible `resource_type`.

#### Knowledge tags

The Knowledge Space specification distinguishes folder organization from semantic tags. Add:

- `knowledge_tag`;
- `knowledge_resource_tag` or `document_tag_assignment`;
- source, confidence, user-confirmation, and timestamps where required by the UI/domain model.

Do not store tags only as an unstructured array on the resource if they require independent rename, color, filtering, provenance, or many-to-many assignments.

#### Knowledge graph metadata

The final design must decide whether V1 persists the following seed/mock graph metadata:

- Knowledge Tags and Resource/Tag assignments used to project Knowledge Families;
- directed Knowledge Relations;
- Graph Issues and the affected resources/relations;
- graph snapshots.

V1 does not require the automatic indexing engine, Steward scheduler, or execution runtime. Nevertheless, the read-only graph, issue display, Inspector, and seeded demo data need a persistence source.

If `ody_journey_run` is intentionally excluded because runtime execution is out of scope, document how seed/mock issues and snapshots record provenance without it. Do not accidentally introduce a general execution-engine schema just to support the Knowledge Space UI.

#### Derived counters

Document whether the following values are queried, cached, or denormalized:

- file count;
- projected Knowledge Family count, defined as the number of Tags with at least one assigned Resource;
- open issue count.

If cached, define the transaction/update mechanism. If queried, define the required indexes. They must not be freely editable user fields.

### 3.2 Fix Template lineage deletion semantics

For each self-referencing Template lineage column:

```text
pattern_template.source_template_id
agent_template.source_template_id
tool_template.source_template_id
```

use nullable foreign keys with `ON DELETE SET NULL`, unless a stronger documented reason exists.

This is required because forked Templates are independent snapshots and must remain valid if their source Template is deleted. The lineage relation must not cause deletion propagation and should not indefinitely block deletion of the source.

The existing rule for `agent_reusable_tool.source_template_id -> tool_template.id ON DELETE SET NULL` should remain.

### 3.3 Correct Knowledge Space deletion protection

Knowledge Space deletion must be restricted by all direct-reference indexes, not only Workflow and Agent Template references.

Protection must cover:

```text
agent_workflow_knowledge_space_reference
agent_template_knowledge_space_reference
tool_template_knowledge_space_reference
```

The delete operation should return structured reference information that the UI can display. Public Templates that have already converted private asset references into dependency slots must not retain author-owned Knowledge Space reference rows.

### 3.4 Define cross-record ownership invariants

The final design must explicitly list which invariants are database-enforced and which are transactionally enforced by the service layer.

Required invariants include:

- a parent Folder belongs to the same Knowledge Space as its child;
- a Resource's Folder belongs to the same Knowledge Space as the Resource;
- both sides of a Resource/Tag assignment belong to the same Knowledge Space;
- both endpoints of a Knowledge Relation belong to the relation's Knowledge Space;
- a Workflow or Template may only directly reference a Knowledge Space accessible in its Workspace;
- a Pattern Slot may reference only an AgentWorkflow belonging to the same Journey;
- one AgentWorkflow may occupy at most one Pattern Slot in a Journey;
- an AgentReusableTool reference used by a node belongs to the same AgentWorkflow;
- `agent_reusable_tool.source_template_id`, when present, references a Tool Template with a compatible `kind`;
- every `owner_id` in a derived Knowledge Space reference row exists at a schema-defined location inside the saved canonical JSON;
- a derived reference table and its canonical JSON are replaced atomically in one transaction.

Composite foreign keys may be used where practical. Where JSON ownership prevents a foreign key, require authoritative service validation and transaction tests.

### 3.5 Make public Template sanitization enforceable

The final draft currently says that public Templates cannot expose secrets or private Knowledge Space data, but it does not define a reliable enforcement mechanism.

Specify at least:

- how sensitive Tool configuration fields are declared, preferably through metadata in `tool_definition.configuration_schema`;
- which literal values are forbidden in exportable/public snapshots;
- how private Knowledge Space UUID references are discovered from typed schema fields;
- how those references are replaced with dependency slots;
- that arbitrary recursive string scanning is not the reference-discovery algorithm;
- that validation, snapshot transformation, reference-index replacement, and publication state changes occur in one transaction;
- that failed sanitization rejects publication without partially changing the Template;
- that public snapshots contain neither private KS UUIDs/names/files nor credentials.

A future secret vault is out of scope, but V1 still needs deterministic rejection rules for public/exportable content.

### 3.6 Resolve Journey publication semantics

`odyssey-v1-design-constraints.md` declares Journey publish/release selection out of scope. The current database draft nevertheless includes `ody_journey.status = published` and `published_at`.

Choose one consistent V1 design:

- preferred: Journey lifecycle uses only states actually supported by V1, such as `draft` and `archived`, with no `published_at`; or
- explicitly document that `published` fields are reserved, inaccessible through V1 APIs, and have no V1 behavior.

Do not confuse Journey publication with Template publication. Template `visibility` and `publication_status` remain relevant because private/public Templates are accepted requirements.

### 3.7 Follow-up corrections after the revised draft

The following items were open after the first revision. The latest database draft now resolves them and should preserve these decisions during implementation.

#### Declare the virtual-root Folder model

The revised draft uses `knowledge_folder.parent_folder_id = NULL` for a top-level Folder and `knowledge_resource.folder_id = NULL` for a file placed directly in the Knowledge Space root. This is a valid virtual-root model, but it conflicts with older UI-facing contracts that expose a persisted `rootFolderId`, require exactly one root Folder, and require every document to reference one Folder.

The final design should explicitly adopt the following V1 contract:

```text
The Knowledge Space root is a virtual API/UI node and has no knowledge_folder row.
parent_folder_id = NULL means a first-level Folder under that virtual root.
folder_id = NULL means a Resource located directly under that virtual root.
```

Document this as a product decision that supersedes the older persisted-root invariant. API DTOs and frontend tree adapters must generate the same stable virtual-root representation without inventing a database UUID. Tests must cover top-level sibling uniqueness and root-file moves.

#### Make `graph_status` authoritative and deterministic

The revised draft persists both `knowledge_space.graph_status` and current `graph_issue` records. It must define how those facts remain consistent.

For V1, retain `graph_status` as a query-friendly cached field, but make it system-managed. Normal clients must not submit it directly. Every transaction that creates, resolves, dismisses, accepts, or deletes an Issue—or removes an affected Resource/Relation—must recompute it using one domain service.

Recommended baseline:

```text
no usable current graph                       -> not_indexed
one or more open blocking error Issues        -> error
one or more open warning Issues               -> needs_review
otherwise, when a usable current graph exists -> healthy
```

The final design must define “usable current graph” without relying on a deferred Graph Snapshot, and must define whether `accepted`, `resolved`, and `dismissed` Issues cease to affect status. Seed/mock import must use the same recomputation logic.

#### Complete document index statuses

Add the UI/domain states omitted by the revised draft:

```text
pending
indexing
indexed
needs_review
unsupported
failed
```

`unsupported` represents a retained file that Odyssey cannot index. `needs_review` represents a document-level review condition. If either state is intentionally removed, record the decision in the deferred-feature/UI-impact section and update the Knowledge Space UI contract.

#### Enforce the default Workspace Category

If every Workspace has one undeletable default Category, add an explicit field and uniqueness rule:

```text
workspace_category.is_default BOOLEAN NOT NULL DEFAULT false
UNIQUE (workspace_id) WHERE is_default = true
```

The service must reject deletion of the default Category. Workspace bootstrap must create it atomically, and tests must cover concurrent attempts to create a second default.

#### Either design the storage deletion outbox or remove the promise

The revised draft requires retryable outbox/job deletion for object-storage files but does not define an outbox record. If transactional outbox is the V1 mechanism, add a minimal first-class table, lifecycle, indexes, and idempotency rules, for example:

```text
storage_object_deletion_outbox
  id
  storage_provider
  storage_bucket
  object_key
  status
  attempt_count
  next_attempt_at
  last_error
  created_at
  completed_at
```

The database deletion and outbox insertion must commit atomically. Worker retries must treat an already-missing object as success. If V1 instead uses synchronous deletion and compensation, remove the outbox/job requirement and specify that strategy consistently.

#### Prevent affected-object Issues from silently becoming KS-level Issues

Deleting a Resource or Relation currently cascades its Issue assignment while retaining the Issue. An open Issue that only described the deleted object must not silently become an unscoped Knowledge Space Issue.

Distinguish an intentionally KS-level Issue explicitly, for example with `scope = knowledge_space | affected_objects`. During Resource/Relation deletion:

- retain an affected-object Issue if another affected object remains;
- delete or resolve it when no affected object remains;
- retain an assignment-free Issue only when its declared scope is `knowledge_space`;
- recompute `graph_status` in the same transaction.

### 3.8 Final required correction: outbox worker lease and crash recovery

The latest draft defines `storage_object_deletion_outbox` and uses `FOR UPDATE SKIP LOCKED`, but a row changed to `processing` can remain stuck forever if the worker crashes after committing the claim and before completing object deletion. A database row lock only protects the claim transaction; it does not provide a durable processing lease.

Add a nullable lease field:

```text
lease_expires_at TIMESTAMPTZ NULL
```

Required claim/recovery behavior:

1. A worker may claim `pending` or `retry` rows whose `next_attempt_at <= now()`.
2. A worker may also reclaim `processing` rows whose `lease_expires_at <= now()`.
3. Claiming atomically sets `status = processing` and a new `lease_expires_at`.
4. Successful deletion sets `status = completed`, sets `completed_at`, and clears the lease.
5. Retry or terminal failure sets `status = retry` or `failed`, updates attempts/error/timing, and clears the lease.
6. An already-missing object remains an idempotent success.

Add indexes that cover normal claims and expired-lease recovery:

```text
(status, next_attempt_at)
(status, lease_expires_at)
```

Freeze these consistency rules in named CHECK constraints where practical and enforce all state transitions in one repository/service path:

```text
status = completed  => completed_at IS NOT NULL
status <> completed => completed_at IS NULL
status = processing => lease_expires_at IS NOT NULL
status <> processing => lease_expires_at IS NULL
```

Define `idempotency_key` as a fixed-length cryptographic digest of the canonical storage location rather than concatenating an unbounded `TEXT` object key into `VARCHAR(255)`, for example SHA-256 over `provider + NUL + bucket + NUL + object_key`. Object keys must remain non-reusable.

Additional P2 clarifications to freeze during implementation:

- reopening an Issue clears `resolved_at`;
- `accepted`, `resolved`, and `dismissed` use `resolved_at` as their terminal-state timestamp in V1;
- Workspace creation cannot bypass the bootstrap service that atomically creates its default Category;
- integration tests must prove that a failed bootstrap cannot leave a Workspace without a default Category.

## 4. P2 — schema hardening

### 4.1 Freeze enum and CHECK strategies

Replace ambiguous `ENUM/VARCHAR` wording with a concrete PostgreSQL strategy for every controlled field.

At minimum define constraints for:

- Journey lifecycle status;
- Template source, visibility, and publication status;
- Variable data type and ownership;
- Knowledge Space lifecycle and graph status;
- document index status;
- resource type;
- Knowledge Tag metadata and any state used by the projected Family UI;
- relation kind/type and status;
- reference `owner_kind`;
- Tool Definition source/category where closed sets are intended.

Using PostgreSQL enum types or `VARCHAR + CHECK` is acceptable, but the migration and ORM must agree.

### 4.2 Add scalar integrity checks

Recommended database checks include:

```text
revision >= 1
size_bytes >= 0
confidence BETWEEN 0 AND 1
sort_order >= 0, where negative ordering is not meaningful
source_resource_id <> target_resource_id, unless self-relations are explicitly supported
published_at IS NOT NULL when publication_status = 'published'
published_at IS NULL when publication_status = 'draft', unless publication history semantics say otherwise
```

For JSONB fields, consider lightweight top-level checks such as ensuring `tags` is an array. Full semantic validation remains in Pydantic/canonical schema validation.

### 4.3 Define Template source invariants

Express built-in/user Template rules as named CHECK constraints, for example:

```text
source = 'built_in'
  => workspace_id IS NULL AND template_key IS NOT NULL

source = 'user'
  => workspace_id IS NOT NULL
```

Also define:

- whether a user Template may have a provenance `template_key`;
- uniqueness of non-null built-in `template_key`;
- whether built-in records are always public/published;
- which fields normal user CRUD APIs may mutate.

### 4.4 Clarify normalized-name behavior

For AgentWorkflow, Knowledge Space, Folder, Category, and any other case-insensitive unique names, define one backend normalization function:

```text
trim
Unicode normalization
case folding
```

Clients must not submit the authoritative normalized value. Add tests for case-only differences, Unicode-equivalent strings, root-folder null uniqueness, and concurrent inserts.

For Folder sibling uniqueness, handle PostgreSQL `NULL` semantics using `NULLS NOT DISTINCT` when the supported PostgreSQL version permits it, or two partial unique indexes.

### 4.5 Specify timestamps and update behavior

Define whether `updated_at` is maintained by application writes, database triggers, or explicit update statements. A Python-side SQLAlchemy `onupdate` does not cover raw SQL, bulk updates, or every database write path.

The chosen approach must be consistent across migrations, ORM behavior, revision updates, and tests.

## 5. Required deletion matrix

The final design should include a complete FK/delete matrix. The expected baseline is:

| Parent/relationship | Expected delete behavior |
| --- | --- |
| Workspace -> Journey | Normally `RESTRICT` in V1 because Workspace delete is not exposed; avoid accidental broad cascade |
| Workspace -> user Templates | Same explicit Workspace lifecycle policy |
| Workspace -> Knowledge Space | Same explicit Workspace lifecycle policy |
| Journey -> AgentWorkflow | `CASCADE` after explicit destructive confirmation |
| AgentWorkflow -> AgentVariable | `CASCADE` |
| AgentWorkflow -> AgentReusableTool | `CASCADE` |
| AgentWorkflow -> Workflow KS reference | `CASCADE` |
| Tool Template -> AgentReusableTool source provenance | `SET NULL` |
| Template source -> forked Template lineage | `SET NULL` |
| Knowledge Space -> direct reference index rows | `RESTRICT` through the reference relationship |
| Knowledge Space -> Folder/Resource/graph metadata | Delete only through the explicit KS deletion workflow; document whether DB uses `CASCADE` after reference checks |
| Folder -> child Folder | `RESTRICT` |
| Folder -> Resource | `RESTRICT` until resources are moved or deleted |
| Resource/Tag -> ResourceTag assignment | `CASCADE`; the assignment is the sole persisted truth for projected Family membership |
| Resource -> active Knowledge Relation | Define `CASCADE` or explicit service deletion; do not leave dangling edges |
| Template -> its KS reference-index rows | `CASCADE` |

The document must distinguish user confirmation requirements from FK behavior. UI confirmation alone is not a relational integrity rule.

## 6. Index requirements

Retain the indexes already proposed in the draft and add indexes required by the completed Knowledge Space model.

Minimum candidates:

- every foreign-key column;
- Journey list by `(workspace_id, status, updated_at)` as appropriate to actual queries;
- Agent unique name within Journey;
- Variable key within AgentWorkflow;
- Template library filtering by source/visibility/publication/tags/update time;
- Template lineage source ID;
- Knowledge Space unique normalized name within Workspace;
- Category ordering within Workspace;
- sibling Folder lookup/uniqueness;
- Resource lookup by Knowledge Space and Folder;
- document index status;
- Resource/Tag assignments indexed in both directions;
- Relations by source and target;
- open Graph Issues by Knowledge Space, resolution status, and severity;
- every KS reference table by `knowledge_space_id` and by its owning aggregate ID.

Do not add a generic GIN index to `workflow_graph` solely for arbitrary node search in V1. Typed relational reference indexes should handle deletion checks and reverse KS lookup.

## 7. Current code is not the target schema

The existing SQLAlchemy models and initial migration are foundation code only. They currently:

- keep `agent_workflow.current_version_id`;
- omit `revision` and `normalized_name`;
- use the old Agent Variable shape;
- use a single `tool_configuration` field for AgentReusableTool;
- omit Template and Tool Definition tables;
- omit all Knowledge Space tables and reference indexes;
- do not configure the target cascade/restrict/set-null behaviors.

Do not judge the revised design complete merely because it matches the existing models. After the design is accepted, the initial migration may be rewritten because the repository has no business data.

## 8. Deliverables requested from the next Codex

Revise [`doc/architecture/data/database/reviews/v1-database-design-review-draft.md`](./v1-database-design-review-draft.md) into a final implementation-ready database design. The revision should include:

1. a clear statement of V1 scope and authoritative source documents;
2. a complete ER diagram including the accepted Knowledge Space subset;
3. table-by-table fields, nullability, PKs, FKs, unique constraints, CHECK constraints, and defaults;
4. a complete FK/delete behavior matrix;
5. explicit first-class-record versus JSONB boundaries;
6. reference-index generation and transaction semantics;
7. public Template dependency-slot and sanitization semantics;
8. normalized-name rules;
9. optimistic concurrency rules for every independently mutable aggregate;
10. index definitions tied to V1 query patterns;
11. a section listing deliberately deferred Knowledge Space/runtime features;
12. a migration implementation checklist, without necessarily writing the migration in the same task;
13. a document-conflict resolution note explaining which older Version/Publish recommendations were superseded.

If a Knowledge Space feature from `knowledge-space-specification.md` is deliberately deferred, list it explicitly with its UI impact. Do not silently omit it.

## 9. Acceptance checklist

The database design is ready for implementation only when all answers below are yes.

- [ ] Can a user create, edit, autosave, reload, and concurrently protect the current Journey configuration?
- [ ] Can all four accepted Pattern templates persist stable Slots and Routes without storing derived canvas coordinates?
- [ ] Can an Agent Template snapshot fully recreate WorkflowGraph, CanvasLayout, Variables, ReusableTools, and typed external references with ID remapping?
- [ ] Can a public Template be proven free of private KS references and literal secret fields before publication?
- [ ] Can a Knowledge Space provide the list, file tree, read-only graph, Inspector, Tags, Tag-derived Family projections, Relations, and issue/status data required by the accepted V1 UI scope without a second Family membership truth?
- [x] Is the virtual-root Folder contract explicit and consistent across database, API DTOs, and the frontend tree adapter?
- [x] Is `graph_status` system-managed and recomputed deterministically whenever current graph Issues or affected objects change?
- [x] Can document metadata represent `needs_review` and `unsupported` as well as ordinary indexing states?
- [x] Is exactly one default Category enforced per Workspace and protected from deletion?
- [x] Is object-storage deletion backed by a defined transactional outbox?
- [x] Can deleting a Resource or Relation avoid silently converting an affected-object Issue into a KS-level Issue?
- [ ] Can a crashed outbox worker's expired `processing` task be reclaimed through a durable lease, with state/timestamp consistency and idempotent retry tests?
- [ ] Can deleting or replacing a Pattern atomically preserve selected Agent Templates, delete discarded Agents, and replace PatternConfig?
- [ ] Can every Knowledge Space deletion be blocked by Workflow, Agent Template, and Tool Template references?
- [ ] Can deleting a source Template leave forks and instantiated objects valid?
- [ ] Can Folder, Resource, Tag assignment, Relation, and Workspace ownership invariants avoid cross-aggregate mismatches?
- [ ] Are all controlled values and scalar ranges constrained consistently in PostgreSQL, SQLAlchemy, Pydantic, and TypeScript?
- [ ] Are JSON updates and derived reference-index updates committed atomically?
- [ ] Are runtime execution, tracing, scheduling, secret vault, Workflow Version history, and Journey Release tables absent from V1 unless explicitly re-approved?

## 10. Final recommendation

Keep the current Journey/Agent/Workflow JSONB strategy and the confirmed Tag-derived Family projection. The latest draft has resolved the original domain and relational findings and is conditionally approved as the Odyssey V1 implementation baseline. Before generating the final migration, add the durable outbox lease/recovery contract from Section 3.8. Freeze the listed P2 timestamp, idempotency-key, Issue-reopen, and default-Category bootstrap rules during ORM/migration implementation; they do not require another domain-model redesign.
