# Odyssey V1 Canonical JSON Contracts

> Status: **Accepted and frozen V1 JSON Schema `1.0.0` baseline**  
> Frozen: **2026-08-11**  
> Purpose: define the authoritative JSON boundaries for current Journey state, reusable templates, editor/API projections, and portable ZIP packages  
> Related constraint: [`doc/architecture/domain/odyssey-v1-design-constraints.md`](../../domain/odyssey-v1-design-constraints.md)

The structures and semantics in this document are the accepted source of truth for Odyssey V1 JSON Schema `1.0.0`. Changes to frozen contract fields require an explicit contract review and coordinated schema, API, persistence, fixture, and frontend updates.

The remaining package and single-file size limits are operational import/export limits, not unresolved JSON structure. They do not block implementation of the frozen persistence or editor contracts.

## Implemented routing contract increment (2026-10-22)

Implementation update (2026-10-22): the concrete [Pattern / End routing contract increment](./pattern-agent-end-routing-contract.md) defines supported `1.1.0` Pattern/Workflow shapes, explicit legacy upgrade, revision-bound destructive impact confirmation, and portable exit mapping. It extends this baseline for routing only; remaining `1.0.0` examples retain their historical baseline meaning. See the implementation plan/report for verification status rather than inferring completion from this contract.

[Pattern → Agent Workflow End 单向同步设计](../../execution/pattern-agent-end-routing-decision.md) fixes the new product semantics: generated multiple root Ends, strictly one-way Pattern → End synchronization, Slot-based targets including empty Slots, and restricted Hub direction editing. Linear and Circular Loop arrows remain derived and non-editable. Loop body boundaries are unchanged.

The existing `1.0.0` examples below remain historical baseline examples. Routing-aware clients use the linked `1.1.0` increment; single-End and forward-only Hub examples do not override it. Rendering does not migrate persisted documents. Verification is recorded in the [completion report](../../../planning/implementation/pattern-agent-end-routing-completion-report.md).

## Contract change process

Future contract changes must be proposed explicitly, reviewed against the accepted domain and persistence boundaries, and recorded as a coordinated schema change. They must not be introduced indirectly from database rows, ORM models, Vue Flow objects, Figma layers, or component-local state.

Accepted review decisions are incorporated into the relevant section and summarized here:

- A Journey package exports only the instantiated current configuration. It does not include the user's reusable template library by default.
- Journey Publish/Release selection is out of V1 scope; Canvas edits save the single current configuration directly.
- A package uses one JSON file per Agent aggregate. Workflow, CanvasLayout, Variables, and AgentReusableTools are nested fields in that Agent file.
- Agent goal, Knowledge Space bindings, and Tool bindings belong to Agent Action Nodes, not to Agent-level metadata.
- All persisted and nested domain objects use UUID strings. Human-readable names and local sequence numbers are not used as identity.
- The public API exposes a modular, package-shaped representation to demonstrate Odyssey's component model, while ZIP-relative file paths remain specific to import/export packages.
- A Journey package does not contain a separate `knowledge-spaces.json`. Knowledge Space references remain in the Agent Workflow Nodes or configured Tools that use them.
- Pattern `kind` remains stable after editing. Slots use an optional topology role only when the active Pattern distinguishes roles such as main and sub.
- Agent Canvas viewport is persisted. Loop Start and Loop End are explicit persisted boundary Nodes with placements in the Loop layout.
- Task-local Variables are stored inside the owning Task Node configuration.
- Configured Tools reference a stable `kind`; their `configuration` is validated by the schema registered for that kind.
- Agent Templates can be exported independently.
- Knowledge Space names are unique within a Workspace. Import may offer an exact name match when UUID matching fails.
- Knowledge Space references also have a relational index for deletion checks and reverse queries; Workflow JSON remains the portable source of truth.
- V1 does not implement package schema migration. Because no earlier package format has been released, import accepts only the current supported `schemaVersion`.

## 1. Design Goals

The JSON design should:

- avoid one oversized Journey JSON document;
- support partial loading and partial persistence;
- keep Workflow semantics separate from Canvas presentation;
- distinguish current instances from reusable templates;
- support deep-copy template instantiation with ID remapping;
- support atomic import/export through a portable ZIP package;
- preserve forward migration through explicit schema versions;
- avoid Vue Flow, UI panel, and Figma layer details in domain JSON;
- keep Knowledge Spaces as independent referenced assets.

## 2. Contract Layers

Odyssey uses three related but different contract layers.

### 2.1 Persistence contracts

Used by the API and database for the current editable state. Each aggregate has its own revision and can be saved independently.

```text
Journey aggregate
AgentWorkflow aggregate
KnowledgeSpace aggregate
Template aggregate
```

### 2.2 Editor contracts

Used by frontend pages. An editor response may combine summaries from multiple persistence aggregates, but it must not become the database storage format.

### 2.3 Package contracts

Used for import/export. A package splits the Journey into files and uses `manifest.json` as its entry point.

### 2.4 Public API representation

The public API exposes the same modular relationships as the portable package so that Odyssey's component-oriented construction model remains visible to API consumers.

For example, a Journey editor response may expose links or embedded summaries for its Pattern and Agent modules:

```json
{
  "journey": {},
  "pattern": {},
  "agents": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8801",
      "href": "/api/v1/agents/0195f076-b6e6-7ef0-98db-d721990f8801"
    }
  ]
}
```

