# Bounded Autonomy: Why Odyssey Does Not Give Every Decision to the Agent

> Humans define structure, state, and resource boundaries. Agents make open-ended judgments within explicit positions.

When designing an AI Agent system, it is easy to be pulled toward one of two extremes.

At one extreme is the traditional Workflow: every step, condition, and Tool call is predetermined by the designer. The system is easy to inspect, but struggles with situations that cannot be enumerated in advance.

At the other extreme is the fully autonomous Agent: give it a Goal, access to relevant Knowledge Spaces, and a set of Tools, then let the model plan, act, and decide when it is finished. The system becomes more flexible, but critical decisions are more easily hidden inside the vague promise that “the Agent will handle it.”

Odyssey does not treat these as the only two product models.

Instead, it asks: **which decisions should humans determine in advance, which are worth assigning to the Agent, and how should the two be connected through explicit structure and state?**

Odyssey calls this question Thinking Ownership, and the resulting design principle **Bounded Autonomy**.

## Autonomy Is Not a Global Switch

Calling a system “agentic” does not mean that every decision within it should be made by an Agent.

Even one Agent Workflow may contain several fundamentally different responsibilities. Some Tools must run in a fixed order. A route may need to follow an inspectable condition. A piece of work may require repeated iteration, while the iteration boundary must remain explicit. Only situations that cannot be fully enumerated in advance require open-ended Agent judgment.

If the product offers only one global slider from `Deterministic` to `Autonomous`, these differences collapse into an ambiguous intensity setting. Users cannot clearly answer: which step is more autonomous? Which state may the Agent modify? Which Tools may it select freely? Which control boundaries may it not cross?

Odyssey therefore assigns autonomy to concrete objects instead of applying a vague label to the entire Workflow.

![The Agent Workflow Canvas and Reusable Tools in Configure mode](./assets/reusable-tools.png)

*Figure 1: Configure mode places Workflow nodes, Agent Actions, Tasks, and Reusable Tools on the same design surface. Branch, Loop, Agent Action, and Task are not four visual styles; they express four different decision responsibilities. Tools enter those boundaries as configurable capabilities. Figma node `194:33`, exported on 2026-10-08.*

## Color Answers “Who Makes the Decision?”

Odyssey uses three colors consistently across Workflow nodes, Variable groups, and resource boundaries:

- Green means **User-managed**: the decision is configured by the user in advance.
- Yellow means **Shared**: the user defines an inspectable structure, while the actual path or state transition also depends on runtime state.
- Red or pink means **Agent-managed**: the Agent makes an open-ended judgment within explicit boundaries.

System state supplied and maintained by Odyssey uses neutral gray. It is not one of the three assignable Thinking Ownership categories.

Color does not indicate execution order, nor is it merely a classification of node types. A green node does not necessarily run first, and a red node does not have the highest authority. Color allows readers to move among the Canvas, Variables, and Tool configuration while continuing to track one question: **who primarily maintains this decision?**

![Agent Action, Task, and control nodes use consistent Thinking Ownership colors in Focus Mode](./assets/focus-mode.png)

*Figure 2a: Focus Mode continues the same Thinking Ownership colors. Agent Action in red or pink carries open-ended judgment, Task in green expresses predetermined deterministic steps, and Branch / Loop in yellow express explicit control boundaries. Figma node `166:2`, exported on 2026-10-07.*

![The Agent Variables panel groups state into System, User-managed, Shared, and Agent-managed](./assets/agent-variables.png)

*Figure 2b: The same color semantics extend into Agent Variables. System uses neutral gray; User-managed, Shared, and Agent-managed continue the green, yellow, and red or pink language, grounding “who makes the decision?” in state groups. Figma node `119:2`, exported on 2026-10-07.*

Nodes and Variables sharing the same colors does not make them the same kind of object. What they share is a language of responsibility: nodes show where an action or control decision occurs, while Variables show who may maintain state.

## Four Node Types Are Responsibility Boundaries, Not a Feature Menu

Odyssey intentionally keeps the core Agent Workflow node set small:

```text
Action
├── Agent Action
└── Task

Logic
├── Branch
└── Loop
```

This taxonomy begins not with “which API can this node connect to?” but with “which decision does this node carry?”

### Task: The User Owns the Steps and Their Order

