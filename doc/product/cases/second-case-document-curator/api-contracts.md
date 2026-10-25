# Document Curator: Assumed API Contracts

> Status: Fictional V0.1 contracts for discussing the Workflow and configuring API Request tools.
> Date: 2026-10-25
> Base URL: https://curator.example.invalid
> No server, mock API, authentication implementation, or kernel is delivered. The .invalid host is intentionally non-operational.

Read alongside [Workflow DSL](./document-curator.ody) and [Workflow Design](./workflow-design.md). The following contracts explain what the four API Request steps pretend to call, not endpoints available in Odyssey today.

## 1. API-to-Workflow mapping

All requests use POST and Content-Type: application/json. The JSON response body is what the System Tool exposes as response.data: do not wrap the example body in another data property.

| Endpoint | Workflow node / step | Purpose | Request variable | Response variable |
| --- | --- | --- | --- | --- |
| /context | Read Document Context / read_context | Read the changed source, existing annotations, local evidence, ownership, versions, and all three Playbook rules | change_event | context |
| /validate | Validate Proposal / validate | Validate and normalize the proposal; decide whether review is required | validation_request = { context, proposal } | validation |
| /apply | Apply Validated Changes / apply | Commit the complete eligible change set, or return no_change | validation | result |
| /reviews | Save Review Proposal / save_review | Save the whole candidate for later human review without applying target changes | validation | result |

The surrounding Task scripts only assemble the validation request and enforce valid === true plus a boolean requiresReview. They do not perform authoritative permission, semantic-support, or database freshness checks.

## 2. Example conventions

The linked JSON files are complete, parseable static examples. They use readable example identities and fake tokens, not real persisted UUIDs, authentication credentials, signed authorizations, or current API DTOs. No compatibility with existing backend endpoints is implied.

For brevity, the context example uses a deliberately small source document and proposes only its Summary. This illustrates the contract; it is not the complete Rainy Day Activities scenario or its final expected relationship count. Full texts of all three current policy documents are embedded rather than replaced with ellipses. The API's future deployment configuration, not the event payload, chooses and authorizes the Playbook binding.

A context snapshot does not grant authority simply because the client submits it. The future service must bind a context token/identity to the authenticated workspace, producer, target, revisions, and policy snapshot; verify it or reload authoritative state. Re-read required current state at commit. Tokens shown here have no security meaning.

## 3. POST /context — Read Curator Context

**Purpose:** Assemble exact input for the Agent Action, not a semantic-search substitute for source or policy loading.

- [Request](./api-examples/01-context-request.json): a static example of the system change_event payload; the DSL no longer declares a user-managed event default.
- [Response](./api-examples/01-context-response.json): current source, annotations/ownership, tags, incident relationships, relevant documents, complete policies, read set, and coverage flags.

The service resolves the requested document within the authenticated, explicitly configured target. User-supplied KS names and paths are selectors, never authorization. Check the event source revision, source readability, complete rule loading, and target access before returning usable context. Do not assert complete coverage after dropping required pagination or evidence.

Expected rejection: missing/unreadable source, missing policy, unauthorized target, or a stale event revision. Duplicate-event short-circuiting is a future invocation-layer behavior, not a context response the current DSL already knows how to branch on.

## 4. POST /validate — Validate Curator Proposal

**Purpose:** Produce the authoritative decision and preserve the complete candidate for the selected route.

- [Auto-eligible request](./api-examples/02-validate-request.json)
- [Auto-eligible response](./api-examples/02-validate-response.json)
- [Review-required request](./api-examples/02-validate-review-request.json)
- [Review-required response](./api-examples/02-validate-review-response.json)

Request is exactly { context, proposal }, matching the build_request script. Proposal has operations and findings arrays. Operation-specific shapes are provisional; set_summary and new_tag_request illustrate a metadata operation and a finding, not newly registered System Tool kinds or Manifest V1 enums.

Check structure, scope, concrete identities, evidence locations/revisions, ownership, allowed changes, and no-ops. Mechanically matching a passage does not prove semantic truth. Unsupported interpretations, conflicts, new tags, protected changes, removals, and non-reference relationships require review. Invalid concrete operations are rejected rather than authorized by a reviewer.

