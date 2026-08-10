# Built-in Tool Configuration Specification (Draft v1)

> This document defines the execution model, data flow, variable scope, and configuration panel requirements for **Built-in Tools** in Odyssey. It serves as the primary reference for implementing the Tool Configuration Panel UI.

---

# 1. Overview

In Odyssey, a **Tool** is **not** a workflow node.

Instead, Tools are executable operations that live **inside a Task Node** and are executed sequentially.

```
Agent Workflow

Task
├── Tool 1
├── Tool 2
├── Tool 3
└── ...
```

A Task represents a semantic unit of work, while Tools represent the concrete execution steps required to complete that task.

---

# 2. Design Principles

## 2.1 Task Owns Execution

The Task is responsible for:

- organizing Tool execution
- managing execution order
- owning Task Variables
- determining task success or failure
    

A Tool is responsible only for executing one operation.

---

## 2.2 Linear Execution

Tools inside a Task are executed strictly from top to bottom.

```
Tool A
    ↓
Tool B
    ↓
Tool C
```

Tool execution order is determined solely by their position in the Tool List.

Tools cannot define routing or branching.

---

## 2.3 Explicit Data Flow

Every Tool consumes explicitly referenced variables.

Every Tool that produces a result must explicitly map its primary output into a variable.

Example:

```
API Request
response.body
        ↓
task.api_response

LLM Call
context ← task.api_response
        ↓
task.review

Set Variable
task.review
        ↓
agent.review
```

There is **no implicit "previous tool result"**.

Data dependencies are always represented by variables.

---

## 2.4 Separation of Control Flow and Data Flow

Control Flow

```
Tool A
    ↓
Tool B
    ↓
Tool C
```

Data Flow

```
task.api_response
task.review
agent.final_answer
```

Tool order determines **when** execution happens.

Variables determine **what** data is consumed.

The two concepts are intentionally separated.

---

# 3. Built-in Tools (v1)

The initial Built-in Tool set consists of:

```
State
- Set Variable

Integration
- API Request

Knowledge
- Knowledge Retrieval

Computation
- Script Execution

Intelligence
- LLM Call
```

Additional Built-in Tools may be introduced in future versions without changing the overall execution model.

---

# 4. Variable Scope

Odyssey defines three variable scopes.

---

## 4.1 System Variables

Provided by the runtime.

Examples:

```
sys.current_message
sys.current_date
```

Characteristics

- read-only
- globally available
- cannot be created or modified
    

---

## 4.2 Agent Variables

Persistent execution state.

Characteristics

- typed
- visible in Agent Variable Panel
- shared across Tasks
- configurable by users
- survive Task execution

Typical examples

```
agent.paper_title
agent.review_result
agent.todo_list
```

---

## 4.3 Task Variables

Task Variables are temporary runtime buffers.

They exist only during Task execution.

Characteristics

- scoped to a single Task
- automatically discarded after Task completion
- not shown in Agent Variable Panel
- dynamically typed
- intended only for Tool-to-Tool communication

Example

```
task.api_response

task.retrieved_context

task.llm_output
```

Task Variables **cannot** be accessed by another Task.

If data must survive beyond the current Task, it must be explicitly written into an Agent Variable.

---

# 5. Tool Execution Model

Each Tool follows the same lifecycle.

```
Read Variables
      ↓
Execute Tool
      ↓
Generate Output
      ↓
Output Mapping
      ↓
Next Tool
```

Every Tool is executed synchronously in sequence.

---

# 6. Tool Configuration Model

Every Tool shares the same high-level configuration structure.

```
Tool

Label (optional)

Configuration
    Tool-specific settings

Output Mapping
    Tool output → Variable

Failure Behavior
```

Only the **Configuration** section differs between Tool types.

---

# 7. Output Mapping

Output Mapping is required for every Tool that generates a result.

Example

```
response.body
        ↓
task.api_response
```

Later Tools consume the variable instead of referencing another Tool directly.

Example

```
Knowledge Retrieval

result
    ↓
task.context

LLM Call

Context
← task.context
```

Output Mapping creates explicit, observable data flow.

---

# 8. Failure Behavior

Tool failures never create execution branches.

Supported behaviors (v1):

```
Retry

Fail Task
```

If the Tool ultimately fails,

```
Tool
    ↓
Task Failed
```

Task routing is handled by the Workflow, not by the Tool.

---

# 9. Task Variable Creation

Task Variables are created during Output Mapping.

Example

```
Save Output

○ Existing Task Variable

● New Task Variable

Name

api_response
```

The variable immediately becomes available to later Tools inside the same Task.

No separate Variable Management UI is required.

---

# 10. Tool Input Sources

Tool inputs may come from four sources.

```
Static Value

Task Variable

Agent Variable

System Variable
```

Every input explicitly specifies its source.

Example

```
Context

Source

Task Variable

task.context
```

---

# 11. Set Variable

Unlike other Tools, Set Variable modifies a variable directly.

Example

```
Target

agent.review_result

Operation

Assign

Value

task.llm_output
```

Set Variable does not require Output Mapping because the target variable itself is the destination.

---

# 12. UI Requirements

Each Tool should appear as a compact card inside the Task configuration panel.

Example

```
Task
──────────────────────────

Tool Sequence

① Knowledge Retrieval

② LLM Call

③ Set Variable
```

Selecting a Tool opens its configuration panel.

```
Tool Configuration

Label

Configuration
...

Output Mapping
...

Failure Behavior
...
```

Only one Tool configuration is edited at a time.

---

# 13. Out of Scope (v1)

The following capabilities are intentionally excluded from Tool design.

- Tool-level branching
- Tool-level routing
- Tool-level loops
- Parallel Tool execution
- Conditional Tool execution
- Cross-Task Task Variable access
- Implicit previous Tool outputs

These capabilities belong to the Workflow layer rather than the Tool layer.

---

# 14. Design Philosophy

Odyssey intentionally separates responsibilities across three levels.

```
Workflow
    ↓
Task
    ↓
Tool
```

Workflow defines execution topology.

Task defines semantic work units.

Tool performs deterministic execution.

Likewise, data ownership is separated into three scopes.

```
System Variables
        ↓
Agent Variables
        ↓
Task Variables
```

This separation keeps workflows readable, state management explicit, and execution deterministic while allowing complex systems to scale without introducing hidden dependencies.