The API does not expose ZIP-relative fields such as `patternPath` or `agentPath` during normal CRUD operations. Those fields exist only inside an exported package. This preserves the same conceptual shape without coupling online APIs to archive file layout.

## 3. Common Conventions

### 3.1 Identifiers

Accepted rules:

- persisted entities use UUID strings;
- Pattern Slots, Workflow Nodes, Edges, Branch Cases, Variables, and Tool Instances also use UUID strings;
- built-in template and definition keys use stable lowercase `snake_case` strings;
- display names never serve as identifiers;
- imported owned IDs are remapped to new UUIDs;
- references to independent assets are preserved or explicitly remapped.

Example:

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f88fd",
  "templateKey": "linear_sequence"
}
```

All nested domain objects use UUIDs, including objects that currently exist only inside JSONB. This simplifies package references, template deep-copy, and import ID remapping.

### 3.2 Schema version

Every independently validated JSON file contains `schemaVersion`.

```json
{
  "schemaVersion": "1.0.0"
}
```

`schemaVersion` describes the JSON contract, not the product version and not the revision of a user record.

V1 supports only the current schema version. An import using an unsupported `schemaVersion` is rejected before any database write and returns a clear compatibility error. Migration between historical package schemas may be introduced only after Odyssey publishes more than one package contract version.

### 3.3 Record revision

Mutable persistence aggregates contain an integer `revision` used for optimistic concurrency.

```json
{
  "revision": 7
}
```

An update request sends the revision it was based on. The server rejects an update when the stored revision has advanced.

### 3.4 Timestamps

Timestamps use UTC ISO 8601 strings:

```json
{
  "createdAt": "2026-08-09T08:30:00Z",
  "updatedAt": "2026-08-09T09:15:00Z"
}
```

## 4. Portable Package Layout

Proposed package extension: `.odyssey.zip`

```text
research-system.odyssey.zip
├─ manifest.json
├─ journey.json
├─ pattern/
│  └─ config.json
├─ agents/
│  ├─ research-agent.json
│  └─ reviewer-agent.json
└─ assets/                  # optional; absent from the default thin export
   └─ ...