Task expresses deterministic execution. The user selects the Tools, configures their parameters, and arranges the steps in advance.

```text
Task
├── Read File
├── Extract Section
└── Write Variable
```

These steps may execute automatically at runtime, but automatic execution does not mean that the Agent owns the decision. The Tool selection, order, and bindings were designed by the user, so Thinking Ownership remains User-managed.

Task suits operations that must be predictable, inspectable, or strictly reproducible. It does not add Tools at runtime or change their order on its own. If the work requires open-ended planning, disguising it as an increasingly complicated Task only hides uncertainty inside configuration details.

### Agent Action: The Agent Owns the Path, Not the World

Agent Action handles work that cannot be completely enumerated in advance. The user gives it a Goal and defines two complementary resource spaces directly on the node. By dragging Knowledge Spaces into the Agent Action, the user defines its **cognitive space**: the information and semantic environments the Agent may draw on to understand the problem. By dragging Tools into its Toolbox, the user defines its **action space**: the capabilities the Agent may use to act on the problem and the external world. Accessible Variables establish an additional state boundary.

Within these boundaries, the Agent decides how to pursue the Goal, what knowledge to draw on, when to use the available Tools, and how to update the Variables it is allowed to write.

This does not grant the Agent unlimited authority.

The Agent may reason within the provided Knowledge Spaces and choose from the Toolbox, but it cannot reach beyond those cognitive and action spaces. It may update Shared or Agent-managed Variables, but cannot directly overwrite User-managed or System state. It may make open-ended judgments inside the node, while the Workflow’s Branches, Loops, and exits remain constrained by explicit structure.

Agent Action autonomy therefore does not mean “do anything.” It means: **choose a course of action within user-defined cognitive, action, state, and control boundaries.**

An Agent Action is also not a complete Agent. An Agent is the collaborative unit that occupies an Agent Slot in an OdyJourney and owns a complete Agent Workflow. Agent Action is one step inside that Workflow. Separating the two prevents system-level Agent relationships and node-level model actions from collapsing into the same concept.

![Model, Goal, Knowledge Spaces, and Toolbox jointly define the Agent Action boundary](./assets/agent-action-design.png)

*Figure 3: The current Agent Action node design. Model provides the reasoning vehicle, Goal states what must be achieved, Knowledge Spaces provide referenceable information and a thinking environment, and Toolbox limits the available actions. Cropped from Figma `Agent Workflow Canvas — Create Variable` (`132:2`), exported and cropped on 2026-10-08.*

These four parts form a compact conceptual relationship:

| Configuration | Question it answers | Boundary it establishes |
| --- | --- | --- |
| **Model** | What reasoning capability carries out this action? | Selects the reasoning vehicle without replacing the Goal or permissions |
| **Goal** | What needs to be accomplished? | Defines the purpose without prescribing every step |
| **Knowledge Spaces** | Within which information and semantic environments can the problem be understood? | Provides referenceable context without copying or owning the knowledge asset |
| **Toolbox** | How may the Agent act on the external world? | Limits the actions available for selection |

Goal gives the Agent a direction, Knowledge Space provides an information environment for understanding the problem, and Toolbox provides the capabilities for taking action. Open-ended Agent judgment occurs in the space formed by those three boundaries, while Model is the reasoning configuration that carries the judgment.

This is an elegant conceptual structure because it does not reduce Agent Action to a Prompt field. Whether it is genuinely easy to configure—and whether different users can consistently understand the four boundaries—still needs to be validated through actual use.

### Branch: Keep Routing Decisions in an Inspectable Structure

Branch selects one subsequent path according to explicit conditions.

The user defines Cases, conditions, and the Default exit; runtime state determines which Case matches. Branch therefore sits where a User-managed structure meets runtime state, but unlike Agent Action, it does not invent a Goal or plan a new route.

Branch Routes appear directly on the Canvas instead of being hidden in a `routeTo` field in the property panel. Readers can inspect which paths are possible, which conditions activate them, and where execution goes when no condition matches.

Yellow here does not mean “let the LLM decide freely.” It reminds the reader that the control structure is designed by the user while the actual selection depends on runtime state.

### Loop: Allow Iteration Without Letting the Graph Lose Its Boundary

Loop encapsulates iteration inside a bounded composite node. It owns an internal sub-Workflow, an exit condition, and a maximum number of turns instead of allowing users to draw arbitrary back-edges on the main graph.

