# Second Case: Document Curator — Knowledge Design

> Status: Agreed case direction; document inventory and maintenance boundaries recorded for subsequent design.
> Date: 2026-10-25
> Pattern: Solo
> Language: English for the case, source documents, maintenance rules, and acceptance materials.
> Scope: Design only. This document does not deliver source fixtures, Workflow DSL, event subscriptions, or graph-write tools.

## 1. Purpose

Document Curator responds to one document being added or updated. It generates metadata and proposes updates to the affected local relationships in a Knowledge Space. A useful demonstration must show which existing documents and relationships a single change affects, and which remain untouched.

Continue the fictional Moonberry Island setting from [First Case: Knowledge Q&A](../first-case-knowledge-qa/README.md). Preserve the first case as an independent fixture: prepare a separate Curator demo Knowledge Space or snapshot rather than modifying the original Q&A package in place.

The initial case has five game documents, one incoming document, and three maintenance-rule documents. The incoming document is not part of the initial graph. Maintenance rules are distinct from the game knowledge being maintained.

## 2. Separate content from maintenance instructions

| Collection | Purpose | Curator access | Included in the game KB? |
| --- | --- | --- | --- |
| Game knowledge | The documents and relationships under maintenance | Read source content; propose permitted annotations and local graph changes | Yes |
| Curator maintenance rules | Metadata quality, relation semantics, application and review boundaries | Explicitly supplied as trusted configuration or a separate rule resource | No |
| Scenario and expected-result materials | Inputs and evaluator expectations | Test harness/evaluator only | No |

Do not upload maintenance rules or expected answers into the game Knowledge Space. Game documents are evidence, not instructions granting authority to change content. Whether rules are supplied as a separate Knowledge Space or explicit configuration remains a later execution-design choice.

## 3. Game document inventory

The first four documents reuse the first case's content as a starting point. The fifth introduces explicit location descriptions. Prepare reviewed cross-references when authoring this case; do not assume a relation exists merely because this inventory lists two documents.

| File | Title | Role | Initial state |
| --- | --- | --- | --- |
| 01-getting-started.md | Getting Started | Entry guide referencing crops, fishing, and shops | In the initial KB |
| 02-crops-and-seasons.md | Crops & Seasons | Crop seasons, growth time, watering, and harvest rules | In the initial KB |
| 03-fishing-guide.md | Fishing Guide | Fish locations, weather, season, and time conditions | In the initial KB |
| 04-village-and-shops.md | Village & Shops | Shop hours, goods, and prices | In the initial KB |
| 05-island-map-and-locations.md | Island Map & Locations | Defines Willow Pond, Starfall Beach, and relevant village locations; provides relationship targets | In the initial KB |
| 06-rainy-day-activities.md | Rainy Day Activities | Combines rain-related farming and fishing advice with references to existing rules and locations | Kept in incoming/ until the addition scenario |

Only the first five files are uploaded before the first scenario. The initial graph should be known and reviewed so a before/after comparison is possible. A future baseline manifest can seed annotations and relations using the existing manifest import path. Import is fixture preparation, not the Curator's document-change trigger or graph-write capability.

## 4. Curator maintenance-rule inventory

| File | Title | Rules to specify during authoring |
| --- | --- | --- |
| [metadata-guidelines.md](./maintenance-rules/metadata-guidelines.md) | Metadata Guidelines | Meaning and quality of Summary, Guide, and tags; concise grounded descriptions; no invented facts; existing-tag reuse |
| [relationship-guidelines.md](./maintenance-rules/relationship-guidelines.md) | Relationship Guidelines | When references, explains, related_to, and other supported relation kinds apply; source/target direction; evidence requirements; avoid connecting documents solely because they share keywords |
| [review-and-change-policy.md](./maintenance-rules/review-and-change-policy.md) | Review & Change Policy | Which changes may be applied automatically, which require review, local scope limits, and prohibition on source-text rewriting |

The three linked English rule documents are now authored as version 0.1 case-policy proposals for review. They define an initial allowlist (owned metadata, existing-tag additions, and explicit references), require review for new tags/removals/conflicts, and route an entire candidate to review when any operation needs review. Exact execution payloads and tool contracts remain to be designed. These rules are not game facts.

### Import the Document Curator Playbook

Create a separate Knowledge Space named **Document Curator Playbook**, under Category **Agent Playbooks**.

Description: Guidelines for curating document metadata, maintaining evidence-backed relationships, and reviewing local knowledge changes.

1. Upload the three maintenance-rule Markdown files directly to this Knowledge Space's root. Do not upload the whole repository folder as a nested maintenance-rules/ directory.
2. In Graph Overview → Import manifest, select [maintenance-rules/manifest.json](./maintenance-rules/manifest.json), validate the file matches, inspect the preview, and apply.
3. On a fresh Playbook space, expect **3 matched documents, 3 tags, 6 directed reference relations, and 0 issues**, with a healthy graph. Each rule explicitly references the other two; both directions are intentional and separately evidenced.
4. Keep the same manifest key on repeat imports to retain idempotent managed identities. If documents were uploaded into a subfolder, update their manifest paths to match before validation.

