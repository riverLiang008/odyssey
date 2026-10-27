# First Case: Moonberry Island Guide — Knowledge Q&A

> Status: Case design for review; execution capability is not yet delivered.
> Date: 2026-10-23
> Pattern: Solo (canonical kind: solo_component)
> Language: English throughout the design, DSL, knowledge documents, and acceptance questions.

## Quick links: Workflow DSL and graph import

| File | Use |
| --- | --- |
| [knowledge-qa-task.ody](./knowledge-qa-task.ody) | Complete Workflow DSL with explicit retrieval and answer output mappings; recommended first |
| [knowledge-qa-agent-action.ody](./knowledge-qa-agent-action.ody) | Single Agent Action with assigned knowledge and a reusable retrieval tool |
| [manifest.json](./manifest.json) | Reviewed Manifest V1 for the four knowledge documents and their graph |
| [knowledge-space/](./knowledge-space/) | The four source Markdown files to upload |
| [acceptance.md](./acceptance.md) | Evaluation questions; do not upload |

The .ody files are plain text: open either file and copy its complete content into the Agent's DSL Edit panel. They configure an existing Solo Agent Workflow, not the Journey Pattern.

## 1. Goal and scope

A user asks a question about one designated Knowledge Space. The workflow retrieves relevant evidence and produces a short answer with sources. This is single-turn knowledge Q&A, without multi-round research, web search, knowledge maintenance, or workflow generation.

The case uses four guides for Moonberry Island, a fictional cozy farming game. These documents are the complete source of truth for the demo rules; no real game, company policies, or outside knowledge is required.

- [Agent Action DSL](./knowledge-qa-agent-action.ody): Start → Answer Question → End, with retrieval invoked by the Agent Action.
- [Task DSL](./knowledge-qa-task.ody): the same two-step flow with explicit tool output mappings; recommended for the first input/output contract acceptance run.
- [Knowledge documents](./knowledge-space/): upload only the four Markdown files in this directory.
- [Acceptance questions and evidence](./acceptance.md): for evaluators only; do not upload this answer key to the Knowledge Space.

## 2. Solo Pattern

Create an OdyJourney named Moonberry Island Guide, select Solo, and assign one Agent named Island Guide to its single Slot. There are no cross-Agent routes or direction controls. Pattern synchronization provides one root End that completes the Journey. The Workflow defines the internal connections to that End.

```text
OdyJourney: Moonberry Island Guide
└─ Solo Slot: Island Guide Agent
   ├─ Task variant: Start → Retrieve Documents → Generate Answer → End
   └─ Agent Action variant: Start → Answer Question → End
```

The current DSL describes one Agent Workflow, not a Journey or Pattern. This case introduces no pattern {} syntax. Create the Solo Journey, assign the Agent, and synchronize its exit in the product before applying the DSL. The end; declaration reuses the existing End UUID and binding; it does not create a Pattern exit.

Reference: [Pattern-to-End contract](../../../architecture/execution/pattern-agent-end-routing-decision.md).

## 3. Knowledge Space setup

Create a uniquely named Knowledge Space: `Moonberry Island Guide`. Upload the four files in knowledge-space/. A flat folder is sufficient; folders organize files and do not define semantic categories. Wait until file content is readable, indexed, and retrievable. An inventory entry alone does not prove that document indexing is complete.

| Document | Topics |
| --- | --- |
| 01-getting-started.md | Starter items, energy, rest, first-day plan |
| 02-crops-and-seasons.md | Seasons, crops, watering, harvest timing |
| 03-fishing-guide.md | Fish locations, weather, seasons, time windows |
| 04-village-and-shops.md | Shop hours, seeds, rod price, snacks |

After uploading the four Markdown files directly to the Knowledge Space root, open Graph Overview → Import manifest, select [manifest.json](./manifest.json), validate, review the preview, and apply. Expected result on a fresh space: 4 matched documents, 4 tags, 6 directed reference relations, 0 issues, and a healthy graph. Tags provide family memberships; no separate Family aggregate is declared.

Manifest paths are relative to the Knowledge Space root, not to this repository. Upload the four files individually at the root; do not create a knowledge-space/ wrapper folder unless you also update all document paths in the manifest. Server validation must match all four existing files before Apply. The manifest does not upload or create their content.

Do not upload manifest.json as a Knowledge Document. Keep README.md, acceptance.md, and the .ody files outside the Knowledge Space. Reimport the same unchanged manifest using its stable key for idempotent updates. If files are moved, update paths and validate again; resolve revision conflicts through the import dialog before applying.

This is a reviewed demo graph fixture. Its indexed document statuses and healthy graph status describe graph annotations; they do not create embeddings, implement retrieval, or prove that the text is searchable. Verify actual indexing and retrieval separately. No artificial conflicts or issues are introduced in this first case.

Document Curator and Knowledge Steward are outside this case; document ingestion and indexing are prerequisites. The assistant answers questions only; it does not control a game or purchase items.

## 4. Inputs, variables, and output

| Key | Type / ownership | Purpose |
| --- | --- | --- |
| question | string / user_managed | The question supplied before a run; its default is an example |
| retrieved_documents | json / shared | Written by the retrieval Task or reusable tool; stores current-run evidence |
| answer | string / shared | The complete answer, including sources and evidence gaps |

Start every run with a fresh execution context and initialize intermediate values from DSL defaults. Never show a previous run's answer as the current result. The run entry point rejects empty or whitespace-only questions; no Branch is added. Variable declarations do not automatically create input controls or an output view.

