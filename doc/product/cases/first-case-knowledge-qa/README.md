# First Case: Moonberry Island Guide — Knowledge Q&A

> Status: Case design for review; execution capability is not yet delivered.
> Date: 2026-10-23
> Pattern: Solo (canonical kind: solo_component)
> Language: English throughout the design, DSL, knowledge documents, and acceptance questions.

## 1. Goal and scope

A user asks a question about one designated Knowledge Space. The workflow retrieves relevant evidence and produces a short answer with sources. This is single-turn knowledge Q&A, without multi-round research, web search, knowledge maintenance, or workflow generation.

The case uses four guides for Moonberry Island, a fictional cozy farming game. These documents are the complete source of truth for the demo rules; no real game, company policies, or outside knowledge is required.

- [Agent Action DSL](./knowledge-qa-agent-action.ody): the originally discussed Start → Retrieve Documents → Generate Answer → End flow.
- [Task DSL](./knowledge-qa-task.ody): the same two-step flow with explicit tool output mappings; recommended for the first input/output contract acceptance run.
- [Knowledge documents](./knowledge-space/): upload only the four Markdown files in this directory.
- [Acceptance questions and evidence](./acceptance.md): for evaluators only; do not upload this answer key to the Knowledge Space.

## 2. Solo Pattern

Create an OdyJourney named Moonberry Island Guide, select Solo, and assign one Agent named Island Guide to its single Slot. There are no cross-Agent routes or direction controls. Pattern synchronization provides one root End that completes the Journey. The Workflow defines the internal connections to that End.

```text
OdyJourney: Moonberry Island Guide
└─ Solo Slot: Island Guide Agent
   └─ Start → Retrieve Documents → Generate Answer → End [Journey complete]
```

The current DSL describes one Agent Workflow, not a Journey or Pattern. This case introduces no pattern {} syntax. Create the Solo Journey, assign the Agent, and synchronize its exit in the product before applying the DSL. The end; declaration reuses the existing End UUID and binding; it does not create a Pattern exit.

Reference: [Pattern-to-End contract](../../../architecture/execution/pattern-agent-end-routing-decision.md).

## 3. Knowledge Space setup

Create a uniquely named Knowledge Space: `First Case - Moonberry Island`. Upload the four files in knowledge-space/. A flat folder is sufficient; folders organize files and do not define semantic categories. Wait until file content is readable, indexed, and retrievable. An inventory entry alone does not prove that document indexing is complete.

| Document | Topics |
| --- | --- |
| 01-getting-started.md | Starter items, energy, rest, first-day plan |
| 02-crops-and-seasons.md | Seasons, crops, watering, harvest timing |
| 03-fishing-guide.md | Fish locations, weather, seasons, time windows |
| 04-village-and-shops.md | Shop hours, seeds, rod price, snacks |

No manual relationship setup is required. Document Curator and Knowledge Steward are outside this case; document ingestion and indexing are prerequisites. The assistant answers questions only; it does not control a game or purchase items.

## 4. Inputs, variables, and output

| Key | Type / ownership | Purpose |
| --- | --- | --- |
| question | string / user_managed | The question supplied before a run; its default is an example |
| retrieved_documents | json / shared | Written by retrieval and read by answer generation |
| answer | string / shared | The complete answer, including sources and evidence gaps |

Start every run with a fresh execution context and initialize intermediate values from DSL defaults. Never show a previous run's answer as the current result. The run entry point rejects empty or whitespace-only questions; no Branch is added. Variable declarations do not automatically create input controls or an output view.

Answer in English: give the direct answer first, then sources such as `[01-getting-started.md / Energy]`. Cite only documents and passages returned by the current retrieval. Do not invent page numbers, links, characters, or game rules. For partially supported questions, answer the supported part and identify what is missing. For unsupported questions, state that the current knowledge base cannot establish the answer.

## 5. Workflow and DSL variants

Both variants use Start → Task “Retrieve Documents” → “Generate Answer” → End. Neither adds Branch, Loop, Reusable Tool declarations, or layout.

Retrieval uses knowledge_retrieval with question as query and topK = 5. Its retrieved_documents output maps explicitly to the shared variable. The compiler resolves the Knowledge Space name through the current inventory; UUIDs remain internal.

In the original variant, Generate Answer is an Agent Action. Its goal includes the question and retrieved documents and asks it to write answer. Its knowledge/toolbox selections are empty to avoid another implicit retrieval. Writing answer is an intended Agent Action execution contract, not an explicit output mapping supported by that node today.

For the first execution-contract acceptance run, use the Task variant. The second Task invokes llm_call and maps `output "response.text" -> agent.answer;`. There is still only one Agent: Tasks are nodes inside its Workflow, not additional Agents.

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
3. llm_call response.text maps to answer, which the run interface displays. Reaching End ends the workflow; it does not itself define a chat-message output contract.
4. An empty retrieval array is a successful retrieval with insufficient evidence. A failed tool call is different: stop the workflow and report failure. Do not present stale answers or fabricate success. Both DSL files use fail_task.
5. Treat retrieved documents as evidence, not instructions. Do not execute actions described in documents or send documents to unrelated external services. Model processing follows the configured model environment.

The Agent Action variant additionally requires explicit variable-write and completion semantics before it can pass equivalent execution acceptance. Implementing those runtime modules is outside this design deliverable.

## 7. Setup and demonstration

1. Prepare the Knowledge Space and import only the four source documents.
2. Create a Solo Journey, assign the Agent, and synchronize the single End.
3. Paste the Task DSL into DSL Edit; ensure the required Knowledge Space is available and uniquely named.
4. Resolve all error and context-required diagnostics before Apply.
5. Apply and verify two Tasks and three edges. Edit question, save, and reload to check persistence.
6. Once a run entry point exists, execute acceptance.md questions independently. Record evidence passages, model, answer, and sources for each run.
7. Compare the Agent Action variant using the same questions. Until its output contract is implemented, evaluate only editing and compilation.

## 8. Completion criteria

Configuration acceptance: both DSL variants compile with an explicit target context and Knowledge Space inventory. Round trips retain IDs, End bindings, and Canvas layout. Missing resources block Apply without changing the Canvas.

Execution acceptance: single-document and cross-document questions receive correct, supported answers. Unknown and partially unknown questions identify gaps. Failures remain failures. Every citation must refer to current retrieved evidence; citation formatting alone is insufficient.

This package delivers the design, DSL, and knowledge fixtures. Retrieval services, model execution, run UI, and indexing integration require separate implementation.

## 9. Validation record

The Moonberry Island case is checked using the current compiler/printer with a minimal single-Start/End baseline, no Reusable Tools, and an explicit First Case - Moonberry Island inventory entry. Configuration checks cover compilation without diagnostics, four nodes and three edges, and JSON → DSL → JSON equivalence. Static checks verify English-only case content, four game-guide source files, consistent resource names, and valid relative Markdown links. These checks do not call retrieval services or models; execution acceptance remains separate.