Manifest paths are relative to the uploaded Knowledge Space root, not the repository. The manifest annotates existing documents; it does not upload source content. Do not upload manifest.json, this design README, or game documents as Playbook source documents. Do not import this manifest into Moonberry Island Guide.

The rules remain V0.1 proposals for review. A healthy graph means no graph-review issues are declared; it does not approve policy content, establish trusted authority, or confirm text indexing. Indexed is the current manifest annotation status, not proof of retrieval readiness. Assign the Playbook's authority and scope explicitly in the Agent configuration, and verify actual retrieval separately.

## 5. Scenario A: Add Rainy Day Activities

### Before

The five initial game documents and their reviewed baseline graph exist. Rainy Day Activities is outside the KB in incoming/.

### Change

Upload Rainy Day Activities as a new document. It explains rain watering outdoor crops and Silverfin fishing under the existing Fishing Guide conditions. It points to relevant locations in Island Map & Locations.

### Expected behavior

- Read the new source document and generate a grounded Summary, Guide, and tag suggestions.
- Find relevant existing documents, particularly Crops & Seasons, Fishing Guide, and Island Map & Locations.
- Propose evidence-backed relationships with explicit kinds and directions, following Relationship Guidelines.
- Validate all target references and the permitted local scope before applying or requesting review.
- Preserve existing source text and unrelated metadata and relationships.

The expected local relationship targets are named here; their exact edge kinds and acceptance counts must be fixed when the source fixtures and rule documents are authored.

## 6. Scenario B: Update Fishing Guide and surface a local conflict

Run this scenario after Scenario A, so Rainy Day Activities is present and still reflects the earlier fishing rule.

### Change

Update the Silverfin weather condition in Fishing Guide. Rainy Day Activities continues to state the earlier condition. The exact revised wording and before/after versions will be authored as scenario fixtures; this document does not silently change the first case's game rules.

### Expected behavior

- Process the updated Fishing Guide revision rather than stale source content.
- Refresh its affected metadata and inspect locally connected documents.
- Detect the mismatch with Rainy Day Activities and prepare a reviewable issue or proposed change with evidence from both versions/documents.
- Do not decide automatically which rule is authoritative simply because one document changed later.
- Do not rewrite Rainy Day Activities, the original Fishing Guide text, or unrelated documents.
- Keep unaffected graph relationships intact.

This is local impact review, not a whole-space audit. Knowledge Steward remains responsible for periodic global reconciliation, duplicates, broken links, and other cross-space-wide consistency work.

## 7. Supporting case materials

Prepare these separately from the imported KB:

| Material | Purpose |
| --- | --- |
| Document Change Scenarios | Scenario ordering, add/update inputs, before/after document versions, expected revision information |
| Expected Changes | Expected metadata and relation changes, preserved state, evidence, and human-review outcomes |

Record the baseline and actual changes so acceptance can test scope preservation as well as newly created output. Expected-result documents must never become retrieval evidence for the Curator.

## 8. Workflow direction

See [Detailed Workflow Design](./workflow-design.md) for the V0.2 simplified design: Prepare Context → Agent Action → Validate Proposal → one review Branch → Apply or Save Review → the shared Solo End. It defines tool/KS assignments, data contracts, and static scenarios. There is no kernel yet: no new System Tool types, real APIs, or mock APIs are required at this stage. Earlier two-Branch/four-disposition sketches are superseded; a design-only DSL draft is now linked below.

## 9. Maintenance boundaries and future execution requirements

The agreed boundaries are:

- Never rewrite game source documents.
- Limit an event to the changed document and evidence-backed local impact; do not rebuild the entire graph.
- Separate permitted automatic updates from review-required changes.
- Preserve unrelated metadata, source documents, and relationships.
- Treat possible contradictions as review items rather than resolving authority without evidence.

Execution design must additionally specify event identity, source revision checks, idempotency, change provenance, write atomicity, and stale-result handling. Replaying one event must not duplicate tags, relations, or review issues. These are requirements to resolve before implementation, not claims that existing manifest import implements them.

## 10. Next deliverables

1. Review the three maintenance-rule documents; then author the five baseline game documents and incoming Rainy Day Activities in English.
2. Prepare baseline graph data and explicit scenario inputs, including the updated Fishing Guide variant.
3. Write Expected Changes with preservation and human-review checks.
4. Review the simplified Workflow, specify tool configuration/data contracts and static examples, then design the Solo Workflow DSL using existing node and tool types; do not implement real or mock APIs now.

The knowledge design and three maintenance-rule documents are available. Game source fixtures, scenario variants, a game-KB baseline manifest remain future deliverables. The design-only Workflow DSL draft is linked below. A separate Playbook manifest is now provided for importing the three maintenance rules.

## Workflow DSL draft

[document-curator.ody](./document-curator.ody): design-only Solo configuration using sequential Task tools, one independent Agent Action, and one Branch. API URLs are non-operational placeholders; no kernel, API, or mock service is supplied. See workflow-design.md section 15 for explicit tool steps and the Agent Action output-contract gap.

Assumed API contracts and complete static request/response examples are available in [API Contracts](./api-contracts.md). They match the four API Request steps in document-curator.ody; no real or mock API is implemented.