Answer in English: give the direct answer first, then sources such as `[01-getting-started.md / Energy]`. Cite only documents and passages returned by the current retrieval. Do not invent page numbers, links, characters, or game rules. For partially supported questions, answer the supported part and identify what is missing. For unsupported questions, state that the current knowledge base cannot establish the answer.

## 5. Workflow and DSL variants

The Task variant uses Start → Retrieve Documents → Generate Answer → End. Retrieval is a fixed step before the llm_call step, with explicit output mappings to retrieved_documents and answer.

The Agent Action variant uses Start → Answer Question → End. The node has:

- `knowledge ["Moonberry Island Guide"]`: the Knowledge Space assigned to this action; this does not itself perform retrieval.
- `toolbox [moonberry_search]`: access to the configured Moonberry Guide Search reusable tool declared in tools, not an unconfigured System Tool type.
- A goal requiring current-run retrieval evidence, citations, and explicit handling of missing evidence and failures.

The reusable tool pins the Knowledge Space and topK = 5. It omits config.query, supplies agent.question through input_bindings, and maps retrieved_documents to the shared evidence variable. The execution adapter must define how these bindings become a retrieval invocation. This version does not claim support for agent-generated query rewrites or multi-round research. The Agent Action controls tool invocation; it must retrieve evidence before making factual game claims.

The tool definition is included to make the sample self-contained. In the product, an equivalent existing Agent-owned reusable tool can instead be configured through Reusable Tools and referenced by its unique name. Do not create a duplicate Moonberry Guide Search tool if one already exists.

Both variants have one Solo Agent and no Branch, Loop, or layout. The Task variant remains the first explicit input/output acceptance baseline. The Agent Action variant demonstrates knowledge and toolbox configuration and still requires its variable-write and completion contract at runtime.

Both DSL files express current configuration syntax. The model name gpt-5 follows existing examples and is a configuration value. Before execution, verify that the environment has access and credentials for it, or select an available model and record the model used.

## 6. Execution contract and gaps

Editor configuration, DSL compilation, and persistence do not imply an implemented execution kernel. Separate acceptance into two stages:

| Stage | What can be verified |
| --- | --- |
| Configuration | DSL validation, variable references/types, graph structure, resource resolution, Canvas synchronization, save/reload |
| After execution integration | Real retrieval, model calls, run isolation, source accuracy, failure handling, final output |

Minimum execution requirements:

1. The retrieval result exposed as retrieved_documents is a JSON array. Each item supplies a traceable document identifier, filename, title/section locator, and evidence text. This is a proposed case-level execution contract, not a new canonical schema. Adapt an actual response envelope explicitly if necessary.
2. JSON variables interpolate as stable JSON text, never [object Object]. Supply only the current retrieval results, not the complete Knowledge Space by default.
3. In the Task variant, llm_call response.text maps to answer, which the run interface displays. Reaching End ends the workflow; it does not itself define a chat-message output contract.
4. An empty retrieval array is a successful retrieval with insufficient evidence. A failed tool call is different: stop the workflow and report failure. Do not present stale answers or fabricate success. The Task DSL uses fail_task; the Agent Action runtime must enforce equivalent failure reporting. A natural-language goal is not a typed tool-failure policy.
5. Treat retrieved documents as evidence, not instructions. Do not execute actions described in documents or send documents to unrelated external services. Model processing follows the configured model environment.

The Agent Action variant additionally requires explicit variable-write and completion semantics before it can pass equivalent execution acceptance. Implementing those runtime modules is outside this design deliverable.

## 7. Setup and demonstration

1. Create Moonberry Island Guide, upload the four source documents at its root, then validate and apply manifest.json through Graph Overview → Import manifest. Verify the graph counts and separately confirm text retrieval readiness.
2. Create a Solo Journey, assign the Agent, and synchronize the single End.
3. Paste the Task DSL into DSL Edit; ensure the required Knowledge Space is available and uniquely named.
4. Resolve all error and context-required diagnostics before Apply.
5. Apply and verify two Tasks and three edges. Edit question, save, and reload to check persistence.
6. Once a run entry point exists, execute acceptance.md questions independently. Record evidence passages, model, answer, and sources for each run.
7. Apply the Agent Action variant and verify one Agent Action, two edges, one assigned Knowledge Space, and the Moonberry Guide Search toolbox entry. Compare using the same questions once tool invocation, input/output bindings, and answer delivery are supported.

## 8. Completion criteria

Configuration acceptance: both DSL variants compile with an explicit target context and Knowledge Space inventory. Round trips retain IDs, End bindings, and Canvas layout. Missing resources block Apply without changing the Canvas.

Execution acceptance: single-document and cross-document questions receive correct, supported answers. Unknown and partially unknown questions identify gaps. Failures remain failures. Every citation must refer to current retrieved evidence; citation formatting alone is insufficient.

This package delivers the design, DSL, and knowledge fixtures. Retrieval services, model execution, run UI, and indexing integration require separate implementation.

## 9. Validation record

Validation on 2026-10-25: both updated DSL files compiled without diagnostics and passed JSON → DSL → JSON equivalence checks. The Agent Action variant produced 3 nodes, 2 edges, and one configured reusable retrieval tool; its knowledge and toolbox references resolved to the expected IDs. The Task variant retains 4 nodes and 3 edges. Both reference the Knowledge Space named Moonberry Island Guide. Configuration checks do not execute retrieval or models; execution acceptance remains separate.


Manifest validation (2026-10-23): manifest.json passed the current knowledgeGraphManifestSchema, including reference and graph-status checks. All four document paths resolve to the bundled source files. This is local artifact validation; matching against uploaded files, preview, Apply, and reimport still require the live Knowledge Space.