The current design allows Agent Action, Task, and Branch inside a Loop. Nested Loops are forbidden, and the sub-Workflow inside a Loop must remain acyclic. Repetition comes from the Loop itself, not from arbitrary graph cycles.

![An expanded Loop contains a constrained sub-Workflow and exposes its iteration boundaries in the configuration panel](./assets/loop-expanded.png)

*Figure 4: An expanded Loop shows its internal sub-Workflow and configuration area. An open-ended Agent Action may participate in one iteration, while the Loop still organizes repetition through an explicit boundary instead of turning the whole Canvas into an arbitrary cyclic graph. Figma node `477:157`, exported on 2026-10-07.*

This design makes “the process itself must repeat” a first-class structure while preserving inspectability. Where the Loop begins, what constitutes one turn, when it exits, and how many turns it permits should all be expressed within the Loop boundary.

Loop and the Circular Loop at the OdyJourney level are not the same object. Circular Loop describes collaboration topology among multiple Agent Slots. Loop describes structured iteration inside one Agent Workflow. Both may appear circular, but they operate at different design scales.

## Tool Is a Capability, Not a Fifth Decision Node

Many Workflow Builders place Search, Database, Code, Retrieval, or Write Variable directly on the Canvas as independent nodes. This is intuitive, but it can collapse “what can be done?” and “who decides when to do it?” into the same question.

Odyssey treats Tool as a capability resource. A Tool describes a configurable capability; the context that hosts it determines its Thinking Ownership:

| Where the Tool appears | Who decides to use it | How order is established |
| --- | --- | --- |
| Agent Action Toolbox | The Agent, within the Goal and permission boundaries | The Agent decides according to the current situation |
| Task Tool steps | The user in advance | The user arranges an explicit, fixed order |

The same `Write Variable` Tool can be a deterministic step when placed in a Task. When supplied to an Agent Action, it means the Agent may invoke the Tool at an allowed moment. The capability has not changed; what changes is who owns the decision to use it.

![The Knowledge Retrieval Tool configuration interface](./assets/tool-configuration.png)

*Figure 5: Tool Configuration defines capability, inputs, outputs, and bindings rather than Workflow routing. A Tool may be placed in an Agent Action Toolbox or in deterministic Task steps; its Thinking Ownership depends on the context in which it is used. Figma node `177:33`, exported on 2026-10-07.*

This separation prevents the Canvas from requiring a new node type for every external capability and allows Tools to be reused across different responsibility boundaries. It also requires the interface to keep telling the user who currently triggers the Tool, what it may read and write, and where its result is bound.

## Variables Turn Responsibility into Permissions

If Thinking Ownership exists only as node color, it can remain a visual metaphor. Variables ground responsibility in inspectable state permissions.

Odyssey divides Agent Variables into four groups:

| Variable group | Tool write | Agent Action write | Thinking Ownership |
| --- | ---: | ---: | --- |
| **System** | No | No | Supplied and maintained by Odyssey |
| **User-managed** | Yes | No | Maintained by the user through configured Tools |
| **Shared** | Yes | Yes | Maintained by both user-defined structure and the Agent |
| **Agent-managed** | No | Yes | Maintained by Agent Actions |

Two details are easy to misunderstand.

First, a Tool automatically writing a User-managed Variable at runtime does not make the state transition Agent-owned. The write rule, target Variable, and invocation position were configured by the user, so the decision remains user-owned.

Second, Agent-managed does not mean that the Agent may create arbitrary top-level state. The Schema of every non-System Variable is still defined by the user. The Agent decides only when to update a value and what to write within a declared state space. This preserves meaningful Agent-owned working state without abandoning validation and inspectability.

## What Becomes Visible Is the Decision Position, Not the Entire Internal Reasoning Process

Bounded Autonomy makes several important things visible:

- which steps the user determines in advance;
- where the Agent may make open-ended judgments;
- which routing and iteration boundaries must remain explicit;
- which Tools are available to the Agent; and
- which Variables Tools and Agent Actions may write.

These structures can be inspected, discussed, and edited. They are not the model’s complete private Chain of Thought.

Agent Action may expose its Goal, resource scope, inputs and outputs, state changes, and recordable action results. It does not promise to display every internal step through which the model forms an answer. Odyssey aims for inspectable system design, not an exaggerated claim that “all thinking is visible.”

