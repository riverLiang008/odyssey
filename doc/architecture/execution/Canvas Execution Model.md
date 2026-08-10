# Canvas Execution Model

The Agent Workflow Canvas is the execution layer of an Agent.

Unlike traditional workflow builders that expose arbitrary graph structures, Odyssey intentionally limits the number of node types. Each node represents a well-defined execution semantic rather than a UI component.

This design has two goals:

1. Keep the execution model simple and predictable.
2. Make workflows easier for both humans and LLMs to understand and generate.

---

# Design Principles

## Structured Control Flow

The workflow graph must remain a Directed Acyclic Graph (DAG).

Loops are represented explicitly by a **Loop** node instead of arbitrary graph cycles. This makes the execution graph statically analyzable while preserving expressive power.

## Separation of Responsibilities

Each node has only one responsibility.

| Category | Responsibility |
|----------|----------------|
| Agent Action | Agentic reasoning |
| Task | Deterministic execution |
| Branch | Conditional routing |
| Loop | Iterative execution |

The runtime behavior of every workflow should be understandable by reading these node semantics alone.

---

# Node Categories

Workflow nodes are divided into two categories.

```text
Logic
├── Branch
└── Loop

Action
├── Agent Action
└── Task
```

Logic nodes control execution flow.

Action nodes perform actual work.

---

# Start & End

Every Agent Workflow contains an implicit Start and End node.

```
Start
   │
 Workflow
   │
 End
```

These nodes cannot be removed.

## Start

The Start node represents the entry point of the Agent Workflow.

It contains no configurable fields.

Its only responsibility is to receive the execution context from the parent Agent.

## End

The End node represents successful completion of the Agent Workflow.

The next destination is determined by the selected Pattern inside the OdyJourney rather than the workflow itself.

For example, under a Linear Pattern:

```
Agent A
   │
   ▼
Agent B
   ▼
Agent C
```

The End node of Agent A automatically routes to Agent B.

This route is displayed inside the workflow canvas for visualization only.

Users cannot modify it directly.

To change the routing, users must modify the Pattern configuration in the OdyJourney.

This keeps Agent Workflows reusable across different collaboration patterns.

---

# Agent Action

Agent Action represents one agentic execution step inside an Agent Workflow.

Unlike the parent Agent, which represents a complete collaborative role, an Agent Action is only one execution node.

```
Agent
└── Workflow
    ├── Agent Action
    ├── Task
    ├── Branch
    └── Loop
```

An Agent Action is responsible for solving an open-ended problem using LLM reasoning.

Typical configuration includes:

- Goal
- Knowledge Spaces
- Toolbox

The Agent Action may autonomously decide how to use available tools in order to accomplish the specified goal.

---

# Task

Task represents deterministic execution.

Unlike Agent Action, a Task does not perform autonomous planning.

Instead, it executes a predefined sequence of tools.

Example:

```
Task
├── Search
├── Read File
├── Extract Section
└── Write Result
```

The execution order is fixed.

Future versions may support additional execution strategies.

---

# Branch

Branch represents conditional routing.

A Branch evaluates runtime state and selects exactly one execution path.

```
Branch

Case 1
    Condition A
    Condition B

Case 2
    Condition C

Default
```

Each Case contains multiple conditions.

Conditions inside one Case are evaluated using logical AND.

The first matched Case is selected.

If no Case matches, execution falls back to Default.

Branch routing is represented directly by outgoing edges on the canvas.

Therefore route targets are not configured inside the property panel.

Additional Cases can be added from the configuration panel.

---

# Loop

Loop represents structured iteration.

Instead of allowing arbitrary cycles inside the workflow graph, Odyssey encapsulates iteration inside a dedicated Loop node.

```
Loop

LoopStart

...

LoopEnd
```

A Loop contains its own sub-workflow.

The sub-workflow may contain:

- Agent Action
- Task
- Branch

Nested Loops are currently not supported.

The workflow inside a Loop must remain acyclic.

Runtime iteration is introduced by the Loop node itself rather than explicit graph cycles.

## Configuration

Loop currently supports two termination strategies.

### Exit Condition

Exit when:

- a runtime variable satisfies a condition

or

- an LLM evaluator determines the objective has been achieved (not recommended)

### Max Turn

Maximum execution iterations.

When LoopEnd is reached, one iteration is considered complete.

The runtime then evaluates the Exit Condition.

If the Exit Condition is satisfied, execution exits the Loop.

Otherwise, if Max Turn has not been reached, execution starts another iteration.

---

# Why Agent Action instead of Agent?

An Agent is a complete collaborative unit inside an OdyJourney.

It owns:

- Goal
- Knowledge Space
- Toolbox
- Workflow

Agent Action is merely one execution node inside that Workflow.

The two concepts exist at different abstraction levels.

```
OdyJourney

Pattern

Agent

Workflow

Agent Action
```

Using different terminology avoids ambiguity while preserving the conceptual hierarchy.

---

# Future Extensions

The current node set intentionally remains minimal.

Future versions may introduce additional node types, including:

- Parallel
- Human Input
- Event
- Retry
- Error Handling

These nodes should extend the execution model without changing the semantics of the existing four core node types.