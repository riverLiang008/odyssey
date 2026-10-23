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

Root Agent Workflows contain one required Start and Pattern-derived End boundaries. The accepted 2026-10-21 design is defined in [Pattern → Agent Workflow End 单向同步设计](./pattern-agent-end-routing-decision.md). This design supersedes the previous single-End assumption; implementation and frozen contract updates remain pending.

## Start

Start is the entry point, has no configurable fields, and receives execution context from the parent Agent.

## End

Synchronization is strictly **Pattern → Agent Workflow End**. Each outgoing Pattern route generates an End; a route to `journey_end` generates a completion End. A Slot with no outgoing routes receives one completion End. Users cannot add/delete Ends or change their targets in the Workflow Canvas. They connect internal execution paths to the generated Ends, using explicit Branch rules where selection is necessary. No `next_agent` variable or LLM routing decision is required.

End targets reference stable Slot IDs. Empty targets remain visible with stable default names such as `Agent-1` and a pending-configuration state; they are not skipped. Assignment changes update presentation without replacing the boundary or its incoming edges.

Linear derives its next destination from Slot order. Circular Loop keeps its directed cycle. Neither exposes arrow editing. Hub allows direction changes only on existing Hub–Spoke relationships: Hub → Spoke, Spoke → Hub, or both directed routes. Every generated End visibly identifies its destination.

Pattern route removal deletes its corresponding End in the same direction of synchronization. Affected internal incoming edges require explicit impact handling; stale Ends must not preserve deleted routes, and dangling edges or silent retargeting are prohibited.

Reaching a handoff End completes the current invocation and starts the target Agent at Start. A reverse route to Hub restarts Hub; it does not resume a suspended call. Call/return, cyclic termination, and handoff payload protocols remain separate unresolved designs. Loop Start/End boundaries are unchanged.

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