```

The ZIP layout is an export format, not a requirement to store JSON files on the application server.

A Journey package contains only the instantiated current Journey configuration. It does not include unrelated or source Agent, Pattern, or Tool Templates from the user's reusable library. Because instantiated components are independent snapshots, the exported Journey remains complete without its source templates.

Template exports, if introduced, use a separate explicit export operation and package scope.

Each Agent is exported as one aggregate JSON file. Its Workflow, CanvasLayout, Variables, and AgentReusableTools remain separate fields inside that file rather than separate ZIP entries. This keeps module-level loading without creating many small files.

### 4.1 `manifest.json`

```json
{
  "schemaVersion": "1.0.0",
  "format": "odyssey_journey_package",
  "packageId": "0195f076-b6e6-7ef0-98db-d721990f88fd",
  "exportedAt": "2026-08-09T09:15:00Z",
  "entrypoint": "journey.json",
  "contents": {
    "journey": "journey.json",
    "pattern": "pattern/config.json",
    "agents": [
      {
        "agentId": "0195f076-b6e6-7ef0-98db-d721990f8801",
        "path": "agents/research-agent.json"
      }
    ]
  },
  "options": {
    "includesUserTemplates": false,
    "includesBinaryAssets": false
  },
  "checksums": {
    "journey.json": "sha256:example",
    "pattern/config.json": "sha256:example"
  }
}
```

Proposed behavior:

- import reads only paths declared by the manifest;
- all paths must be relative and remain inside the ZIP root;
- unknown optional files may be ignored;
- missing declared files are validation errors;
- checksum verification happens before database writes;
- the entire import is committed in one database transaction.

## 5. Journey Contract

### 5.1 Package `journey.json`

This file contains Journey identity and module references. It does not embed complete Agent Workflows.

```json
{
  "schemaVersion": "1.0.0",
  "id": "0195f076-b6e6-7ef0-98db-d721990f8800",
  "name": "Research System",
  "description": "Researches and reviews a requested topic.",
  "status": "draft",
  "tags": ["research"],
  "patternPath": "pattern/config.json",
  "agentAssignments": [
    {
      "slotId": "0195f076-b6e6-7ef0-98db-d721990f8810",
      "agentId": "0195f076-b6e6-7ef0-98db-d721990f8801",
      "agentPath": "agents/research-agent.json"
    }
  ],
  "createdAt": "2026-08-09T08:30:00Z",
  "updatedAt": "2026-08-09T09:15:00Z"
}
```

In persistence APIs, `patternPath` and `agentPath` do not exist. The database/API representation uses IDs and separate endpoints.

### 5.2 Journey lifecycle

V1 retains a Journey lifecycle status:

```text
draft
archived
```

Semantics:

- `draft`: the Journey is the current editable configuration.
- `archived`: the Journey is retained but removed from normal active use.

Journey Publish/Release selection is out of V1 scope. There is only one current configuration, Canvas and form edits save it directly, and optimistic concurrency through `revision` applies. If Odyssey later needs runtime availability, stable deployments, rollback, approval, or reproducibility, a separate immutable JourneyRelease model must be introduced.

## 6. Pattern Contract

### 6.1 `pattern/config.json`

```json
{
  "schemaVersion": "1.0.0",
  "id": "0195f076-b6e6-7ef0-98db-d721990f8820",
  "templateKey": "linear_sequence",
  "kind": "linear_sequence",
  "name": "Research pipeline",
  "slots": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8810",
      "topologyRole": null,
      "label": "Research",
      "order": 0,
      "agentId": "0195f076-b6e6-7ef0-98db-d721990f8801",
      "configuration": {}
    },
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8811",
      "topologyRole": null,
      "label": "Review",
      "order": 1,
      "agentId": null,
      "configuration": {}
    }
  ],
  "routes": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8821",
      "sourceSlotId": "0195f076-b6e6-7ef0-98db-d721990f8810",
      "target": {
        "type": "slot",
        "slotId": "0195f076-b6e6-7ef0-98db-d721990f8811"
      }
    },
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8822",
      "sourceSlotId": "0195f076-b6e6-7ef0-98db-d721990f8811",
      "target": {
        "type": "journey_end"
      }
    }
  ],
  "configuration": {}
}
```

Rules:

- `templateKey` records provenance only.
- `kind` selects the current topology rules and automatic layout strategy.
- `kind` remains the selected built-in kind after supported Slot edits. A future free-form Pattern uses `custom`.
- Slots have stable IDs.
- `label` is user-facing text.
- `topologyRole` is optional and is used only when a Pattern rule distinguishes semantic positions such as `main` and `sub`.
- Linear and circle-like Patterns may leave `topologyRole` as `null` because their Slots are semantically equivalent apart from order.
- Agent IDs are unique across occupied Slots in one Journey.
- Slot positions are derived and are not persisted for V1 built-in Patterns.
- Linear Routes are regenerated from `order` after Slot reorder.
- Non-linear Pattern rules maintain their own valid topology.
- Users do not freely edit Routes. The accepted routing delta adds restricted Hub–Spoke direction commands; Linear and Circular Loop Routes remain derived. The corresponding contract is defined in the routing increment above.

Proposed Slot field:

```ts
interface PatternSlot {
  id: UUID
  label: string
  topologyRole?: string | null
  order?: number | null
  agentId?: UUID | null
  configuration: Record<string, unknown>
}
```

Each Pattern kind defines its allowed `topologyRole` values and cardinality rules. For example, a main-to-sub Pattern may require exactly one `main` Slot and one or more `sub` Slots.

## 7. Agent Contract

### 7.1 `agents/{agent}.json`

```json
{
  "schemaVersion": "1.0.0",
  "id": "0195f076-b6e6-7ef0-98db-d721990f8801",
  "name": "Research Agent",
  "description": "Finds and synthesizes evidence.",
  "workflow": {
    "nodes": [],
    "edges": []
  },
  "layout": {
    "nodePlacements": [],
    "viewport": {
      "x": 0,
      "y": 0,
      "zoom": 1
    }
  },
  "variables": [],
  "reusableTools": []
}
```

Agent-level data contains identity and ownership metadata only. Goal, Knowledge Space selection, and Tool selection belong to Agent Action Node configuration inside `workflow.nodes`.

The persistence representation additionally contains:

```json
{
  "journeyId": "0195f076-b6e6-7ef0-98db-d721990f8800",
  "revision": 12,
  "createdAt": "2026-08-09T08:40:00Z",
  "updatedAt": "2026-08-09T09:10:00Z"
}
```

## 8. Workflow Contract

### 8.1 Agent `workflow` field

```json
{
  "schemaVersion": "1.0.0",
  "nodes": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8830",
      "type": "start",
      "name": "Start",
      "config": {}
    },
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8831",
      "type": "agent_action",
      "name": "Research and synthesize",
      "config": {
        "goal": "Research the requested topic.",
        "knowledgeSpaceIds": [
          "0195f076-b6e6-7ef0-98db-d721990f8890"
        ],
        "reusableToolIds": [
          "0195f076-b6e6-7ef0-98db-d721990f8870"
        ]
      }
    },
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8832",
      "type": "end",
      "name": "End",
      "config": {}
    }
  ],
  "edges": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8840",
      "sourceNodeId": "0195f076-b6e6-7ef0-98db-d721990f8830",
      "targetNodeId": "0195f076-b6e6-7ef0-98db-d721990f8831"
    },
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8841",
      "sourceNodeId": "0195f076-b6e6-7ef0-98db-d721990f8831",
      "targetNodeId": "0195f076-b6e6-7ef0-98db-d721990f8832"
    }
  ]
}
```

Workflow invariants:

- exactly one Start and one End;
- Start has no incoming edge;
- arbitrary cycles are forbidden;
- repetition is represented by Loop;
- Agent Action, Task, and Branch are allowed inside Loop;
- nested Loop is forbidden;
- Branch routing is represented through outgoing Edges;
- Tools are not Workflow Nodes.

### 8.2 Common value and variable references

The UI may display variable tokens such as `{{agent.research_question}}`, but persisted bindings use stable Variable UUIDs so renaming a Variable does not break Tool configuration.

Static and variable-backed values use a discriminated structure:

```ts
type ValueSource =
  | { kind: 'literal'; value: unknown }
  | { kind: 'variable'; variableId: UUID }
  | { kind: 'template'; segments: TemplateSegment[] }

