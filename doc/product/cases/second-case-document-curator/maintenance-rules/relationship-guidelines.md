# Document Curator: Relationship Guidelines

> Policy ID: curator-relationships-v1
> Version: 0.1 — proposed case policy for review
> Date: 2026-10-25
> Applies to: The Moonberry Island Document Curator case

## 1. Purpose and scope

Propose document relationships supported by current source evidence. Follow [Metadata Guidelines](./metadata-guidelines.md) and [Review & Change Policy](./review-and-change-policy.md).

Every proposed relationship must involve the changed document as source or target. Read its existing incoming/outgoing neighbors and resolve explicit references in its source. Bounded candidate retrieval may discover additional same-Knowledge-Space documents; only inspect candidates supported by a concrete reference or shared claim. Do not recursively traverse all neighbors or reconcile the entire graph. Retrieval limits belong to the later execution contract.

## 2. Supported kinds and direction

Use only kinds supported by the current knowledge graph contract:

| Kind | Meaning and direction | Evidence requirement | First-version application |
| --- | --- | --- | --- |
| references | A → B: A explicitly refers readers to B | A named document/link/reference in A and an unambiguous match to B | Eligible for automatic addition if every change-policy gate passes |
| builds_on | A → B: A depends on concepts or procedures established in B | Specific dependency, not merely the same topic | Human review |
| explains | A → B: A explains or elaborates a specific concept or statement in B | Identified subject in B and explanatory passage in A | Human review |
| supports | A → B: A supplies evidence for a particular claim in B | Matching claim, compatible context, and supporting passage | Human review |
| contradicts | A → B: A presents a claim incompatible with a claim in B | Both passages, matching entity and conditions, and a clear incompatibility | Human review; no authority decision |
| supersedes | A → B: A explicitly replaces B | Explicit replacement statement or trusted version/authority metadata | Human review; newer timestamps alone are insufficient |
| related_to | A → B: A and B have a concrete, evidenced association without a more precise kind | A useful explanation grounded in both documents | Human review |

All stored relationships have source and target, including related_to. For a new related_to pair with no existing orientation, order the two stable document IDs lexicographically to avoid generating mirror edges. This is a case-level convention, not a change to the graph schema. Preserve existing orientation; a reverse or differently typed existing edge requires review before normalization.

A contradicts edge does not mean its source is correct. A related_to edge does not mean the relationship should be duplicated in both directions. Do not create inverse edges unless separately supported and intentionally approved.

## 3. References versus topical similarity

An explicit reference includes a resolvable filename, document title, or link that identifies a particular document. A place name alone is not an explicit reference to Island Map & Locations.

For example:

- Rainy Day Activities says “See Crops & Seasons for watering rules”: propose Rainy Day Activities → Crops & Seasons as references.
- It says “Consult Fishing Guide for Silverfin conditions”: propose a references edge to Fishing Guide.
- It says “See Island Map & Locations for Willow Pond”: propose a references edge to the map guide.
- It merely mentions Willow Pond: do not invent an explicit map reference; a possible related_to proposal needs evidence and review.

These examples specify expected behavior when the future source fixtures contain the quoted references. They do not establish that those documents have already been authored.

## 4. Validate targets and evidence

Before proposing an edge:

1. Resolve both documents to stable identities in the same target Knowledge Space. A title-only match with multiple candidates is ambiguous.
2. Verify that the current source versions still contain the evidence.
3. Reject self-relations and references outside the permitted workspace/Knowledge Space.
4. Check existing relations for the same source, target, and kind. Reuse the existing edge; do not duplicate it or change its identity on replay.
5. Preserve relationships managed by another producer or a human. Do not reassign their provenance.
6. Provide a plain-English description of why this relationship exists, not just a similarity score.

Do not infer facts from filenames, folder proximity, tag overlap, embedding similarity, or search rank alone. Those can identify candidates, not establish a relationship.

Confidence is optional in the current graph schema. Leave it unset unless a defined, recorded scoring method exists. A model-generated high number does not authorize automatic application; this version uses explicit evidence and validation gates rather than a numerical threshold.

## 5. Updates and removals

An update may strengthen, invalidate, or make a previous relation uncertain. Preserve an existing relationship when its evidence remains valid. If evidence disappears or a target no longer resolves, propose a review item rather than deleting or repointing an edge automatically.

All relation removals, direction changes, kind changes, and updates to human/other-producer edges require review. A replacement kind is a proposed removal plus addition; do not disguise it as an ordinary automatic addition.

## 6. Local conflict detection

Compare claims about the same entity under the same conditions before reporting a conflict. For Silverfin, inspect location, season, weather, and time together. Different conditions may describe compatible rules.

In Scenario B, Fishing Guide changes a weather condition while Rainy Day Activities retains the old condition. Record both current passages, document revisions, and the exact incompatible rule. Do not choose the updated document as authoritative merely because it was changed later. Do not rewrite either document or mark one as superseded without replacement evidence.

Use a possible_conflict review issue when justified by evidence. A missing explicit target can justify broken_reference; a text typo or weak similarity alone is not a confirmed conflict. Keep the issue's title and message precise and avoid overstating certainty.

## 7. Proposal and acceptance

A reviewable relationship proposal identifies kind, source/target identities and revisions, evidence locators and passages, description, existing matching edges, proposed operation, and application eligibility. This is application proposal data; Manifest V1 does not include all those fields.

Scenario A should resolve the three explicit source references when the incoming fixture provides them. Scenario B must route a supported conflict to review while preserving unrelated relationships. Exact relation counts depend on the authored source fixtures and will be fixed in Expected Changes, not invented here.
