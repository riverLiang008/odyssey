> Version: v0.1  
> Scope: Odyssey v1 Product Demo  
> Database: PostgreSQL

---

# 1. Overview

This document defines the database design strategy for Odyssey v1.

The database is designed around the Odyssey domain model.

It is not a direct representation of frontend components or Canvas implementation details.

The database should provide a stable persistence layer for:

- Workspace
- OdyJourney
- Agent Workflow
- Knowledge Space
- Tool System
- Agent Variables
- Workflow Versioning

---

# 2. Design Principles

## 2.1 Domain-driven persistence

Database entities should follow Odyssey domain boundaries.

The database should not mirror UI structures.

Example:

Incorrect:

```

Canvas  
├── LeftPanel  
├── NodePanel  
└── ToolPanel

```

Correct:

```

AgentWorkflow  
├── Workflow Graph  
├── Variables  
└── Versions

```

---

# 2.2 JSONB First for Fast-changing Structures

Odyssey contains several structures that will evolve quickly:

- Workflow nodes
- Node configurations
- Pattern configurations
- Tool configurations
- Canvas layout

These structures should initially use JSONB.

Example:

```

agent_workflows

draft_graph JSONB

```

instead of:

```

workflow_nodes  
workflow_edges  
agent_action_configs  
task_configs  
branch_cases  
loop_configs

```

The schema can be normalized later when runtime execution requires stronger querying.

---

# 2.3 Separate Definition and Runtime

v1 focuses on configuration.

Therefore:

Stored:

```

Agent Workflow Definition  
Tool Configuration  
Knowledge Structure  
Variable Definition

```

Not stored:

```

Execution Run  
Node Runtime State  
Variable Runtime Value  
Trace

````

Runtime tables should be introduced only when the execution engine exists.

---

# 3. High-level ER Diagram

```mermaid
erDiagram

    WORKSPACE ||--o{ ODY_JOURNEY : owns

    WORKSPACE ||--o{ KNOWLEDGE_SPACE : owns

    ODY_JOURNEY ||--|{ AGENT_WORKFLOW : contains


    AGENT_WORKFLOW ||--o{ WORKFLOW_VERSION : versions

    AGENT_WORKFLOW ||--o{ AGENT_VARIABLE : defines


    TOOL_DEFINITION ||--o{ TOOL_INSTANCE : creates

    AGENT_WORKFLOW ||--o{ AGENT_REUSABLE_TOOL : provides

    TOOL_INSTANCE ||--o{ AGENT_REUSABLE_TOOL : references


    KNOWLEDGE_SPACE ||--o{ KNOWLEDGE_RESOURCE : contains

    KNOWLEDGE_SPACE ||--o{ KNOWLEDGE_FOLDER : organizes

    KNOWLEDGE_RESOURCE ||--o{ KNOWLEDGE_RELATION : source

    KNOWLEDGE_RESOURCE ||--o{ KNOWLEDGE_RELATION : target


    KNOWLEDGE_SPACE ||--o{ KNOWLEDGE_FAMILY : contains

    KNOWLEDGE_FAMILY ||--o{ KNOWLEDGE_FAMILY_RESOURCE : includes

    KNOWLEDGE_RESOURCE ||--o{ KNOWLEDGE_FAMILY_RESOURCE : belongs
````

---

# 4. Workspace

## Table

`workspace`

## Purpose

The root container of a user's Odyssey environment.

v1 assumption:

- one user;
- one workspace.
    

Multi-user and multiple workspace support are future extensions.

## Schema

```sql
workspace

id              UUID PK

name            VARCHAR

description     TEXT

created_at      TIMESTAMP

updated_at      TIMESTAMP
```

---

# 5. OdyJourney

## Table

`ody_journey`

## Purpose

Represents one complete Odyssey capability.

Examples:

- Research Assistant
- Knowledge Steward
- Document Curator
    

## Schema

```sql
ody_journey

id                  UUID PK

workspace_id        UUID FK

name                VARCHAR

description         TEXT

status              VARCHAR

pattern_config      JSONB

tags                JSONB

created_at          TIMESTAMP

updated_at          TIMESTAMP
```

---

## Pattern Configuration

Pattern is stored as configuration.

It is not an independent runtime entity in v1.

Example:

```json
{
  "type": "linear",

  "slots": [
    {
      "slot": "researcher",
      "agent_id": "agent_a"
    },
    {
      "slot": "reviewer",
      "agent_id": "agent_b"
    }
  ],

  "routes": [
    {
      "from": "researcher",
      "to": "reviewer"
    }
  ]
}
```

---

# 6. Agent Workflow

## Table

`agent_workflow`

## Purpose

An Agent is represented as a Workflow.

The Agent Workflow contains:

- graph definition;
- node configuration;
- workflow draft;
- current version reference.

## Schema

```sql
agent_workflow

id                      UUID PK

ody_journey_id          UUID FK

name                    VARCHAR

description             TEXT


draft_graph             JSONB


current_version_id      UUID FK NULL


created_at              TIMESTAMP

updated_at              TIMESTAMP
```

---

# 7. Workflow Graph Storage

## Decision

Workflow graph is stored as JSONB.

Reason:

Node types are expected to evolve.

Current nodes:

```
Start
End
Agent Action
Task
Branch
Loop
```

Future possibilities:

```
Human Approval
Parallel
Evaluation
Sub Journey
```

---

Example:

```json
{
  "nodes": [
    {
      "id": "node_1",
      "type": "agent_action",

      "position": {
        "x": 100,
        "y": 200
      },

      "config": {
        "goal": "Analyze paper",
        "knowledge_spaces": [
          "ks_1"
        ]
      }
    }
  ],

  "edges": [
    {
      "source": "node_1",
      "target": "node_2"
    }
  ]
}
```

---

# 8. Workflow Version

## Table

`workflow_version`

## Purpose

Stores immutable snapshots created by explicit Save.

Auto-save does not create versions.

## Schema

```sql
workflow_version

id                  UUID PK

agent_workflow_id   UUID FK


version_number      INTEGER

note                TEXT


snapshot             JSONB


created_at          TIMESTAMP
```

---

## Version Lifecycle

```
Canvas Editing

      |
      v

Working Draft

      |
      |
   Save Button

      |
      v

Workflow Version
```

---

# 9. Agent Variable

## Table

`agent_variable`

## Purpose

Stores Agent-level variable definitions.

It does NOT store runtime values.

## Schema

```sql
agent_variable

id                  UUID PK

agent_workflow_id   UUID FK


name                VARCHAR

description         TEXT


data_type            VARCHAR


ownership            VARCHAR


default_value        JSONB


created_at           TIMESTAMP

updated_at           TIMESTAMP
```

---

## Ownership Enum

```text
system
user_managed
shared
agent_managed
```

---

## Notes

System Variables are not stored.

Example:

```
sys.current_message
sys.current_date
```

They are provided by the runtime environment.

---

# 10. Tool System

## 10.1 Tool Definition

## Table

`tool_definition`

## Purpose

Defines a tool type.

Examples:

```
API Request

Set Variable

Knowledge Retrieval

Script Execution

LLM Call
```

## Schema

```sql
tool_definition

id                  UUID PK

key                 VARCHAR

name                VARCHAR

category            VARCHAR


source              VARCHAR

version             VARCHAR


configuration_schema JSONB

input_schema        JSONB

output_schema       JSONB


created_at          TIMESTAMP
```

---

# 10.2 Tool Instance

## Table

`tool_instance`

## Purpose

A concrete configured tool.

Example:

```
Definition:

API Request


Instance:

Customer API Query

{
 url:"..."
}
```

## Schema

```sql
tool_instance

id                  UUID PK


tool_definition_id  UUID FK


name                VARCHAR


configuration       JSONB


created_at          TIMESTAMP

updated_at          TIMESTAMP
```

---

# 10.3 Agent Reusable Tool

## Table

`agent_reusable_tool`

## Purpose

Stores reusable configured tools inside Agent scope.

A reusable tool is NOT workspace-global.

## Schema

```sql
agent_reusable_tool

id                  UUID PK


agent_workflow_id   UUID FK

tool_instance_id    UUID FK


name                VARCHAR


created_at          TIMESTAMP
```

---

# 11. Knowledge Space

## Table

`knowledge_space`

## Purpose

Long-term knowledge asset owned by Workspace.

Knowledge Space is independent from OdyJourney.

Multiple OdyJourneys may reference the same Knowledge Space.

## Schema

```sql
knowledge_space

id                  UUID PK

workspace_id        UUID FK


name                VARCHAR

description         TEXT


graph_status        VARCHAR


last_indexed_at     TIMESTAMP NULL

last_steward_run_at TIMESTAMP NULL


created_at          TIMESTAMP

updated_at          TIMESTAMP
```

---

# 12. Knowledge Folder

## Table

`knowledge_folder`

## Purpose

User-managed file organization.

Folder hierarchy does not define semantic relationships.

## Schema

```sql
knowledge_folder

id                  UUID PK


knowledge_space_id  UUID FK


parent_folder_id    UUID FK NULL


name                VARCHAR


created_at          TIMESTAMP

updated_at          TIMESTAMP
```

---

# 13. Knowledge Resource

## Table

`knowledge_resource`

## Purpose

Represents knowledge items.

v1 implementation:

```
resource_type=file
```

Future:

```
URL
Repository
Database
Conversation
API
```

## Schema

```sql
knowledge_resource

id                  UUID PK


knowledge_space_id  UUID FK


parent_folder_id    UUID FK NULL


resource_type       VARCHAR


name                VARCHAR


metadata            JSONB


storage_provider    VARCHAR

object_key          VARCHAR


created_at          TIMESTAMP

updated_at          TIMESTAMP
```

---

# 14. Knowledge Family

## Table

`knowledge_family`

## Purpose

Semantic grouping of resources.

Not equal to folder.

## Schema

```sql
knowledge_family

id                  UUID PK


knowledge_space_id  UUID FK


name                VARCHAR

description         TEXT


status              VARCHAR


created_at          TIMESTAMP
```

---

# 15. Knowledge Family Resource

Many-to-many relationship.

```sql
knowledge_family_resource

knowledge_family_id UUID FK

knowledge_resource_id UUID FK
```

---

# 16. Knowledge Relation

## Table

`knowledge_relation`

## Purpose

Stores graph edges.

Knowledge graph is:

- directed;
    
- cyclic;
    
- semantic.
    

## Schema

```sql
knowledge_relation

id                  UUID PK


knowledge_space_id  UUID FK


source_resource_id  UUID FK

target_resource_id  UUID FK


relation_type       VARCHAR


confidence          FLOAT


created_at          TIMESTAMP
```

---

# 17. Object Storage Strategy

Binary files are not stored in PostgreSQL.

Storage:

```
Object Storage
```

Examples:

Development:

```
MinIO
```

Production:

```
Supabase Storage
Cloudflare R2
AWS S3
```

Database stores:

```text
provider

bucket

object_key

metadata
```

---

# 18. Runtime Tables (Future)

Not implemented in v1.

Possible future tables:

```
journey_execution

agent_execution

node_execution

execution_variable_value

trace
```

They belong to Execution Engine, not Configuration Layer.

---

# 19. Index Strategy

Initial indexes:

## Foreign keys

All FK columns should have indexes.

Examples:

```
ody_journey.workspace_id

agent_workflow.ody_journey_id

knowledge_resource.knowledge_space_id
```

---

## Knowledge Graph

Future:

```
source_resource_id

target_resource_id
```

indexed for graph traversal.

---

## Search

Future:

PostgreSQL full text search:

```
knowledge_resource.name

knowledge_resource.metadata
```

---

# 20. Migration Strategy

Initial approach:

- SQLAlchemy models define schema;
    
- Alembic manages migrations.
    

Avoid premature normalization.

When a JSONB structure becomes stable and requires querying:

1. introduce relational tables;
2. migrate existing JSONB data;
3. keep backward compatibility.
    

---

# 21. v1 Implementation Priority

1. Workspace
2. OdyJourney
3. Agent Workflow
4. Workflow Draft JSONB
5. Workflow Version
6. Agent Variable Definition
7. Tool Definition
8. Tool Instance
9. Agent Reusable Tool
10. Knowledge Space
11. Knowledge Resource
12. Knowledge Folder
    

---

# 22. Out of Scope

Not implemented:

- multi-user;
- permissions;
- execution runtime;
- variable runtime values;
- tracing;
- scheduling;
- collaboration;
- billing;
- marketplace.
    

These should be added only when Odyssey evolves from configuration system into execution platform.