type TemplateSegment =
  | { kind: 'text'; text: string }
  | { kind: 'variable'; variableId: UUID }
```

Example corresponding to the UI text `Find evidence for {{agent.research_question}}`:

```json
{
  "kind": "template",
  "segments": [
    {
      "kind": "text",
      "text": "Find evidence for "
    },
    {
      "kind": "variable",
      "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
    }
  ]
}
```

### 8.3 Agent Action Node

Agent Action owns its LLM-oriented goal and the resources available to that reasoning step.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8831",
  "type": "agent_action",
  "name": "Research and synthesize",
  "config": {
    "model": "gpt-4o",
    "goal": {
      "kind": "template",
      "segments": [
        {
          "kind": "text",
          "text": "Analyze evidence for the research brief."
        }
      ]
    },
    "knowledgeSpaceIds": [
      "0195f076-b6e6-7ef0-98db-d721990f8890"
    ],
    "reusableToolIds": [
      "0195f076-b6e6-7ef0-98db-d721990f8870"
    ]
  }
}
```

Rules:

- `model` is required in the current UI but may later reference a model configuration entity.
- `goal` supports static text and Agent/System Variable tokens.
- Knowledge Spaces and Reusable Tools are ordered unique references.
- Referenced Knowledge Spaces remain independent assets.
- Referenced AgentReusableTools must belong to the same AgentWorkflow.

### 8.4 Task Node

A Task owns Task-local Variables and a strictly ordered Tool sequence.

When a Tool is added from the Agent's Reusable Tool inventory, the application creates a new Task-owned Tool step snapshot:

- the step receives a new ToolStep UUID;
- kind and configuration are copied from the Reusable Tool at that moment;
- output mapping and failure behavior remain Task-step-owned configuration;
- no live `reusableToolId`/source link is persisted in V1;
- later source edits or deletion do not alter existing Task steps, and Task-step edits do not update the source.

Consequently, `Linked`, `Detach`, and `Update source` are not valid V1 states or commands. Reusing the same Reusable Tool multiple times creates distinct independent ToolStep snapshots.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8865",
  "type": "task",
  "name": "Publish research brief",
  "config": {
    "localVariables": [
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f8866",
        "key": "context",
        "dataType": "json",
        "defaultValue": null
      },
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f8867",
        "key": "filtered_documents",
        "dataType": "json",
        "defaultValue": null
      }
    ],
    "steps": [
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f8871",
        "kind": "knowledge_retrieval",
        "label": "Retrieve supporting evidence",
        "configuration": {
          "knowledgeSpaceId": "0195f076-b6e6-7ef0-98db-d721990f8890",
          "query": {
            "kind": "template",
            "segments": [
              {
                "kind": "text",
                "text": "Find evidence for "
              },
              {
                "kind": "variable",
                "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
              }
            ]
          },
          "topK": 5
        },
        "outputMapping": {
          "sourceKey": "retrieved_documents",
          "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f8866"
        },
        "failureBehavior": {
          "kind": "retry",
          "maxAttempts": 2
        }
      },
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f8872",
        "kind": "script_execution",
        "label": "Filter retrieved documents",
        "configuration": {
          "language": "python",
          "inputs": [
            {
              "alias": "documents",
              "variableId": "0195f076-b6e6-7ef0-98db-d721990f8866"
            },
            {
              "alias": "threshold",
              "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
            }
          ],
          "script": "result = [d for d in documents if d.score >= threshold]"
        },
        "outputMapping": {
          "sourceKey": "result",
          "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f8867"
        },
        "failureBehavior": {
          "kind": "fail_task"
        }
      }
    ]
  }
}
```

Rules:

- `steps` array order is the canonical execution order; no separate `order` field is needed.
- Each Task-local Variable ID is unique within the Agent document.
- A Tool may reference System Variables, Agent Variables, and variables owned by its containing Task.
- A Tool cannot reference a Task-local Variable owned by another Task.
- A Tool output can target an existing writable Variable or create a new Task-local Variable before the step is saved.
- Tools cannot define Workflow routes.

### 8.5 Branch Node

Branch follows ordered switch/case semantics. The first matching case is selected; otherwise the default case is selected.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f88b0",
  "type": "branch",
  "name": "Enough sources?",
  "config": {
    "cases": [
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f88b1",
        "label": "Enough evidence",
        "match": "all",
        "conditions": [
          {
            "id": "0195f076-b6e6-7ef0-98db-d721990f88b2",
            "left": {
              "kind": "variable",
              "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
            },
            "operator": "gte",
            "right": {
              "kind": "literal",
              "value": 3
            }
          }
        ]
      },
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f88b3",
        "label": "No sources",
        "match": "all",
        "conditions": [
          {
            "id": "0195f076-b6e6-7ef0-98db-d721990f88b4",
            "left": {
              "kind": "variable",
              "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
            },
            "operator": "eq",
            "right": {
              "kind": "literal",
              "value": 0
            }
          }
        ]
      }
    ],
    "defaultCase": {
      "id": "0195f076-b6e6-7ef0-98db-d721990f88b5",
      "label": "Gather more"
    }
  }
}
```