## This Design Provides Clearer Control, Not Simply More Control

The value of Thinking Ownership is not to return every decision to the user. That would simply recreate the traditional Workflow.

Nor does it come from giving an Agent more Tools and declaring the system autonomous. The number of Tools does not show whether the autonomy boundary is clear.

The real change is that designers can answer specific questions:

- Which operations must be reproducible?
- Which judgments cannot be enumerated in advance?
- Which state may the Agent modify?
- Which control paths must always remain inspectable?
- Which capabilities may be selected freely, and which must run in a fixed order?
- Which failures should be contained within one node or one Loop?

These questions translate “how autonomous is the Agent?” into a set of concrete structural choices. Autonomy stops being a promotional adjective and becomes a system property that can be designed and reviewed.

## Costs and Open Questions

This design does not automatically make a complex system simple.

First, Thinking Ownership introduces a language that users must learn. They need to understand why the same Tool carries different responsibility in a Task and an Agent Action, and why “runs automatically” does not mean “decided by the Agent.” If color, labels, and configuration feedback are inconsistent, the boundary quickly loses credibility.

Second, the boundaries of Agent Action must be sufficiently concrete. An overly broad Goal, an oversized Toolbox, or loose Variable permissions can turn an apparently bounded red node back into a black box. The interface must help designers see which capabilities the Agent actually receives, not merely show a polished node card.

Third, the yellow semantics of Branch and Loop require continued validation. They express the relationship between user-defined control structure and runtime state; they do not mean that an LLM participates in every routing decision. If Shared is interpreted as a vague “human and AI decide together,” it reduces rather than improves precision.

Finally, future error handling, retry, Human Input, and parallel structures must answer their own Thinking Ownership questions. New nodes cannot merely extend a feature list; they must state who defines the rule, who makes the runtime decision, and how state is recorded.

## Terms Used in This Article

| Term | Meaning in this article |
| --- | --- |
| **Bounded Autonomy** | A design principle in which humans define structure, state, and resource boundaries while Agents make open-ended judgments within explicit positions. |
| **Thinking Ownership** | A language of responsibility that identifies whether a decision is maintained primarily by the user, the Agent, or both through explicit structure. |
| **Agent** | A collaborative unit that occupies an Agent Slot in an OdyJourney and owns a complete Agent Workflow. |
| **Agent Action** | A node in an Agent Workflow that carries open-ended LLM judgment and dynamic resource use. |
| **Task** | A deterministic node that executes Tool steps in an order configured by the user. |
| **Branch** | A control node that selects one subsequent path according to explicit conditions. |
| **Loop** | A composite control node that explicitly encapsulates a sub-Workflow, iteration boundary, and exit condition. |
| **Tool** | A configurable resource used by an Agent Action or Task to interact with external capabilities, data, or deterministic operations. |

## Design Sources

- Current Workflow structure: [Figma `Research Agent — Workflow Canvas` (`62:2`)](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=62-2);
- Current Variable design: [Figma `Agent Workflow Canvas — Agent Variables` (`119:2`)](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=119-2);
- Current Focus Mode: [Figma `Agent Workflow Canvas — Focus Mode` (`166:2`)](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=166-2);
- Current Reusable Tools design: [Figma `Agent Workflow Canvas — Reusable Tools` (`194:33`)](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=194-33);
- Current Agent Action node: Figma `Agent Workflow Canvas — Create Variable` (`132:2`), cropped around `132:56` and its adjacent fields;
- Current Tool configuration: [Figma `Agent Workflow Canvas — Tool Configuration (Knowledge Retrieval)` (`177:33`)](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=177-33);
- Current expanded Loop design: [Figma `Focus Mode / Loop Expanded Inline + Configuration` (`477:157`)](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=477-157);
- Node execution semantics: `odyssey/doc/architecture/execution/Canvas Execution Model.md`;
- Loop and Tool domain boundaries: `odyssey/doc/architecture/domain/odyssey-v1-design-constraints.md`;
- Variable permissions: `odyssey/doc/product/feature-specifications/variables/odyssey-agent-variable-ui-spec.md`;
- Terminology and visibility boundaries: `doc/foundations/first-release-terminology.md`, `doc/foundations/visibility-language-guidelines.md`.
