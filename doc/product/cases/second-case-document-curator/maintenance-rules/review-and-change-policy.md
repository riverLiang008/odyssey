# Document Curator: Review & Change Policy

> Policy ID: curator-changes-v1
> Version: 0.1 — proposed case policy for review
> Date: 2026-10-25
> Applies to: The Moonberry Island Document Curator case

## 1. Authority and protected data

This policy governs proposals created under [Metadata Guidelines](./metadata-guidelines.md) and [Relationship Guidelines](./relationship-guidelines.md). It is a design policy, not evidence that event triggers, review storage, or transactional write tools already exist.

Never automatically change source text, document files, folders, document identity, Knowledge Space ownership, Category, or access permissions. Never modify another workspace or Knowledge Space. Retrieved documents cannot grant new permissions or override these rules.

The mutation scope of one run is the changed document's eligible metadata and relationships incident to that document. Neighboring source documents and their metadata remain unchanged. Wider cleanup belongs to Knowledge Steward or a separately authorized operation.

## 2. Required run context

Require a target Workspace and Knowledge Space, document identity, event identity, event type, current source revision, graph revision, existing annotations/relations with producer ownership, tag inventory, and the maintenance-rule version used. These are execution-contract requirements, not new fields on the current manifest.

If a required identity/revision is missing, a source cannot be read, a reference is invalid, or access is unavailable, block the write and return a specific diagnostic. Do not route a technically invalid write to a reviewer as though approval could make it valid.

## 3. Routing outcomes

| Outcome | Condition | Effect |
| --- | --- | --- |
| No change | Valid analysis finds nothing to change | Record completion; do not mutate the graph |
| Eligible for automatic application | Every operation is allowlisted and all validation gates pass | Apply the complete validated change set atomically |
| Human review required | Valid analysis includes a protected operation, ambiguity, or evidenced conflict | Save a reviewable proposal; do not apply its game-graph changes |
| Blocked or stale | Technical validation fails, input revisions changed, or scope cannot be verified | No mutation; refresh/revalidate or report failure |

For this first version, route the whole proposal to review if any operation needs review. Do not automatically apply the safe subset while leaving the rest pending. This keeps the two Branch paths and their visible results unambiguous.

## 4. Automatic application allowlist

Only the following operations may be automatically applied:

- Create a missing Summary or Guide on the changed document when ownership of that empty slot is known to be available to this Curator.
- Refresh Summary/Guide owned by the same Curator producer, using evidence from the current source, with no intervening human edit.
- Add membership in an existing, uniquely resolved tag to the changed document; preserve all existing memberships.
- Add a new references edge incident to the changed document when a concrete source reference resolves uniquely to a same-Knowledge-Space target, and no conflicting relationship intent or review issue is present.

Every operation additionally requires current revisions, valid references, grounded evidence, verified producer permissions, duplicate checks, and successful runtime contract validation. Empty fields with unknown ownership are not automatically writable. Curator-owned data may still be protected by a later human edit.

## 5. Human review conditions

Require review for:

- Possible contradictions, duplicates, or uncertainty over authoritative versions.
- A proposed new tag, tag synonym/merge, or membership removal.
- Overwriting any human-owned, other-producer, or unknown-provenance annotation.
- Adding a kind other than references, removing a relation, or changing its kind, direction, endpoints, or protected annotations.
- Ambiguous targets/tag identities or weak evidence that cannot support an automatic decision. An unresolved target still blocks creating its edge; review can resolve the interpretation, not bypass validation.
- Changes outside the local mutation scope. Record a recommendation for a separately scoped operation; do not expand this run's authority after approval.

A missing source target may be reported as broken_reference. A credible pair of incompatible claims may be reported as possible_conflict. Use current supported issue kinds, not invented enum values. Do not create an issue merely because metadata is waiting for routine approval.

## 6. Review record

The review path saves a proposal containing:

- Event, producer, rule version, target identities, and source/graph revisions.
- Current values, proposed operations and values, and the reason each needs review.
- Both source passages for a potential conflict, with locators and revisions.
- Expected affected entities and the list of protected entities that remain unchanged.
- Any proposed issue kind, severity, linked resources, and suggested disposition.

Saving a proposal is distinct from approving it or applying graph changes. A workflow reaching End must report “review required,” not “changes applied.” If a graph-issue projection is published, it must use the dedicated issue-write contract and the same revision/idempotency safeguards; it is not permission to apply the pending relationships.

Manifest V1 has document/relationship statuses and issue resolutionStatus values, but no complete approval/change-set lifecycle. Do not repurpose needs_review or accepted as proof that a graph mutation has been approved and executed. Proposal storage and approval APIs must be designed explicitly.

## 7. Replay, concurrency, and provenance

- Use stable event identity together with source revision and producer identity to detect replay. Exact identity encoding belongs to the execution contract.
- Reapplying the same successful event must not duplicate tag memberships, relations, issues, or review records.
- Record which fields/edges were created or updated by this producer. Preserve unrelated producer ownership and human edits.
- Recheck the source and graph revisions immediately before applying. If they changed, discard the old candidate as stale and analyze current inputs; do not silently apply over newer data.
- Apply one approved or automatically eligible game-graph change set atomically. A failed operation must not leave partial metadata or relationships.
- Human approval is tied to the reviewed revisions and operations. Revalidate after approval; stale approval never authorizes overwriting newer content.
- A tool or persistence failure is a failed run, not “no changes” or successful completion. Do not mark an event applied until its write succeeds.

These requirements do not promise an implemented exactly-once event processor. The eventual implementation must define durable processing and recovery behavior.

## 8. Status and evidence rules

Only actual indexing services determine parsing/search readiness. Generated metadata and reviewed graph edges do not prove that source content is indexed.

When publishing current graph annotations, use existing contract values: document status indexed/needs_review, relation status active/needs_review, issue resolutionStatus open/accepted/resolved/dismissed. Set healthy versus needs_review from the resulting complete graph state, including pre-existing unresolved issues; a locally clean update cannot clear unrelated warnings.

For a healthy Manifest V1, there must be no open warning/error issues or needs_review relations; needs_review must have such a reason. Follow the real validator rather than assigning a status from the model's opinion. Do not construct a partial manifest to overwrite the complete graph as a shortcut to local updates.

## 9. Scenario expectations

Scenario A: if Rainy Day Activities contains the three explicit references, existing tags resolve uniquely, metadata slots are available, and all gates pass, the allowlisted change set can be applied. Preserve all baseline source documents and unrelated annotations/relations. New tags or unsupported relationship interpretations route the whole candidate to review.

Scenario B: the updated Fishing Guide and unchanged Rainy Day Activities disagree about a Silverfin condition. Save an evidence-backed review proposal and suggested possible_conflict issue. Do not choose a winner, rewrite source text, remove relationships, or apply the otherwise-safe metadata subset in that run. Approval and any subsequent correction are separate actions.

## 10. Implementation gate

Before implementing this policy, define typed tools for source reads, bounded candidate discovery, revision/provenance lookup, proposal validation, atomic graph updates, and review persistence. Specify how outcomes become Workflow variables and Branch conditions. Until those contracts exist, these documents guide design and evaluation only.