Branch outgoing Edges reference the case UUID through `sourceHandleId`:

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f88b6",
  "sourceNodeId": "0195f076-b6e6-7ef0-98db-d721990f88b0",
  "sourceHandleId": "0195f076-b6e6-7ef0-98db-d721990f88b1",
  "targetNodeId": "0195f076-b6e6-7ef0-98db-d721990f8832"
}
```

Branch rules:

- cases are evaluated in array order;
- `defaultCase` is required and has no conditions;
- every Case and Default ID corresponds to exactly one outgoing Edge;
- `match: "all"` applies logical AND to conditions;
- V1 may reserve `match: "any"` for future OR behavior;
- case labels are display text and do not define identity;
- route targets exist only in Workflow Edges, not inside the Branch config.

V1 comparison operators:

```text
eq
neq
gt
gte
lt
lte
contains
not_contains
is_empty
is_not_empty
```

Unary operators such as `is_empty` and `is_not_empty` omit `right`.

### 8.6 Agent `layout` field

```json
{
  "schemaVersion": "1.0.0",
  "nodePlacements": [
    {
      "nodeId": "0195f076-b6e6-7ef0-98db-d721990f8830",
      "x": 80,
      "y": 220
    },
    {
      "nodeId": "0195f076-b6e6-7ef0-98db-d721990f8831",
      "x": 280,
      "y": 220
    },
    {
      "nodeId": "0195f076-b6e6-7ef0-98db-d721990f8832",
      "x": 520,
      "y": 220
    }
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

Layout must not include selected Nodes, open panels, focus mode, or drag state.

The viewport is persisted per Agent Workflow in V1. Reopening the Agent restores its last saved pan and zoom.

## 9. Loop Contract

A Loop owns its body graph and layout. It is not a separate AgentWorkflow record.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8850",
  "type": "loop",
  "name": "Gather evidence",
  "config": {
    "maxTurns": 3,
    "exitCondition": {
      "kind": "variable_comparison",
      "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860",
      "operator": "gte",
      "value": 3
    },
    "body": {
      "graph": {
        "nodes": [],
        "edges": []
      },
      "layout": {
        "nodePlacements": [],
        "viewport": {
          "x": 0,
          "y": 0,
          "zoom": 1
        }
      }
    }
  }
}
```

Loop Start and Loop End are explicit Nodes inside `body.graph`:

```json
{
  "nodes": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8851",
      "type": "loop_start",
      "name": "Loop Start",
      "config": {}
    },
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8852",
      "type": "loop_end",
      "name": "Loop End",
      "config": {}
    }
  ],
  "edges": []
}
```

Their positions are stored in `body.layout.nodePlacements`, allowing import and reopening to restore the Loop Canvas. Both boundary Nodes are required, fixed in identity semantics, and cannot be deleted.

## 10. Variable Contract

### 10.1 Agent `variables` field

```json
{
  "schemaVersion": "1.0.0",
  "variables": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8860",
      "key": "source_count",
      "displayName": "Source count",
      "description": "Number of accepted sources.",
      "dataType": "number",
      "ownership": "agent_managed",
      "defaultValue": 0,
      "readOnly": false
    }
  ]
}
```

System variables are runtime-provided and are not persisted as Agent Variable records.

Proposed ownership values:

```text
user_managed
shared
agent_managed
```

Task-local Variables are stored inside the owning Task Node configuration. Only Agent-level Variables are stored in the Agent aggregate's top-level `variables` field.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8865",
  "type": "task",
  "name": "Collect sources",
  "config": {
    "localVariables": [
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f8866",
        "key": "raw_result",
        "dataType": "json",
        "defaultValue": null
      }
    ],
    "steps": []
  }
}
```

## 11. Tool Contracts

### 11.1 Tool Definition

```json
{
  "schemaVersion": "1.0.0",
  "id": "0195f076-b6e6-7ef0-98db-d721990f8880",
  "kind": "knowledge_retrieval",
  "name": "Knowledge Retrieval",
  "category": "knowledge",
  "source": "built_in",
  "configurationSchema": {},
  "inputSchema": {},
  "outputSchema": {}
}
```

### 11.2 Tool Template

```json
{
  "schemaVersion": "1.0.0",
  "id": "0195f076-b6e6-7ef0-98db-d721990f8881",
  "name": "Search Product Documents",
  "kind": "knowledge_retrieval",
  "configuration": {
    "knowledgeSpaceId": "0195f076-b6e6-7ef0-98db-d721990f8890",
    "topK": 5
  },
  "inputBindings": [],
  "outputBinding": null
}
```

### 11.3 Agent `reusableTools` field

```json
{
  "schemaVersion": "1.0.0",
  "tools": [
    {
      "id": "0195f076-b6e6-7ef0-98db-d721990f8870",
      "name": "Search Product Documents",
      "kind": "knowledge_retrieval",
      "sourceTemplateId": "0195f076-b6e6-7ef0-98db-d721990f8881",
      "configuration": {
        "knowledgeSpaceId": "0195f076-b6e6-7ef0-98db-d721990f8890",
        "topK": 5
      },
      "inputBindings": [],
      "outputBinding": null
    }
  ]
}
```

`sourceTemplateId` records provenance only. The AgentReusableTool remains an independent snapshot owned by one AgentWorkflow.

A configured Tool uses one stable `kind` field. Its `configuration` records the configured fields as-is and is validated against the schema registered for that kind.