A successful response always has valid: true and a boolean requiresReview. It includes the normalized whole proposal, reasons, protected read set, and a validation identity bound to those exact contents. requiresReview is not supplied by the model.

- false: all effective operations are eligible, or the candidate is an eligible no-op with no findings.
- true: at least one valid review condition exists; retain all otherwise-safe operations pending review too.

The current draft's Branch explicitly applies only when requires_review == false; Default leads to review. The preceding script rejects a malformed/non-boolean decision. It must not be interpreted as a fallback authorization mechanism.

## 5. POST /apply — Apply Curator Changes

**Purpose:** Perform the entire validated eligible change set, not arbitrary client JSON.

- [Request](./api-examples/03-apply-request.json): exactly the auto-eligible /validate response.
- [Response](./api-examples/03-apply-response.json): actual committed outcome and receipt.

Reject requiresReview: true, modified/expired authorization, wrong scope, or stale source/graph/policy/evidence revisions. Recheck producer ownership and permissions. Commit all operations plus the durable receipt atomically; preserve unrelated graph data, issues, and source text.

An eligible empty candidate returns status: no_change, appliedOperationCount: 0, and the unchanged graph revision; it is not an error or an extra Branch. A replay returns the original receipt with replayed: true and no second mutation. The graph revision is an optimistic-concurrency snapshot, not a counter increment on every call.

## 6. POST /reviews — Save Curator Review

**Purpose:** Persist a reviewable proposal, not approve or apply it.

- [Request](./api-examples/04-review-request.json): exactly the review-required /validate response.
- [Response](./api-examples/04-review-response.json): review_required, a stable review record identity, and zero applied operations.

Require a valid, current review-bound candidate with requiresReview: true. Save evidence, prior/proposed values, reasons, target scope, and reviewed revisions. Preserve all pending changes without applying a safe subset. Replays reuse the existing review record. Source/graph changes before saving require revalidation rather than storing an actionable stale approval request.

The example's graph revision remains 12 because review storage does not mutate the game graph. Optional graph-issue publication and later human approval/application are separate operations outside this Workflow.

## 7. Errors and future executor behavior

Illustrative errors share this shape:

```json
{
  "error": {
    "code": "STALE_CONTEXT",
    "message": "A protected revision changed. Prepare a fresh context."
  }
}
```

| HTTP status | Example code | Meaning |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Malformed input or unsupported operation |
| 403 | SCOPE_DENIED | Caller has no permission for the requested scope |
| 404 | DOCUMENT_NOT_FOUND | Source or concrete target cannot be resolved |
| 409 | STALE_CONTEXT | Source, graph, evidence, or policy snapshot changed |
| 409 | VALIDATION_ROUTE_MISMATCH | Review-only candidate submitted to apply, or the reverse |
| 422 | INVALID_PROPOSAL | A concrete candidate fails validation; no authorization issued |
| 503 | DEPENDENCY_UNAVAILABLE | Required reader/storage service is unavailable |

These are proposed case-level codes, not changes to Odyssey's current HTTP error contract. A future API Request executor must treat non-success HTTP responses as tool failures before writing output variables. The DSL uses on_failure fail_task. No kernel or such failure handling is claimed today. Failure must never leave partial graph changes or be exposed as applied/review_required success.

## 8. Remaining execution gap

These static API contracts do not supply Agent Action structured-output delivery into agent.proposal, dynamic retrieval arguments, event subscriptions, credentials, or a kernel. Authentication/secret injection belongs to future deployment configuration; do not paste secrets into shared DSL. We can review the full tool/data design now without developing any of these services.

## Runtime binding update — DSL 0.2

The generic Workflow consumes `$sys.change_event$` as the `/context` request body. A future trusted document-change adapter resolves the owning Workspace and Knowledge Space and provides `$sys.target_knowledge_space$`, `$sys.document_id$`, and `$sys.document_revision$`. The fixed Document Curator Playbook remains deployment configuration. Retrieval and Agent Action Knowledge use the event KS binding, so the Workflow is reusable across target spaces.

The example JSON is a demonstration payload, not a producer credential or an authorization grant. A request's readable target name/path does not override the authenticated event target. The future context service must validate producer identity, document ownership, target identity and revisions against authoritative state, and reject disagreement. No adapter, runtime injection, retrieval execution, API deployment or Agent Action structured output executor is implemented by the DSL/editor change.