The portable contract does not require a Tool Definition UUID or per-definition version. Changes to built-in Tool configuration shapes are migrated through the containing JSON file's `schemaVersion`. A future plugin system may add namespaced kinds such as `plugin.example/custom_search` without changing this boundary.

### 11.4 Common Tool Step structure

Every Tool inside a Task uses this common envelope:

```ts
interface ToolStep {
  id: UUID
  kind: ToolKind
  label?: string | null
  configuration: Record<string, unknown>
  outputMapping?: ToolOutputMapping | null
  failureBehavior: ToolFailureBehavior
}

interface ToolOutputMapping {
  sourceKey: string
  targetVariableId: UUID
}

type ToolFailureBehavior =
  | { kind: 'retry'; maxAttempts: 2 }
  | { kind: 'fail_task' }
```

In V1, `retry` means one retry after the initial failed attempt, so `maxAttempts` is fixed to `2`. Tool failures never create Workflow routes.

### 11.5 Knowledge Retrieval

Figma source: `Agent Workflow Canvas — Tool Configuration (Knowledge Retrieval)`.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8871",
  "kind": "knowledge_retrieval",
  "label": "Retrieve supporting evidence",
  "configuration": {
    "knowledgeSpaceId": "0195f076-b6e6-7ef0-98db-d721990f8890",
    "query": {
      "kind": "template",
      "segments": [
        {
          "kind": "text",
          "text": "Find evidence for "
        },
        {
          "kind": "variable",
          "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
        }
      ]
    },
    "topK": 5
  },
  "outputMapping": {
    "sourceKey": "retrieved_documents",
    "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f8866"
  },
  "failureBehavior": {
    "kind": "retry",
    "maxAttempts": 2
  }
}
```

Validation:

- `knowledgeSpaceId` is required and must resolve to an accessible Knowledge Space.
- `query` is required and may contain text and Variable segments.
- `topK` is optional in the editor, defaults to `5`, and must be a positive integer.
- output `sourceKey` is fixed to `retrieved_documents`.
- the target must be a Variable visible to the containing Task.

### 11.6 Script Execution

Figma source: `Built-in Tool Panel — Script Execution`.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8872",
  "kind": "script_execution",
  "label": "Filter retrieved documents",
  "configuration": {
    "language": "python",
    "inputs": [
      {
        "alias": "documents",
        "variableId": "0195f076-b6e6-7ef0-98db-d721990f8866"
      },
      {
        "alias": "threshold",
        "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
      }
    ],
    "script": "result = [d for d in documents if d.score >= threshold]"
  },
  "outputMapping": {
    "sourceKey": "result",
    "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f8867"
  },
  "failureBehavior": {
    "kind": "fail_task"
  }
}
```

Validation:

- `language` is `python` or `javascript` in V1.
- `inputs` is optional; each alias must be unique and a valid identifier for the selected language.
- each input Variable must be visible to the containing Task.
- `script` is required.
- output `sourceKey` is fixed to `result` in V1.
- Script sandboxing and actual execution are outside the V1 editor scope.

### 11.7 API Request

Figma source: `Built-in Tool Panel — API Request`.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8873",
  "kind": "api_request",
  "label": "Fetch source records",
  "configuration": {
    "method": "GET",
    "url": {
      "kind": "template",
      "segments": [
        {
          "kind": "text",
          "text": "https://api/"
        },
        {
          "kind": "variable",
          "variableId": "0195f076-b6e6-7ef0-98db-d721990f88c0"
        }
      ]
    },
    "headers": [
      {
        "id": "0195f076-b6e6-7ef0-98db-d721990f88c1",
        "name": "Authorization",
        "value": {
          "kind": "template",
          "segments": [
            {
              "kind": "text",
              "text": "Bearer "
            },
            {
              "kind": "variable",
              "variableId": "0195f076-b6e6-7ef0-98db-d721990f88c2"
            }
          ]
        }
      }
    ],
    "body": {
      "kind": "json",
      "value": {
        "kind": "template",
        "segments": [
          {
            "kind": "text",
            "text": "{\"query\": \""
          },
          {
            "kind": "variable",
            "variableId": "0195f076-b6e6-7ef0-98db-d721990f8860"
          },
          {
            "kind": "text",
            "text": "\"}"
          }
        ]
      }
    }
  },
  "outputMapping": {
    "sourceKey": "response.data",
    "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f88c3"
  },
  "failureBehavior": {
    "kind": "retry",
    "maxAttempts": 2
  }
}
```

Request body variants:

```ts
type ApiRequestBody =
  | { kind: 'none' }
  | { kind: 'json'; value: ValueSource }
  | {
      kind: 'form_data'
      entries: Array<{
        id: UUID
        name: string
        value: ValueSource
      }>
    }
```

Validation:

- methods supported in V1: `GET`, `POST`, `PUT`, `DELETE`.
- URL is required and supports Variable segments.
- header names must be unique case-insensitively.
- header values and request bodies support Variable segments.
- GET and DELETE normally use `body.kind: "none"`; the editor should warn before allowing a body.
- output `sourceKey` is fixed to `response.data` in V1.
- secrets must not be embedded as literal template text in exportable packages; they should be referenced through supported Variables or a future secret system.

### 11.8 Set Variable

Figma source: `Built-in Tool Panel — Set Variable`.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8874",
  "kind": "set_variable",
  "label": "Set research status",
  "configuration": {
    "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f8868",
    "operation": "assign",
    "value": {
      "kind": "template",
      "segments": [
        {
          "kind": "text",
          "text": "Research status: "
        },
        {
          "kind": "variable",
          "variableId": "0195f076-b6e6-7ef0-98db-d721990f8869"
        }
      ]
    }
  },
  "outputMapping": null,
  "failureBehavior": {
    "kind": "fail_task"
  }
}
```

Validation:

- `targetVariableId` must reference a writable Agent Variable or a Variable local to the containing Task.
- supported operations: `assign`, `append`, `increment`, `toggle`.
- `value` is required for `assign`, `append`, and `increment`.
- `toggle` omits `value` and requires a Boolean target.
- operation compatibility is validated against the target Variable's data type.
- Set Variable has no output mapping because the target Variable is the destination.

### 11.9 LLM Call

Figma source: `Built-in Tool Panel — LLM Call`.

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8875",
  "kind": "llm_call",
  "label": "Summarize source records",
  "configuration": {
    "model": "gpt-4o",
    "systemPrompt": {
      "kind": "template",
      "segments": [
        {
          "kind": "text",
          "text": "You are a precise research assistant."
        }
      ]
    },
    "prompt": {
      "kind": "template",
      "segments": [
        {
          "kind": "text",
          "text": "Summarize the following: "
        },
        {
          "kind": "variable",
          "variableId": "0195f076-b6e6-7ef0-98db-d721990f88c3"
        },
        {
          "kind": "text",
          "text": "\nReturn a concise brief with citations."
        }
      ]
    }
  },
  "outputMapping": {
    "sourceKey": "response.text",
    "targetVariableId": "0195f076-b6e6-7ef0-98db-d721990f88c4"
  },
  "failureBehavior": {
    "kind": "retry",
    "maxAttempts": 2
  }
}
```

Validation:

- `model` and `prompt` are required.
- `systemPrompt` is optional.
- both prompts support text and Variable segments.
- output `sourceKey` is fixed to `response.text` in V1.
- advanced model parameters are outside V1.

### 11.10 Built-in Tool kinds

```text
knowledge_retrieval
script_execution
api_request
set_variable
llm_call
```

The Tool Configuration Panel renders a type-specific form based on `kind`, while the Task and persistence layers use the common Tool Step envelope.

## 12. Knowledge Space References

The default Journey package does not contain a separate Knowledge Space JSON file. A Knowledge Space reference is stored at the exact place where it is used inside an Agent aggregate.

For an Agent Action Node:

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8831",
  "type": "agent_action",
  "name": "Research and synthesize",
  "config": {
    "goal": "Research the requested topic.",
    "knowledgeSpaceIds": [
      "0195f076-b6e6-7ef0-98db-d721990f8890"
    ],
    "reusableToolIds": []
  }
}
```

A configured Knowledge Retrieval Tool may also contain a `knowledgeSpaceId` according to its Tool Definition schema.

The package validator and importer collect Knowledge Space references from typed, schema-defined reference fields. They must not recursively guess references from arbitrary string values.

On import:

- an exact local match may be reused;
- a missing reference requires user mapping;
- a Journey import does not silently create an empty Knowledge Space;
- all occurrences of the same source Knowledge Space ID use one consistent mapping;
- a future portable export may include Knowledge Space metadata and binary assets.

Knowledge Space names are unique within one Workspace using a normalized-name uniqueness constraint. If UUID matching fails, import may offer the unique exact normalized-name match. The user must confirm the mapping because matching by name does not prove asset identity.

## 13. Agent Template Contract

An Agent Template is a self-contained snapshot package or JSON aggregate containing:

- Agent identity metadata;
- WorkflowGraph and CanvasLayout;
- Variables;
- AgentReusableTools;
- Knowledge Space and Tool references contained by Agent Action Nodes;
- no runtime values;
- no secrets;
- no copied Knowledge Space content.

Proposed top-level shape:

```json
{
  "schemaVersion": "1.0.0",
  "id": "0195f076-b6e6-7ef0-98db-d721990f88a0",
  "name": "Research Agent",
  "description": "Reusable research workflow.",
  "source": "user",
  "ownerWorkspaceId": "0195f076-b6e6-7ef0-98db-d721990f8000",
  "sourceTemplateId": null,
  "visibility": "private",
  "publicationStatus": "draft",
  "dependencies": [],
  "snapshot": {
    "workflow": {},
    "layout": {},
    "variables": [],
    "reusableTools": []
  },
  "publishedAt": null,
  "createdAt": "2026-08-09T09:15:00Z",
  "updatedAt": "2026-08-09T09:15:00Z"
}
```

Instantiation deep-copies owned content and remaps all owned IDs. Knowledge Space IDs remain external references and may require mapping.

An Agent Template can be exported independently as a small `.odyssey.zip`. Its manifest uses a distinct package format such as `odyssey_agent_template_package` and points to one Agent Template entrypoint. It follows the same checksum, schema validation, ID remapping, and Knowledge Space mapping rules as a Journey package.

### 13.1 Template ownership and visibility

Pattern, Agent, and Tool Templates share these semantics:

```text
source              built_in | user
visibility          private | public
publicationStatus   draft | published
```

- Built-in Templates have no owner Workspace and are public/published.
- User Templates retain `ownerWorkspaceId` even when public.
- A public Template is readable by other Workspaces but is editable only by its owner.
- Using or forking a public Template creates an independent copy and records `sourceTemplateId`.
- A fork does not stay synchronized with its source.

### 13.2 Public Template dependencies

A private Template may directly reference assets in its owner Workspace. A public Template must not expose the author's private Knowledge Space UUID, name, document metadata, files, or secrets.

Before publication, external references are converted to dependency slots:

```json
{
  "id": "0195f076-b6e6-7ef0-98db-d721990f8d01",
  "kind": "knowledge_space",
  "key": "research_knowledge",
  "label": "Research Knowledge",
  "required": true
}
```

The public Snapshot references the dependency UUID instead of an author-owned Knowledge Space UUID. A consumer maps every required dependency to an asset in the consumer's Workspace before instantiation.

Community listing metadata such as ratings, downloads, moderation, and comments is outside the Template contract and may be added through separate Community entities later.

## 14. Import ID Remapping

Import builds a complete mapping before writing records:

```text
old Journey ID       → new Journey ID
old Pattern ID       → new Pattern ID
old Slot ID          → new Slot ID
old Agent ID         → new Agent ID
old Node/Edge ID     → new Node/Edge ID
old Variable ID      → new Variable ID
old Tool Instance ID → new Tool Instance ID
```

References are rewritten after the mapping is complete. Independent asset references, such as Knowledge Spaces, are resolved through an explicit mapping step.

Import stages:

1. Validate ZIP paths and size limits.
2. Read and validate the manifest.
3. Verify declared checksums.
4. Validate every JSON file against its schema version.
5. Collect and resolve Knowledge Space references embedded in Agent Workflow Nodes and configured Tools.
6. Build ID mappings.
7. Rewrite internal references.
8. Run domain validation.
9. Persist everything in one transaction.
10. Return the new Journey ID and import warnings.

## 15. Proposed Database Alignment

This section is directional only. The database design should be finalized after the JSON review.

| JSON aggregate | Proposed storage |
| --- | --- |
| Journey metadata | `ody_journey` columns |
| PatternConfig | `ody_journey.pattern_config` JSONB |
| Agent identity metadata | `agent_workflow` columns |
| WorkflowGraph | `agent_workflow.workflow_graph` JSONB |
| CanvasLayout | `agent_workflow.canvas_layout` JSONB |
| Variables | `agent_variable` rows |
| AgentReusableTools | `agent_reusable_tool` rows with JSONB configuration |
| PatternTemplate | `pattern_template` row + JSONB snapshot/schema |
| AgentTemplate | `agent_template` row + JSONB snapshot |
| ToolDefinition | `tool_definition` row + JSON schemas |
| ToolTemplate | `tool_template` row + JSONB configured snapshot |
| Knowledge Space references | IDs in Workflow JSON plus a relational reference index |

Knowledge Space references use both representations with distinct responsibilities:

- Workflow JSON is the portable source of truth and retains the reference at the exact Node or Tool configuration where it is used.
- A relation table indexes references for foreign-key protection, deletion checks, and reverse queries.
- Saving an Agent Workflow validates the JSON and rebuilds its reference rows in the same database transaction.
- Relation rows are never edited independently through a separate business API.

Proposed relation shape:

```text
agent_workflow_knowledge_space_reference
├─ agent_workflow_id  FK
├─ knowledge_space_id FK
├─ owner_kind         agent_action | reusable_tool | task_tool
├─ owner_id           UUID of the Node or Tool instance inside JSON
└─ UNIQUE(agent_workflow_id, knowledge_space_id, owner_kind, owner_id)
```

## 16. Remaining Decisions Checklist

- [x] 所有嵌套领域对象统一使用 UUID。
- [x] Journey `status` is `draft | archived`; Journey Publish/Release selection is out of V1 scope.
- [x] Pattern 编辑后保留 `kind`；Slot 使用 `label` 和按 Pattern 需要提供的可选 `topologyRole`。
- [x] Store Goal, Knowledge Space bindings, and Tool bindings on Agent Action Nodes, not Agent-level metadata.
- [x] Loop Start/End 为显式、不可删除节点，并持久化其位置。
- [x] 持久化 Agent Workflow 和 Loop Canvas viewport。
- [x] Task 临时变量存放在 Task 节点配置中。
- [x] 配置后的 Tool 使用稳定 `kind` 和按 kind 校验的 `configuration`。
- [x] Knowledge Space 在 Workspace 内名称唯一；UUID 失败时允许用户确认唯一同名匹配。
- [x] Agent Template 支持单独导出。
- [x] Knowledge Space 引用保留在 Workflow JSON，同时建立只读关系索引表。
- [x] 已定义 Agent Action、Task、Branch、条件表达式，以及五种 Built-in Tool 的详细 JSON。
- [ ] 定义 package 和单文件大小限制。
- [x] V1 不实现旧 `schemaVersion` 迁移；只接受当前版本，不兼容版本在写入前被拒绝。

Accepted package decision:

- [x] Journey export includes only instantiated current configuration, not the reusable template library.
- [x] Export each Agent as one aggregate JSON containing Workflow, Layout, Variables, and AgentReusableTools.
